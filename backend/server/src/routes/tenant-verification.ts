import { Router } from 'express';
import * as admin from 'firebase-admin';
import { createAuditLog } from '../audit-logger';
import { ApiError } from '../api-error';
import { requireAuth, asyncRoute, AuthedRequest } from '../middleware';

const db = admin.firestore();

async function verifyAdmin(uid: string): Promise<string> {
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) throw new ApiError('permission-denied', 'User profile not found');

  const user = userDoc.data()!;
  if (user.role !== 'admin') {
    throw new ApiError('permission-denied', 'Only admins can review tenant verification');
  }
  return uid;
}

export const tenantVerificationRouter = Router();

tenantVerificationRouter.post('/tenantVerificationSubmit', requireAuth, asyncRoute(async (req: AuthedRequest, res) => {
  const uid = req.uid!;
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) throw new ApiError('permission-denied', 'User profile not found');

  const user = userDoc.data()!;
  if (user.role !== 'tenant') {
    throw new ApiError('permission-denied', 'Only tenants can submit tenant verification');
  }

  const { idDocumentUrl, incomeProofUrl } = req.body;
  if (!idDocumentUrl || typeof idDocumentUrl !== 'string') {
    throw new ApiError('invalid-argument', 'idDocumentUrl is required');
  }
  if (!incomeProofUrl || typeof incomeProofUrl !== 'string') {
    throw new ApiError('invalid-argument', 'incomeProofUrl is required');
  }

  await userDoc.ref.update({
    verificationStatus: 'pending',
    verificationDocuments: { idDocumentUrl, incomeProofUrl },
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

  console.log(`[TENANT_VERIFICATION] Submitted by ${uid}`);

  res.json({ success: true, status: 'pending' });
}));

tenantVerificationRouter.post('/tenantVerificationApprove', requireAuth, asyncRoute(async (req: AuthedRequest, res) => {
  const adminUid = await verifyAdmin(req.uid!);

  const { uid } = req.body;
  if (!uid || typeof uid !== 'string') {
    throw new ApiError('invalid-argument', 'uid is required');
  }

  const targetRef = db.collection('users').doc(uid);
  const targetDoc = await targetRef.get();
  if (!targetDoc.exists) throw new ApiError('not-found', 'Tenant not found');

  const target = targetDoc.data()!;
  if (target.verificationStatus !== 'pending') {
    throw new ApiError(
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
    description: `Tenant verification approved for ${uid}`,
    metadata: { targetUid: uid, action: 'approved' },
  });

  console.log(`[TENANT_VERIFICATION] Approved ${uid} by ${adminUid}`);

  res.json({ success: true, status: 'approved' });
}));

tenantVerificationRouter.post('/tenantVerificationReject', requireAuth, asyncRoute(async (req: AuthedRequest, res) => {
  const adminUid = await verifyAdmin(req.uid!);

  const { uid, reason } = req.body;
  if (!uid || typeof uid !== 'string') {
    throw new ApiError('invalid-argument', 'uid is required');
  }

  const targetRef = db.collection('users').doc(uid);
  const targetDoc = await targetRef.get();
  if (!targetDoc.exists) throw new ApiError('not-found', 'Tenant not found');

  const target = targetDoc.data()!;
  if (target.verificationStatus !== 'pending') {
    throw new ApiError(
      'failed-precondition',
      `Tenant verification must be pending, current: ${target.verificationStatus || 'unverified'}`
    );
  }

  await targetRef.update({
    verificationStatus: 'rejected',
    verificationRejectionReason: typeof reason === 'string' ? reason : 'Not specified',
    verificationReviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await createAuditLog({
    eventType: 'verification_action',
    actor: adminUid,
    description: `Tenant verification rejected for ${uid}`,
    metadata: { targetUid: uid, action: 'rejected', reason },
  });

  console.log(`[TENANT_VERIFICATION] Rejected ${uid} by ${adminUid}`);

  res.json({ success: true, status: 'rejected' });
}));
