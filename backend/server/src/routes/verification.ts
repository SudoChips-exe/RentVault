import { Router } from 'express';
import * as admin from 'firebase-admin';
import { TRANSACTION_STATUSES, validateTransactionStatusTransition, TransactionStatus } from '../models';
import { logTransactionStatusChange, logVerificationAction } from '../audit-logger';
import { ApiError } from '../api-error';
import { requireAuth, asyncRoute, AuthedRequest, sensitiveActionRateLimit } from '../middleware';
import { runDisbursement } from '../disbursement';
import { processRefund } from '../refund';

const db = admin.firestore();

export const verificationRouter = Router();

verificationRouter.post('/verificationSubmit', requireAuth, sensitiveActionRateLimit, asyncRoute(async (req: AuthedRequest, res) => {
  const uid = req.uid!;
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) throw new ApiError('permission-denied', 'User profile not found');

  const user = userDoc.data()!;
  if (user.role !== 'landlord' && user.role !== 'agent') {
    throw new ApiError('permission-denied', 'Only landlords and agents can submit verification');
  }

  const { transactionId, documentUrl } = req.body;
  if (!transactionId || typeof transactionId !== 'string') {
    throw new ApiError('invalid-argument', 'transactionId is required');
  }
  if (!documentUrl || typeof documentUrl !== 'string') {
    throw new ApiError('invalid-argument', 'documentUrl is required');
  }

  const transactionRef = db.collection('transactions').doc(transactionId);
  const previousStatus = await db.runTransaction(async (tx: admin.firestore.Transaction) => {
    const transactionDoc = await tx.get(transactionRef);
    if (!transactionDoc.exists) throw new ApiError('not-found', 'Transaction not found');

    const transaction = transactionDoc.data()!;
    const isAssociated = transaction.landlordUid === uid || transaction.agentUid === uid;
    if (!isAssociated) {
      throw new ApiError('permission-denied', 'You are not associated with this transaction');
    }

    if (!validateTransactionStatusTransition(transaction.status, TRANSACTION_STATUSES.VERIFICATION_SUBMITTED)) {
      throw new ApiError(
        'failed-precondition',
        `Transaction must be in funds_held status, current: ${transaction.status}`
      );
    }

    tx.update(transactionRef, {
      status: TRANSACTION_STATUSES.VERIFICATION_SUBMITTED,
      verificationDocumentUrl: documentUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return transaction.status as TransactionStatus;
  });

  await logTransactionStatusChange(
    transactionId,
    previousStatus,
    TRANSACTION_STATUSES.VERIFICATION_SUBMITTED,
    uid
  );

  await logVerificationAction(transactionId, 'submitted', uid, { documentUrl });

  console.log(`[VERIFICATION] Submitted for transaction ${transactionId}`);

  res.json({ success: true, status: TRANSACTION_STATUSES.VERIFICATION_SUBMITTED });
}));

verificationRouter.post('/verificationApprove', requireAuth, sensitiveActionRateLimit, asyncRoute(async (req: AuthedRequest, res) => {
  const uid = req.uid!;
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) throw new ApiError('permission-denied', 'User profile not found');

  const user = userDoc.data()!;
  if (user.role !== 'admin') {
    throw new ApiError('permission-denied', 'Only admins can approve verification');
  }

  const { transactionId } = req.body;
  if (!transactionId || typeof transactionId !== 'string') {
    throw new ApiError('invalid-argument', 'transactionId is required');
  }

  const transactionRef = db.collection('transactions').doc(transactionId);
  await db.runTransaction(async (tx: admin.firestore.Transaction) => {
    const transactionDoc = await tx.get(transactionRef);
    if (!transactionDoc.exists) throw new ApiError('not-found', 'Transaction not found');

    const transaction = transactionDoc.data()!;
    if (!validateTransactionStatusTransition(transaction.status, TRANSACTION_STATUSES.VERIFIED)) {
      throw new ApiError(
        'failed-precondition',
        `Transaction must be in verification_submitted status, current: ${transaction.status}`
      );
    }

    tx.update(transactionRef, {
      status: TRANSACTION_STATUSES.VERIFIED,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await logTransactionStatusChange(
    transactionId,
    TRANSACTION_STATUSES.VERIFICATION_SUBMITTED,
    TRANSACTION_STATUSES.VERIFIED,
    uid
  );

  await logVerificationAction(transactionId, 'approved', uid);

  console.log(`[VERIFICATION] Approved for transaction ${transactionId}`);

  // Previously handled by the disbursementTrigger Firestore trigger, which
  // only ever fired on this exact status transition - inlined here instead.
  runDisbursement(transactionId).catch((error) => {
    console.error(`[DISBURSEMENT] Unhandled error for transaction ${transactionId}`, error);
  });

  res.json({ success: true, status: TRANSACTION_STATUSES.VERIFIED });
}));

verificationRouter.post('/verificationReject', requireAuth, sensitiveActionRateLimit, asyncRoute(async (req: AuthedRequest, res) => {
  const uid = req.uid!;
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) throw new ApiError('permission-denied', 'User profile not found');

  const user = userDoc.data()!;
  if (user.role !== 'admin') {
    throw new ApiError('permission-denied', 'Only admins can reject verification');
  }

  const { transactionId } = req.body;
  if (!transactionId || typeof transactionId !== 'string') {
    throw new ApiError('invalid-argument', 'transactionId is required');
  }

  const transactionRef = db.collection('transactions').doc(transactionId);
  await db.runTransaction(async (tx: admin.firestore.Transaction) => {
    const transactionDoc = await tx.get(transactionRef);
    if (!transactionDoc.exists) throw new ApiError('not-found', 'Transaction not found');

    const transaction = transactionDoc.data()!;
    if (!validateTransactionStatusTransition(transaction.status, TRANSACTION_STATUSES.VERIFICATION_REJECTED)) {
      throw new ApiError(
        'failed-precondition',
        `Transaction must be in verification_submitted status, current: ${transaction.status}`
      );
    }

    tx.update(transactionRef, {
      status: TRANSACTION_STATUSES.VERIFICATION_REJECTED,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await logTransactionStatusChange(
    transactionId,
    TRANSACTION_STATUSES.VERIFICATION_SUBMITTED,
    TRANSACTION_STATUSES.VERIFICATION_REJECTED,
    uid
  );

  await logVerificationAction(transactionId, 'rejected', uid);

  console.log(`[VERIFICATION] Rejected for transaction ${transactionId}`);

  // Previously handled by the refundOnRejection Firestore trigger, which
  // only ever fired on this exact status transition - inlined here instead.
  processRefund(transactionId, 'system').catch((error) => {
    console.error(`[REFUND] Auto-refund failed for ${transactionId}`, error);
  });

  res.json({ success: true, status: TRANSACTION_STATUSES.VERIFICATION_REJECTED });
}));
