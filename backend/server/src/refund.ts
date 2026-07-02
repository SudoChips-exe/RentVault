import { Router } from 'express';
import * as admin from 'firebase-admin';
import { nombaClient } from './nomba-client';
import { TRANSACTION_STATUSES, generateTransactionReference } from './models';
import { logTransactionStatusChange, logNombaApiCall } from './audit-logger';
import { ApiError } from './api-error';
import { requireAuth, asyncRoute, AuthedRequest } from './middleware';

const db = admin.firestore();

const REFUNDABLE_STATUSES = [
  TRANSACTION_STATUSES.FUNDS_HELD,
  TRANSACTION_STATUSES.VERIFICATION_SUBMITTED,
  TRANSACTION_STATUSES.VERIFICATION_REJECTED,
] as string[];

// Ported from refund-trigger.ts. Used both by the manualRefund route and by
// the verification route directly after rejecting a transaction (replacing
// the old refundOnRejection Firestore trigger).
export async function processRefund(
  transactionId: string,
  actor: string
): Promise<{ success: boolean; status: string; refundReference: string } | void> {
  const transactionDoc = await db.collection('transactions').doc(transactionId).get();
  if (!transactionDoc.exists) {
    throw new ApiError('not-found', 'Transaction not found');
  }

  const transaction = transactionDoc.data()!;
  if (!REFUNDABLE_STATUSES.includes(transaction.status)) {
    throw new ApiError(
      'failed-precondition',
      `Transaction cannot be refunded in status: ${transaction.status}`
    );
  }

  if (!transaction.nombaPaymentReference) {
    throw new ApiError(
      'failed-precondition',
      'Transaction has no payment reference for refund'
    );
  }

  const refundReference = `REF-${transactionId}-${generateTransactionReference()}`;

  try {
    await nombaClient.initiateRefund({
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

    console.log(`[REFUND] Initiated for transaction ${transactionId} (ref: ${refundReference})`);

    return { success: true, status: TRANSACTION_STATUSES.REFUND_INITIATED, refundReference };
  } catch (error: any) {
    console.error(`[REFUND] Failed for transaction ${transactionId}`, error);

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

    throw new ApiError('internal', `Refund failed for transaction ${transactionId}. Contact support.`);
  }
}

export const refundRouter = Router();

refundRouter.post('/manualRefund', requireAuth, asyncRoute(async (req: AuthedRequest, res) => {
  const uid = req.uid!;
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new ApiError('permission-denied', 'User profile not found');
  }

  const user = userDoc.data()!;
  if (user.role !== 'admin') {
    throw new ApiError('permission-denied', 'Only admins can trigger refunds');
  }

  const { transactionId } = req.body;
  if (!transactionId || typeof transactionId !== 'string') {
    throw new ApiError('invalid-argument', 'transactionId is required');
  }

  const result = await processRefund(transactionId, uid);
  res.json(result);
}));
