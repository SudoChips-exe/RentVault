import { Router } from 'express';
import * as admin from 'firebase-admin';
import { nombaClient } from '../nomba-client';
import { monnifyClient } from '../monnify-client';
import { TRANSACTION_STATUSES } from '../models';
import { confirmPaymentReceived } from '../payment-confirmation';
import { ApiError } from '../api-error';
import { requireAuth, asyncRoute, AuthedRequest, adminReadRateLimit } from '../middleware';

const db = admin.firestore();

export const reconcileRouter = Router();

// Lets the frontend poll for payment confirmation while a checkout is in
// progress, instead of only waiting on the webhook - useful since setting up
// the webhook requires Nomba dashboard access. adminReadRateLimit (60/min)
// since this is called repeatedly from the same pending-payment screen.
reconcileRouter.post('/checkPaymentStatus', adminReadRateLimit, requireAuth, asyncRoute(async (req: AuthedRequest, res) => {
  const uid = req.uid!;
  const { transactionId } = req.body;
  if (!transactionId || typeof transactionId !== 'string') {
    throw new ApiError('invalid-argument', 'transactionId is required');
  }

  const transactionRef = db.collection('transactions').doc(transactionId);
  const snap = await transactionRef.get();
  if (!snap.exists) throw new ApiError('not-found', 'Transaction not found');

  const transaction = snap.data()!;
  if (transaction.tenantUid !== uid) {
    throw new ApiError('permission-denied', 'You are not associated with this transaction');
  }

  if (transaction.status !== TRANSACTION_STATUSES.PENDING_PAYMENT) {
    res.json({ status: transaction.status });
    return;
  }

  const provider: 'nomba' | 'monnify' = transaction.paymentProvider || 'nomba';

  if (provider === 'monnify') {
    const match = await monnifyClient.findTransactionByReference(transaction.transactionReference);
    if (match && match.status === 'SUCCESS') {
      await confirmPaymentReceived(transactionId, match.amount, match.monnifyTransactionId, 'reconciliation:manual', 'monnify');
      res.json({ status: TRANSACTION_STATUSES.FUNDS_HELD });
      return;
    }
  } else {
    const match = await nombaClient.findTransactionByReference(transaction.transactionReference);
    if (match && match.status === 'SUCCESS') {
      await confirmPaymentReceived(transactionId, match.amount, match.nombaTransactionId, 'reconciliation:manual', 'nomba');
      res.json({ status: TRANSACTION_STATUSES.FUNDS_HELD });
      return;
    }
  }

  res.json({ status: transaction.status });
}));
