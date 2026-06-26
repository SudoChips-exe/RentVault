import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { TRANSACTION_STATUSES } from './models';
import {
  logTransactionStatusChange,
  logVerificationAction,
} from './audit-logger';

const db = admin.firestore();

export const verificationSubmit = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in');
  }

  const uid = context.auth.uid;
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User profile not found');
  }

  const user = userDoc.data()!;
  if (user.role !== 'landlord' && user.role !== 'agent') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only landlords and agents can submit verification'
    );
  }

  if (!data.transactionId || typeof data.transactionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'transactionId is required');
  }

  if (!data.documentUrl || typeof data.documentUrl !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'documentUrl is required');
  }

  const transactionDoc = await db.collection('transactions').doc(data.transactionId).get();
  if (!transactionDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Transaction not found');
  }

  const transaction = transactionDoc.data()!;
  if (transaction.status !== TRANSACTION_STATUSES.FUNDS_HELD) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Transaction must be in funds_held status, current: ${transaction.status}`
    );
  }

  const isAssociated =
    transaction.landlordUid === uid ||
    transaction.agentUid === uid;
  if (!isAssociated) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You are not associated with this transaction'
    );
  }

  await transactionDoc.ref.update({
    status: TRANSACTION_STATUSES.VERIFICATION_SUBMITTED,
    verificationDocumentUrl: data.documentUrl,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await logTransactionStatusChange(
    data.transactionId,
    TRANSACTION_STATUSES.FUNDS_HELD,
    TRANSACTION_STATUSES.VERIFICATION_SUBMITTED,
    uid
  );

  await logVerificationAction(data.transactionId, 'submitted', uid, {
    documentUrl: data.documentUrl,
  });

  functions.logger.log(`[VERIFICATION] Submitted for transaction ${data.transactionId}`);

  return { success: true, status: TRANSACTION_STATUSES.VERIFICATION_SUBMITTED };
});

export const verificationApprove = functions.https.onCall(async (data, context) => {
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
      'Only admins can approve verification'
    );
  }

  if (!data.transactionId || typeof data.transactionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'transactionId is required');
  }

  const transactionDoc = await db.collection('transactions').doc(data.transactionId).get();
  if (!transactionDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Transaction not found');
  }

  const transaction = transactionDoc.data()!;
  if (transaction.status !== TRANSACTION_STATUSES.VERIFICATION_SUBMITTED) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Transaction must be in verification_submitted status, current: ${transaction.status}`
    );
  }

  await transactionDoc.ref.update({
    status: TRANSACTION_STATUSES.VERIFIED,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await logTransactionStatusChange(
    data.transactionId,
    TRANSACTION_STATUSES.VERIFICATION_SUBMITTED,
    TRANSACTION_STATUSES.VERIFIED,
    uid
  );

  await logVerificationAction(data.transactionId, 'approved', uid);

  functions.logger.log(`[VERIFICATION] Approved for transaction ${data.transactionId}`);

  return { success: true, status: TRANSACTION_STATUSES.VERIFIED };
});

export const verificationReject = functions.https.onCall(async (data, context) => {
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
      'Only admins can reject verification'
    );
  }

  if (!data.transactionId || typeof data.transactionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'transactionId is required');
  }

  const transactionDoc = await db.collection('transactions').doc(data.transactionId).get();
  if (!transactionDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Transaction not found');
  }

  const transaction = transactionDoc.data()!;
  if (transaction.status !== TRANSACTION_STATUSES.VERIFICATION_SUBMITTED) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Transaction must be in verification_submitted status, current: ${transaction.status}`
    );
  }

  await transactionDoc.ref.update({
    status: TRANSACTION_STATUSES.VERIFICATION_REJECTED,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await logTransactionStatusChange(
    data.transactionId,
    TRANSACTION_STATUSES.VERIFICATION_SUBMITTED,
    TRANSACTION_STATUSES.VERIFICATION_REJECTED,
    uid
  );

  await logVerificationAction(data.transactionId, 'rejected', uid);

  functions.logger.log(`[VERIFICATION] Rejected for transaction ${data.transactionId}`);

  return { success: true, status: TRANSACTION_STATUSES.VERIFICATION_REJECTED };
});
