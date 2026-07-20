import { Router } from 'express';
import * as admin from 'firebase-admin';
import { TRANSACTION_STATUSES } from '../models';
import { logTransactionStatusChange } from '../audit-logger';
import { processRefund } from '../refund';
import { nombaClient } from '../nomba-client';
import { monnifyClient } from '../monnify-client';
import { confirmPaymentReceived } from '../payment-confirmation';
import { requireInternalSecret, asyncRoute } from '../middleware';

const db = admin.firestore();

export const internalRouter = Router();

// Catches payments for tenants who closed the tab before checkPaymentStatus
// polling (reconcile.ts) could confirm it - same reconciliation fallback,
// swept across every still-pending transaction instead of just one.
internalRouter.post('/internal/reconcile-payments', requireInternalSecret, asyncRoute(async (_req, res) => {
  console.log('[RECONCILE] Sweeping pending_payment transactions');

  const pending = await db
    .collection('transactions')
    .where('status', '==', TRANSACTION_STATUSES.PENDING_PAYMENT)
    .get();

  let confirmed = 0;
  for (const doc of pending.docs) {
    const transaction = doc.data();
    const provider: 'nomba' | 'monnify' = transaction.paymentProvider || 'nomba';
    try {
      if (provider === 'monnify') {
        const match = await monnifyClient.findTransactionByReference(transaction.transactionReference);
        if (match && match.status === 'SUCCESS') {
          const didConfirm = await confirmPaymentReceived(
            doc.id,
            match.amount,
            match.monnifyTransactionId,
            'reconciliation:cron',
            'monnify'
          );
          if (didConfirm) confirmed++;
        }
      } else {
        const match = await nombaClient.findTransactionByReference(transaction.transactionReference);
        if (match && match.status === 'SUCCESS') {
          const didConfirm = await confirmPaymentReceived(
            doc.id,
            match.amount,
            match.nombaTransactionId,
            'reconciliation:cron',
            'nomba'
          );
          if (didConfirm) confirmed++;
        }
      }
    } catch (error) {
      console.error(`[RECONCILE] Failed to check transaction ${doc.id}`, error);
    }
  }

  console.log(`[RECONCILE] Checked ${pending.size}, confirmed ${confirmed}`);

  res.json({ checked: pending.size, confirmed });
}));

// Ported from the pubsub-scheduled verificationTimeoutScheduler (every 15
// min). Render's free tier has no cron jobs, so this is triggered externally
// by the GitHub Actions workflow in .github/workflows/timeout-check.yml,
// guarded by INTERNAL_CRON_SECRET instead of user auth.
internalRouter.post('/internal/check-timeouts', requireInternalSecret, asyncRoute(async (_req, res) => {
  console.log('[TIMEOUT] Checking for expired verifications');

  const expiredTransactions = await db
    .collection('transactions')
    .where('status', '==', TRANSACTION_STATUSES.FUNDS_HELD)
    .where('verificationDeadline', '<', new Date())
    .get();

  console.log(`[TIMEOUT] Found ${expiredTransactions.size} expired transactions`);

  const timeoutPromises = expiredTransactions.docs.map(async (doc: admin.firestore.QueryDocumentSnapshot) => {
    const transactionId = doc.id;
    try {
      await doc.ref.update({
        status: TRANSACTION_STATUSES.VERIFICATION_TIMEOUT,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await logTransactionStatusChange(
        transactionId,
        TRANSACTION_STATUSES.FUNDS_HELD,
        TRANSACTION_STATUSES.VERIFICATION_TIMEOUT,
        'system'
      );

      console.log(`[TIMEOUT] Transaction ${transactionId} timed out, triggering refund`);

      await processRefund(transactionId, 'system');
    } catch (error) {
      console.error(`[TIMEOUT] Failed to process timeout for transaction ${transactionId}`, error);
    }
  });

  await Promise.allSettled(timeoutPromises);

  console.log('[TIMEOUT] Verification timeout check complete');

  res.json({ checked: expiredTransactions.size });
}));
