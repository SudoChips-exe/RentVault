import { Router } from 'express';
import * as admin from 'firebase-admin';
import { ApiError } from '../api-error';
import { requireAuth, asyncRoute, AuthedRequest, adminReadRateLimit } from '../middleware';

const db = admin.firestore();

async function verifyAdmin(uid: string): Promise<string> {
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) throw new ApiError('permission-denied', 'User profile not found');

  const user = userDoc.data()!;
  if (user.role !== 'admin') {
    throw new ApiError('permission-denied', 'Only admins can access this endpoint');
  }
  return uid;
}

export const adminApiRouter = Router();

adminApiRouter.post('/getAuditLogs', requireAuth, adminReadRateLimit, asyncRoute(async (req: AuthedRequest, res) => {
  await verifyAdmin(req.uid!);

  const data = req.body || {};
  const pageSize = Math.min(data.pageSize || 50, 100);
  const page = data.page || 1;

  let query: admin.firestore.Query = db.collection('auditLogs').orderBy('timestamp', 'desc');

  if (data.transactionId) query = query.where('transactionId', '==', data.transactionId);
  if (data.eventType) query = query.where('eventType', '==', data.eventType);
  if (data.actor) query = query.where('actor', '==', data.actor);
  if (data.startDate) query = query.where('timestamp', '>=', new Date(data.startDate));
  if (data.endDate) {
    const endDate = new Date(data.endDate);
    endDate.setHours(23, 59, 59, 999);
    query = query.where('timestamp', '<=', endDate);
  }

  const totalSnapshot = await query.count().get();
  const totalCount = totalSnapshot.data().count;

  const offset = (page - 1) * pageSize;
  const snapshot = await query.offset(offset).limit(pageSize).get();

  const logs = snapshot.docs.map((doc) => {
    const logData = doc.data();
    const metadata = logData.metadata || {};
    // eventType is one of a handful of generic buckets - surface the more
    // specific status/action from metadata when available so the admin UI
    // can show (and color-code) something meaningful instead of e.g.
    // "transaction_status_change" for every row.
    const action =
      (logData.eventType === 'transaction_status_change' && metadata.newStatus) ||
      (logData.eventType === 'verification_action' && metadata.action) ||
      logData.eventType;

    return {
      id: doc.id,
      logId: doc.id,
      action,
      performedBy: logData.actor,
      targetId: logData.transactionId || '-',
      details: logData.description,
      createdAt: logData.timestamp?.toDate?.()?.toISOString() || logData.timestamp,
      eventType: logData.eventType,
      metadata,
    };
  });

  res.json({
    logs,
    pagination: { page, pageSize, totalCount, totalPages: Math.ceil(totalCount / pageSize) },
  });
}));

adminApiRouter.post('/getAllTransactions', requireAuth, adminReadRateLimit, asyncRoute(async (req: AuthedRequest, res) => {
  await verifyAdmin(req.uid!);

  const data = req.body || {};
  const pageSize = Math.min(data.pageSize || 50, 100);
  const page = data.page || 1;

  let query: admin.firestore.Query = db.collection('transactions').orderBy('updatedAt', 'desc');
  if (data.status) query = query.where('status', '==', data.status);

  const totalSnapshot = await query.count().get();
  const totalCount = totalSnapshot.data().count;

  const offset = (page - 1) * pageSize;
  const snapshot = await query.offset(offset).limit(pageSize).get();

  const uids = new Set<string>();
  snapshot.docs.forEach((doc) => {
    const t = doc.data();
    if (t.tenantUid) uids.add(t.tenantUid);
    if (t.landlordUid) uids.add(t.landlordUid);
    if (t.agentUid) uids.add(t.agentUid);
  });

  // Firestore.getAll() throws if called with zero refs (e.g. no
  // transactions yet, or none with tenant/landlord/agent uids set).
  const userSnapshots = uids.size > 0
    ? await db.getAll(...Array.from(uids).map((uid) => db.collection('users').doc(uid)))
    : [];

  const userMap: Record<string, string> = {};
  userSnapshots.forEach((snap) => {
    if (snap.exists) {
      const u = snap.data()!;
      userMap[snap.id] = u.displayName || u.email || snap.id;
    }
  });

  const transactions = snapshot.docs.map((doc) => {
    const t = doc.data();
    return {
      id: doc.id,
      transactionId: doc.id,
      ...t,
      tenantName: userMap[t.tenantUid] || t.tenantUid,
      landlordName: userMap[t.landlordUid] || t.landlordUid,
      agentName: t.agentUid ? userMap[t.agentUid] || t.agentUid : null,
      createdAt: t.createdAt?.toDate?.()?.toISOString() || t.createdAt,
      updatedAt: t.updatedAt?.toDate?.()?.toISOString() || t.updatedAt,
    };
  });

  res.json({
    transactions,
    pagination: { page, pageSize, totalCount, totalPages: Math.ceil(totalCount / pageSize) },
  });
}));
