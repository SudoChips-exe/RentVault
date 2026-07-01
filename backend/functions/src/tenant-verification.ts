import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createAuditLog } from './audit-logger';

const db = admin.firestore();

export const tenantVerificationSubmit = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in');
  }

  const uid = context.auth.uid;
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User profile not found');
  }

  const user = userDoc.data()!;
  if (user.role !== 'tenant') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only tenants can submit tenant verification'
    );
  }

  if (!data.idDocumentUrl || typeof data.idDocumentUrl !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'idDocumentUrl is required');
  }

  if (!data.incomeProofUrl || typeof data.incomeProofUrl !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'incomeProofUrl is required');
  }

  await userDoc.ref.update({
    verificationStatus: 'pending',
    verificationDocuments: {
      idDocumentUrl: data.idDocumentUrl,
      incomeProofUrl: data.incomeProofUrl,
    },
    verificationRejectionReason: admin.firestore.FieldValue.delete(),
    verificationSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await createAuditLog({
    eventType: 'verification_action',
    actor: uid,
    description: `Tenant verification submitted by ${uid}`,
    metadata: { targetUid: uid, action: 'submitted' },
  });

  functions.logger.log(`[TENANT_VERIFICATION] Submitted by ${uid}`);

  return { success: true, status: 'pending' };
});

export const tenantVerificationApprove = functions.https.onCall(async (data, context) => {
  const adminUid = await verifyAdmin(context);

  if (!data.uid || typeof data.uid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required');
  }

  const targetRef = db.collection('users').doc(data.uid);
  const targetDoc = await targetRef.get();
  if (!targetDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Tenant not found');
  }

  const target = targetDoc.data()!;
  if (target.verificationStatus !== 'pending') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Tenant verification must be pending, current: ${target.verificationStatus || 'unverified'}`
    );
  }

  await targetRef.update({
    verificationStatus: 'approved',
    verificationReviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await createAuditLog({
    eventType: 'verification_action',
    actor: adminUid,
    description: `Tenant verification approved for ${data.uid}`,
    metadata: { targetUid: data.uid, action: 'approved' },
  });

  functions.logger.log(`[TENANT_VERIFICATION] Approved ${data.uid} by ${adminUid}`);

  return { success: true, status: 'approved' };
});

export const tenantVerificationReject = functions.https.onCall(async (data, context) => {
  const adminUid = await verifyAdmin(context);

  if (!data.uid || typeof data.uid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required');
  }

  const targetRef = db.collection('users').doc(data.uid);
  const targetDoc = await targetRef.get();
  if (!targetDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Tenant not found');
  }

  const target = targetDoc.data()!;
  if (target.verificationStatus !== 'pending') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Tenant verification must be pending, current: ${target.verificationStatus || 'unverified'}`
    );
  }

  await targetRef.update({
    verificationStatus: 'rejected',
    verificationRejectionReason: typeof data.reason === 'string' ? data.reason : 'Not specified',
    verificationReviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await createAuditLog({
    eventType: 'verification_action',
    actor: adminUid,
    description: `Tenant verification rejected for ${data.uid}`,
    metadata: { targetUid: data.uid, action: 'rejected', reason: data.reason },
  });

  functions.logger.log(`[TENANT_VERIFICATION] Rejected ${data.uid} by ${adminUid}`);

  return { success: true, status: 'rejected' };
});

async function verifyAdmin(context: functions.https.CallableContext): Promise<string> {
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
      'Only admins can review tenant verification'
    );
  }

  return uid;
}
