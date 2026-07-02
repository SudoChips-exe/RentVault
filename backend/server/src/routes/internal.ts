import { Router } from 'express';
import * as admin from 'firebase-admin';
import { TRANSACTION_STATUSES } from '../models';
import { logTransactionStatusChange } from '../audit-logger';
import { processRefund } from '../refund';
import { requireInternalSecret, asyncRoute } from '../middleware';

const db = admin.firestore();

export const internalRouter = Router();

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

  const timeoutPromises = expiredTransactions.docs.map(async (doc) => {
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
