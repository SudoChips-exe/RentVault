import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { nombaClient } from './nomba-client';
import { TRANSACTION_STATUSES, generateTransactionReference } from './models';
import { logTransactionStatusChange, logNombaApiCall } from './audit-logger';

const db = admin.firestore();

const REFUNDABLE_STATUSES = [
  TRANSACTION_STATUSES.FUNDS_HELD,
  TRANSACTION_STATUSES.VERIFICATION_SUBMITTED,
  TRANSACTION_STATUSES.VERIFICATION_REJECTED,
];

async function processRefund(transactionId: string, actor: string): Promise<{ success: boolean; status: string; refundReference: string } | void> {
  const transactionDoc = await db.collection('transactions').doc(transactionId).get();
  if (!transactionDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Transaction not found');
  }

  const transaction = transactionDoc.data()!;
  if (!REFUNDABLE_STATUSES.includes(transaction.status)) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Transaction cannot be refunded in status: ${transaction.status}`
    );
  }

  if (!transaction.nombaPaymentReference) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Transaction has no payment reference for refund'
    );
  }

  const refundReference = `REF-${transactionId}-${generateTransactionReference()}`;

  try {
    const result = await nombaClient.initiateRefund({
      paymentReference: transaction.nombaPaymentReference,
      amount: transaction.amount,
      reference: refundReference,
    });

    await transactionDoc.ref.update({
      status: TRANSACTION_STATUSES.REFUND_INITIATED,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await logTransactionStatusChange(
      transactionId,
      transaction.status,
      TRANSACTION_STATUSES.REFUND_INITIATED,
      actor
    );

    await logNombaApiCall('/refunds', refundReference, 200, {
      paymentReference: transaction.nombaPaymentReference,
      amount: transaction.amount,
    });

    functions.logger.log(
      `[REFUND] Initiated for transaction ${transactionId} (ref: ${refundReference})`
    );

    return { success: true, status: TRANSACTION_STATUSES.REFUND_INITIATED, refundReference };
  } catch (error: any) {
    functions.logger.error(`[REFUND] Failed for transaction ${transactionId}`, error);

    await transactionDoc.ref.update({
      status: TRANSACTION_STATUSES.REFUND_FAILED,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await logTransactionStatusChange(
      transactionId,
      transaction.status,
      TRANSACTION_STATUSES.REFUND_FAILED,
      actor
    );

    await logNombaApiCall('/refunds', refundReference, error.response?.status || 500, {
      error: error.message,
    });

    throw new functions.https.HttpsError(
      'internal',
      `Refund failed for transaction ${transactionId}. Contact support.`
    );
  }
}

export const manualRefund = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in');
  }

  const uid = context.auth.uid;
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User profile not found');
  }

  const user = userDoc.data()!;
  if (user.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can trigger refunds'
    );
  }

  if (!data.transactionId || typeof data.transactionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'transactionId is required');
  }

  return processRefund(data.transactionId, uid);
});

export const refundOnRejection = functions.firestore
  .document('transactions/{transactionId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const transactionId = context.params.transactionId;

    if (
      beforeData.status !== TRANSACTION_STATUSES.VERIFICATION_REJECTED &&
      afterData.status === TRANSACTION_STATUSES.VERIFICATION_REJECTED
    ) {
      functions.logger.log(`[REFUND] Auto-triggered for rejected transaction ${transactionId}`);
      try {
        await processRefund(transactionId, 'system');
      } catch (error) {
        functions.logger.error(`[REFUND] Auto-refund failed for ${transactionId}`, error);
      }
    }
  });

export { processRefund };
