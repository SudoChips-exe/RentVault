import * as admin from 'firebase-admin';
import { nombaClient } from './nomba-client';
import { monnifyClient } from './monnify-client';
import { calculateDisbursementAmounts, TRANSACTION_STATUSES } from './models';
import { logTransactionStatusChange, logNombaApiCall, logMonnifyApiCall } from './audit-logger';
import { config } from './config';
import { isAxiosErrorWithStatus, errorMessage } from './error-utils';

const db = admin.firestore();

interface MonnifyAccount {
  accountNumber: string;
  bankCode: string;
  accountName: string;
}

interface RequiredRecipient {
  recipientType: 'landlord' | 'agent' | 'platform';
  recipientUid: string;
  amount: number;
  nombaAccountId?: string;
  monnifyAccount?: MonnifyAccount;
  reference: string;
}

// Marks the transaction as failed instead of leaving it silently stuck (e.g.
// at `verified`) when disbursement can't even be attempted - bad split
// config or an unresolvable amount calculation.
async function failDisbursement(
  transactionRef: admin.firestore.DocumentReference,
  transactionId: string,
  from: string,
  reason: string
): Promise<void> {
  console.error(`[DISBURSEMENT] ${reason} for transaction ${transactionId}`);
  await transactionRef.update({
    status: TRANSACTION_STATUSES.DISBURSEMENT_PARTIAL_FAILURE,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await logTransactionStatusChange(
    transactionId,
    from,
    TRANSACTION_STATUSES.DISBURSEMENT_PARTIAL_FAILURE,
    'system'
  );
}

// Ported from the Firestore onUpdate trigger `disbursementTrigger` -
// previously fired automatically when a transaction's status became
// `verified`. There's exactly one place that ever makes that transition
// (verificationApprove), so this is now called directly from there instead.
export async function runDisbursement(transactionId: string): Promise<void> {
  const transactionRef = db.collection('transactions').doc(transactionId);
  const transactionSnap = await transactionRef.get();
  if (!transactionSnap.exists) {
    console.error(`[DISBURSEMENT] Transaction ${transactionId} not found`);
    return;
  }
  const afterData = transactionSnap.data()!;

  console.log(`[DISBURSEMENT] Triggered for transaction ${transactionId}`);

  const splitConfig = afterData.splitConfigSnapshot;
  if (!splitConfig || !splitConfig.landlordPercentage) {
    await failDisbursement(transactionRef, transactionId, TRANSACTION_STATUSES.VERIFIED, 'Missing split config');
    return;
  }

  let amounts: { landlordAmount: number; agentAmount: number; platformAmount: number };
  try {
    amounts = calculateDisbursementAmounts(afterData.amount, splitConfig);
  } catch (error: unknown) {
    await failDisbursement(
      transactionRef,
      transactionId,
      TRANSACTION_STATUSES.VERIFIED,
      `Invalid split config: ${errorMessage(error)}`
    );
    return;
  }

  // Payout provider matches the provider that collected the payment - keeps
  // money on the same rails rather than moving between providers.
  const provider: 'nomba' | 'monnify' = afterData.paymentProvider || 'nomba';

  function resolvePayoutAccount(userData: admin.firestore.DocumentData | undefined) {
    if (provider === 'monnify') {
      const account = userData?.monnifyPayoutAccount as MonnifyAccount | undefined;
      const complete = account?.accountNumber && account?.bankCode && account?.accountName;
      return { monnifyAccount: complete ? account : undefined };
    }
    return { nombaAccountId: userData?.nombaAccountId as string | undefined };
  }

  // Resolve every required recipient's payout account up front. Recipients
  // that can't be resolved (missing payout account for this provider) still
  // get a `disbursements` entry below with a failed status, instead of being
  // silently omitted - omitting them let `allDisbursed` checks (here and in
  // webhook.ts/webhook-monnify.ts) pass vacuously and mark the transaction
  // `completed` without everyone paid.
  const landlordDoc = await db.collection('users').doc(afterData.landlordUid).get();
  const landlordAccount = resolvePayoutAccount(landlordDoc.data());

  let agentAccount: { nombaAccountId?: string; monnifyAccount?: MonnifyAccount } = {};
  if (afterData.agentUid && amounts.agentAmount > 0) {
    const agentDoc = await db.collection('users').doc(afterData.agentUid).get();
    agentAccount = resolvePayoutAccount(agentDoc.data());
  }

  const timestamp = Date.now();
  const requiredRecipients: RequiredRecipient[] = [
    {
      recipientType: 'landlord',
      recipientUid: afterData.landlordUid,
      amount: amounts.landlordAmount,
      ...landlordAccount,
      reference: `DISP-${transactionId}-LORD-${timestamp}`,
    },
    ...(afterData.agentUid && amounts.agentAmount > 0
      ? [
          {
            recipientType: 'agent' as const,
            recipientUid: afterData.agentUid as string,
            amount: amounts.agentAmount,
            ...agentAccount,
            reference: `DISP-${transactionId}-AGENT-${timestamp}`,
          },
        ]
      : []),
  ];

  await transactionRef.update({
    status: TRANSACTION_STATUSES.DISBURSEMENT_PENDING,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await logTransactionStatusChange(
    transactionId,
    TRANSACTION_STATUSES.VERIFIED,
    TRANSACTION_STATUSES.DISBURSEMENT_PENDING,
    'system'
  );

  // The platform's cut never leaves the sub-account rent was collected into
  // (see order.accountId in nomba-client.ts's createCheckout), so unlike
  // landlord/agent it needs no transfer - it's marked disbursed immediately
  // rather than routed through the transfer loop below.
  const disbursements: Record<string, Record<string, unknown>> = {
    platform: {
      recipientType: 'platform',
      amount: amounts.platformAmount,
      status: 'disbursed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  };

  for (const recipient of requiredRecipients) {
    const hasAccount = provider === 'monnify' ? !!recipient.monnifyAccount : !!recipient.nombaAccountId;
    if (!hasAccount) {
      console.error(
        `[DISBURSEMENT] ${recipient.recipientType} (${recipient.recipientUid}) missing ${provider} payout account for transaction ${transactionId}`
      );
      disbursements[recipient.recipientType] = {
        recipientType: recipient.recipientType,
        amount: recipient.amount,
        status: 'transfer_initiation_failed',
        failureReason: provider === 'monnify' ? 'missing_monnify_account' : 'missing_nomba_account',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      continue;
    }

    try {
      const result = provider === 'monnify'
        ? await monnifyClient.initiateTransfer({
            amount: recipient.amount,
            reference: recipient.reference,
            destinationAccountNumber: recipient.monnifyAccount!.accountNumber,
            destinationBankCode: recipient.monnifyAccount!.bankCode,
            destinationAccountName: recipient.monnifyAccount!.accountName,
            narration: `Rent disbursement - ${recipient.recipientType}`,
          })
        : await nombaClient.initiateTransfer({
            amount: recipient.amount,
            reference: recipient.reference,
            recipientAccountId: recipient.nombaAccountId!,
            narration: `Rent disbursement - ${recipient.recipientType}`,
          });

      disbursements[recipient.recipientType] = {
        recipientType: recipient.recipientType,
        amount: recipient.amount,
        [provider === 'monnify' ? 'monnifyTransferReference' : 'nombaTransferReference']: result.reference,
        status: 'transfer_pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const logApiCall = provider === 'monnify' ? logMonnifyApiCall : logNombaApiCall;
      await logApiCall(
        '/transfers',
        recipient.reference,
        200,
        { recipientType: recipient.recipientType, amount: recipient.amount }
      );

      console.log(
        `[${provider.toUpperCase()}_TRANSFER] ${recipient.recipientType}: ${'₦'}${(recipient.amount / 100).toLocaleString()} (ref: ${recipient.reference})`
      );
    } catch (error: unknown) {
      console.error(
        `[DISBURSEMENT] Transfer initiation failed for ${recipient.recipientType}`,
        error
      );

      disbursements[recipient.recipientType] = {
        recipientType: recipient.recipientType,
        amount: recipient.amount,
        status: 'transfer_initiation_failed',
        failureReason: provider === 'monnify' ? 'monnify_transfer_error' : 'nomba_transfer_error',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const logApiCall = provider === 'monnify' ? logMonnifyApiCall : logNombaApiCall;
      await logApiCall(
        '/transfers',
        recipient.reference,
        isAxiosErrorWithStatus(error) ? error.response.status : 500,
        { recipientType: recipient.recipientType, error: errorMessage(error) }
      );
    }
  }

  await transactionRef.update({
    disbursements,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const anyFailed = Object.values(disbursements).some(
    (d) => d.status === 'transfer_initiation_failed'
  );

  if (anyFailed) {
    await transactionRef.update({
      status: TRANSACTION_STATUSES.DISBURSEMENT_PARTIAL_FAILURE,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await logTransactionStatusChange(
      transactionId,
      TRANSACTION_STATUSES.DISBURSEMENT_PENDING,
      TRANSACTION_STATUSES.DISBURSEMENT_PARTIAL_FAILURE,
      'system'
    );

    console.error(`[DISBURSEMENT] Partial failure for transaction ${transactionId}`);
  }
}
