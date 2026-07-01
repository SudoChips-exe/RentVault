import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

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
      'Only admins can access this endpoint'
    );
  }

  return uid;
}

export const getAuditLogs = functions.https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const pageSize = Math.min(data.pageSize || 50, 100);
  const page = data.page || 1;

  let query: admin.firestore.Query = db.collection('auditLogs').orderBy('timestamp', 'desc');

  if (data.transactionId) {
    query = query.where('transactionId', '==', data.transactionId);
  }

  if (data.eventType) {
    query = query.where('eventType', '==', data.eventType);
  }

  if (data.actor) {
    query = query.where('actor', '==', data.actor);
  }

  if (data.startDate) {
    const startDate = new Date(data.startDate);
    query = query.where('timestamp', '>=', startDate);
  }

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
    const data = doc.data();
    const metadata = data.metadata || {};
    // eventType is one of a handful of generic buckets - surface the more
    // specific status/action from metadata when available so the admin UI
    // can show (and color-code) something meaningful instead of e.g.
    // "transaction_status_change" for every row.
    const action =
      (data.eventType === 'transaction_status_change' && metadata.newStatus) ||
      (data.eventType === 'verification_action' && metadata.action) ||
      data.eventType;

    return {
      id: doc.id,
      logId: doc.id,
      action,
      performedBy: data.actor,
      targetId: data.transactionId || '-',
      details: data.description,
      createdAt: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
      eventType: data.eventType,
      metadata,
    };
  });

  return {
    logs,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
});

export const getAllTransactions = functions.https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const pageSize = Math.min(data.pageSize || 50, 100);
  const page = data.page || 1;

  let query: admin.firestore.Query = db.collection('transactions').orderBy('updatedAt', 'desc');

  if (data.status) {
    query = query.where('status', '==', data.status);
  }

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

  const userSnapshots = await db.getAll(
    ...Array.from(uids).map((uid) => db.collection('users').doc(uid))
  );

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

  return {
    transactions,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
});
