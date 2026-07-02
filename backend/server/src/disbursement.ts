import * as admin from 'firebase-admin';
import { nombaClient } from './nomba-client';
import { calculateDisbursementAmounts, TRANSACTION_STATUSES } from './models';
import { logTransactionStatusChange, logNombaApiCall } from './audit-logger';
import { config } from './config';

const db = admin.firestore();

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
    console.error(`[DISBURSEMENT] Missing split config for transaction ${transactionId}`);
    return;
  }

  let amounts: { landlordAmount: number; agentAmount: number; platformAmount: number };
  try {
    amounts = calculateDisbursementAmounts(afterData.amount, splitConfig);
  } catch (error: any) {
    console.error(`[DISBURSEMENT] Invalid split config: ${error.message}`);
    return;
  }

  const landlordDoc = await db.collection('users').doc(afterData.landlordUid).get();
  const landlordData = landlordDoc.data();
  if (!landlordData?.nombaAccountId) {
    console.error(`[DISBURSEMENT] Landlord ${afterData.landlordUid} missing nombaAccountId`);
    return;
  }

  const platformNombaAccountId = config.platform.nombaAccountId;
  if (!platformNombaAccountId) {
    console.error('[DISBURSEMENT] Platform nombaAccountId not configured');
    return;
  }

  const transfers: Array<{
    amount: number;
    recipientAccountId: string;
    reference: string;
    recipientType: string;
    recipientUid: string;
  }> = [];

  const timestamp = Date.now();

  transfers.push({
    amount: amounts.landlordAmount,
    recipientAccountId: landlordData.nombaAccountId,
    reference: `DISP-${transactionId}-LORD-${timestamp}`,
    recipientType: 'landlord',
    recipientUid: afterData.landlordUid,
  });

  if (afterData.agentUid && amounts.agentAmount > 0) {
    const agentDoc = await db.collection('users').doc(afterData.agentUid).get();
    const agentData = agentDoc.data();
    if (agentData?.nombaAccountId) {
      transfers.push({
        amount: amounts.agentAmount,
        recipientAccountId: agentData.nombaAccountId,
        reference: `DISP-${transactionId}-AGENT-${timestamp}`,
        recipientType: 'agent',
        recipientUid: afterData.agentUid,
      });
    } else {
      console.warn(`[DISBURSEMENT] Agent ${afterData.agentUid} missing nombaAccountId, skipping`);
    }
  }

  transfers.push({
    amount: amounts.platformAmount,
    recipientAccountId: platformNombaAccountId,
    reference: `DISP-${transactionId}-PLAT-${timestamp}`,
    recipientType: 'platform',
    recipientUid: 'platform',
  });

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

  const disbursements: Record<string, any> = {};

  for (const transfer of transfers) {
    try {
      const result = await nombaClient.initiateTransfer({
        amount: transfer.amount,
        reference: transfer.reference,
        recipientAccountId: transfer.recipientAccountId,
        narration: `Rent disbursement - ${transfer.recipientType}`,
      });

      disbursements[transfer.recipientType] = {
        recipientType: transfer.recipientType,
        amount: transfer.amount,
        nombaTransferReference: result.reference,
        status: 'transfer_pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await logNombaApiCall(
        '/transfers',
        transfer.reference,
        200,
        { recipientType: transfer.recipientType, amount: transfer.amount }
      );

      console.log(
        `[NOMBA_TRANSFER] ${transfer.recipientType}: ${'₦'}${(transfer.amount / 100).toLocaleString()} (ref: ${transfer.reference})`
      );
    } catch (error: any) {
      console.error(
        `[DISBURSEMENT] Transfer initiation failed for ${transfer.recipientType}`,
        error
      );

      disbursements[transfer.recipientType] = {
        recipientType: transfer.recipientType,
        amount: transfer.amount,
        status: 'transfer_initiation_failed',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await logNombaApiCall(
        '/transfers',
        transfer.reference,
        error.response?.status || 500,
        { recipientType: transfer.recipientType, error: error.message }
      );
    }
  }

  await transactionRef.update({
    disbursements,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const anyFailed = Object.values(disbursements).some(
    (d: any) => d.status === 'transfer_initiation_failed'
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
