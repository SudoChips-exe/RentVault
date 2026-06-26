import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { TRANSACTION_STATUSES } from './models';
import { logTransactionStatusChange } from './audit-logger';
import { processRefund } from './refund-trigger';

const db = admin.firestore();

export const verificationTimeoutScheduler = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    functions.logger.log('[TIMEOUT] Checking for expired verifications');

    const verificationTimeoutHours = functions.config().verification?.timeout_hours || 48;

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - verificationTimeoutHours);

    const expiredTransactions = await db
      .collection('transactions')
      .where('status', '==', TRANSACTION_STATUSES.FUNDS_HELD)
      .where('createdAt', '<', cutoffDate)
      .get();

    functions.logger.log(
      `[TIMEOUT] Found ${expiredTransactions.size} expired transactions`
    );

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

        functions.logger.log(
          `[TIMEOUT] Transaction ${transactionId} timed out, triggering refund`
        );

        await processRefund(transactionId, 'system');
      } catch (error) {
        functions.logger.error(
          `[TIMEOUT] Failed to process timeout for transaction ${transactionId}`,
          error
        );
      }
    });

    await Promise.allSettled(timeoutPromises);

    functions.logger.log('[TIMEOUT] Verification timeout check complete');
  });
