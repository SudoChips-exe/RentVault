import { Router } from 'express';
import * as admin from 'firebase-admin';
import { nombaClient } from './nomba-client';
import { TRANSACTION_STATUSES, generateTransactionReference, validateTransactionStatusTransition } from './models';
import { logTransactionStatusChange, logNombaApiCall } from './audit-logger';
import { ApiError } from './api-error';
import { isAxiosErrorWithStatus, errorMessage } from './error-utils';
import { requireAuth, asyncRoute, AuthedRequest, sensitiveActionRateLimit } from './middleware';

const db = admin.firestore();

// Ported from refund-trigger.ts. Used both by the manualRefund route and by
// the verification route directly after rejecting a transaction (replacing
// the old refundOnRejection Firestore trigger), as well as by the timeout
// checker in internal.ts.
export async function processRefund(
  transactionId: string,
  actor: string
): Promise<{ success: boolean; status: string; refundReference: string } | void> {
  const transactionRef = db.collection('transactions').doc(transactionId);

  // The status transition (funds_held/verification_submitted/rejected/timeout
  // -> refund_initiated) is claimed atomically inside a Firestore transaction
  // before the Nomba call, so two concurrent refund attempts (e.g. an admin's
  // manualRefund racing the automatic reject/timeout refund) can't both pass
  // the precondition check and double-refund the tenant.
  const { previousStatus, nombaPaymentReference, amount } = await db.runTransaction(async (tx) => {
    const transactionDoc = await tx.get(transactionRef);
    if (!transactionDoc.exists) {
      throw new ApiError('not-found', 'Transaction not found');
    }

    const transaction = transactionDoc.data()!;
    if (!validateTransactionStatusTransition(transaction.status, TRANSACTION_STATUSES.REFUND_INITIATED)) {
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

    tx.update(transactionRef, {
      status: TRANSACTION_STATUSES.REFUND_INITIATED,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      previousStatus: transaction.status as string,
      nombaPaymentReference: transaction.nombaPaymentReference as string,
      amount: transaction.amount as number,
    };
  });

  const refundReference = `REF-${transactionId}-${generateTransactionReference()}`;

  try {
    await nombaClient.initiateRefund({
      paymentReference: nombaPaymentReference,
      amount,
      reference: refundReference,
    });

    await logTransactionStatusChange(
      transactionId,
      previousStatus,
      TRANSACTION_STATUSES.REFUND_INITIATED,
      actor
    );

    await logNombaApiCall('/refunds', refundReference, 200, {
      paymentReference: nombaPaymentReference,
      amount,
    });

    console.log(`[REFUND] Initiated for transaction ${transactionId} (ref: ${refundReference})`);

    return { success: true, status: TRANSACTION_STATUSES.REFUND_INITIATED, refundReference };
  } catch (error: unknown) {
    const message = errorMessage(error);
    const status = isAxiosErrorWithStatus(error) ? error.response.status : 500;
    console.error(`[REFUND] Failed for transaction ${transactionId}`, error);

    // We already own the refund_initiated state exclusively (claimed above),
    // so this follow-up write is a normal single-writer update, not a race.
    await transactionRef.update({
      status: TRANSACTION_STATUSES.REFUND_FAILED,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await logTransactionStatusChange(
      transactionId,
      TRANSACTION_STATUSES.REFUND_INITIATED,
      TRANSACTION_STATUSES.REFUND_FAILED,
      actor
    );

    await logNombaApiCall('/refunds', refundReference, status, { error: message });

    throw new ApiError('internal', `Refund failed for transaction ${transactionId}. Contact support.`);
  }
}

export const refundRouter = Router();

refundRouter.post('/manualRefund', requireAuth, sensitiveActionRateLimit, asyncRoute(async (req: AuthedRequest, res) => {
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
