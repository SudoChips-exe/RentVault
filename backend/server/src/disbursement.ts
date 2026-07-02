import * as admin from 'firebase-admin';
import { nombaClient } from './nomba-client';
import { calculateDisbursementAmounts, TRANSACTION_STATUSES } from './models';
import { logTransactionStatusChange, logNombaApiCall } from './audit-logger';
import { config } from './config';

const db = admin.firestore();

interface RequiredRecipient {
  recipientType: 'landlord' | 'agent' | 'platform';
  recipientUid: string;
  amount: number;
  accountId?: string;
  reference: string;
}

function isAxiosErrorWithStatus(error: unknown): error is { response: { status: number } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: { status?: unknown } }).response !== null &&
    typeof (error as { response: { status?: unknown } }).response.status === 'number'
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

  // Resolve every required recipient's payout account up front. Recipients
  // that can't be resolved (missing nombaAccountId) still get a `disbursements`
  // entry below with a failed status, instead of being silently omitted -
  // omitting them let `allDisbursed` checks (here and in webhook.ts) pass
  // vacuously and mark the transaction `completed` without everyone paid.
  const landlordDoc = await db.collection('users').doc(afterData.landlordUid).get();
  const landlordAccountId = landlordDoc.data()?.nombaAccountId as string | undefined;

  let agentAccountId: string | undefined;
  if (afterData.agentUid && amounts.agentAmount > 0) {
    const agentDoc = await db.collection('users').doc(afterData.agentUid).get();
    agentAccountId = agentDoc.data()?.nombaAccountId as string | undefined;
  }

  const platformNombaAccountId = config.platform.nombaAccountId || undefined;

  const timestamp = Date.now();
  const requiredRecipients: RequiredRecipient[] = [
    {
      recipientType: 'landlord',
      recipientUid: afterData.landlordUid,
      amount: amounts.landlordAmount,
      accountId: landlordAccountId,
      reference: `DISP-${transactionId}-LORD-${timestamp}`,
    },
    ...(afterData.agentUid && amounts.agentAmount > 0
      ? [
          {
            recipientType: 'agent' as const,
            recipientUid: afterData.agentUid as string,
            amount: amounts.agentAmount,
            accountId: agentAccountId,
            reference: `DISP-${transactionId}-AGENT-${timestamp}`,
          },
        ]
      : []),
    {
      recipientType: 'platform',
      recipientUid: 'platform',
      amount: amounts.platformAmount,
      accountId: platformNombaAccountId,
      reference: `DISP-${transactionId}-PLAT-${timestamp}`,
    },
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

  const disbursements: Record<string, Record<string, unknown>> = {};

  for (const recipient of requiredRecipients) {
    if (!recipient.accountId) {
      console.error(
        `[DISBURSEMENT] ${recipient.recipientType} (${recipient.recipientUid}) missing nombaAccountId for transaction ${transactionId}`
      );
      disbursements[recipient.recipientType] = {
        recipientType: recipient.recipientType,
        amount: recipient.amount,
        status: 'transfer_initiation_failed',
        failureReason: 'missing_nomba_account',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      continue;
    }

    try {
      const result = await nombaClient.initiateTransfer({
        amount: recipient.amount,
        reference: recipient.reference,
        recipientAccountId: recipient.accountId,
        narration: `Rent disbursement - ${recipient.recipientType}`,
      });

      disbursements[recipient.recipientType] = {
        recipientType: recipient.recipientType,
        amount: recipient.amount,
        nombaTransferReference: result.reference,
        status: 'transfer_pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await logNombaApiCall(
        '/transfers',
        recipient.reference,
        200,
        { recipientType: recipient.recipientType, amount: recipient.amount }
      );

      console.log(
        `[NOMBA_TRANSFER] ${recipient.recipientType}: ${'₦'}${(recipient.amount / 100).toLocaleString()} (ref: ${recipient.reference})`
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
        failureReason: 'nomba_transfer_error',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await logNombaApiCall(
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
