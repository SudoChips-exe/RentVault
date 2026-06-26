import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { nombaClient } from './nomba-client';
import { TRANSACTION_STATUSES } from './models';
import {
  logTransactionStatusChange,
  logNombaApiCall,
  logWebhookEvent,
} from './audit-logger';

const db = admin.firestore();

export const webhookListener = functions.https.onRequest(async (req, res) => {
  const startTime = Date.now();

  try {
    const signature = req.headers['x-nomba-signature'] as string;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (!signature) {
      functions.logger.error('[WEBHOOK] Missing signature header');
      logWebhookEvent('unknown', 'unknown', 'missing_signature', req.body);
      res.status(400).send({ error: 'Missing signature' });
      return;
    }

    const isValid = nombaClient.validateWebhookSignature(rawBody, signature);
    if (!isValid) {
      functions.logger.error('[WEBHOOK] Invalid signature');
      logWebhookEvent('unknown', 'unknown', 'invalid_signature', req.body);
      res.status(400).send({ error: 'Invalid signature' });
      return;
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventType: string = payload.event || payload.event_type || payload.type;
    const transactionReference: string =
      payload.data?.reference ||
      payload.reference ||
      payload.data?.transaction_reference ||
      '';

    if (!eventType) {
      functions.logger.warn('[WEBHOOK] Unknown event type', payload);
      res.status(200).send({ received: true });
      return;
    }

    functions.logger.log(`[WEBHOOK] Received ${eventType} for ${transactionReference}`);

    logWebhookEvent(eventType, transactionReference, 'valid', payload);

    const eventId = payload.id || payload.event_id || '';
    if (eventId) {
      const dedupRef = db.collection('webhookEvents').doc(eventId);
      const dedupDoc = await dedupRef.get();
      if (dedupDoc.exists) {
        functions.logger.log(`[WEBHOOK] Duplicate event ${eventId}, skipping`);
        res.status(200).send({ received: true, deduplicated: true });
        return;
      }
      await dedupRef.set({
        eventId,
        eventType,
        transactionReference,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const transactionsQuery = await db
      .collection('transactions')
      .where('transactionReference', '==', transactionReference)
      .limit(1)
      .get();

    if (transactionsQuery.empty) {
      functions.logger.warn(
        `[WEBHOOK] Unknown transaction reference: ${transactionReference}`,
        payload
      );
      res.status(200).send({ received: true });
      return;
    }

    const transactionDoc = transactionsQuery.docs[0];
    const transactionRef = transactionDoc.ref;
    const transaction = transactionDoc.data();

    switch (eventType) {
      case 'checkout.success': {
        const paymentAmount = payload.data?.amount || transaction.amount;
        const paymentReference = payload.data?.payment_reference || payload.data?.reference || '';

        await transactionRef.update({
          status: TRANSACTION_STATUSES.FUNDS_HELD,
          nombaPaymentReference: paymentReference,
          amount: paymentAmount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await logTransactionStatusChange(
          transactionDoc.id,
          TRANSACTION_STATUSES.PENDING_PAYMENT,
          TRANSACTION_STATUSES.FUNDS_HELD,
          `webhook:${eventId}`
        );

        functions.logger.log(
          `[WEBHOOK] Payment confirmed for ${transactionReference}, status -> funds_held`
        );
        break;
      }

      case 'transfer.success': {
        const transferReference = payload.data?.reference || payload.reference || '';
        const recipientType = payload.data?.recipient_type || '';

        await transactionRef.update({
          [`disbursements.${recipientType}.status`]: 'disbursed',
          [`disbursements.${recipientType}.updatedAt`]: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const disbursements = (await transactionRef.get()).data()?.disbursements || {};
        const allDisbursed = Object.values(disbursements as Record<string, any>)
          .every((d: any) => d.status === 'disbursed');

        if (allDisbursed) {
          await transactionRef.update({
            status: TRANSACTION_STATUSES.COMPLETED,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          await logTransactionStatusChange(
            transactionDoc.id,
            TRANSACTION_STATUSES.DISBURSEMENT_PENDING,
            TRANSACTION_STATUSES.COMPLETED,
            `webhook:${eventId}`
          );

          functions.logger.log(
            `[WEBHOOK] All transfers completed for ${transactionReference}`
          );
        }
        break;
      }

      case 'transfer.failed': {
        const failedRecipientType = payload.data?.recipient_type || '';

        await transactionRef.update({
          [`disbursements.${failedRecipientType}.status`]: 'transfer_failed',
          [`disbursements.${failedRecipientType}.updatedAt`]:
            admin.firestore.FieldValue.serverTimestamp(),
          status: TRANSACTION_STATUSES.DISBURSEMENT_PARTIAL_FAILURE,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await logTransactionStatusChange(
          transactionDoc.id,
          TRANSACTION_STATUSES.DISBURSEMENT_PENDING,
          TRANSACTION_STATUSES.DISBURSEMENT_PARTIAL_FAILURE,
          `webhook:${eventId}`
        );

        functions.logger.error(
          `[WEBHOOK] Transfer failed for ${transactionReference}, recipient: ${failedRecipientType}`
        );
        break;
      }

      case 'refund.complete': {
        await transactionRef.update({
          status: TRANSACTION_STATUSES.REFUNDED,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await logTransactionStatusChange(
          transactionDoc.id,
          TRANSACTION_STATUSES.REFUND_INITIATED,
          TRANSACTION_STATUSES.REFUNDED,
          `webhook:${eventId}`
        );

        functions.logger.log(
          `[WEBHOOK] Refund completed for ${transactionReference}`
        );
        break;
      }

      default: {
        functions.logger.log(
          `[WEBHOOK] Unhandled event type: ${eventType} for ${transactionReference}`
        );
      }
    }

    const elapsed = Date.now() - startTime;
    functions.logger.log(`[WEBHOOK] Processed in ${elapsed}ms`);

    res.status(200).send({ received: true });
  } catch (error) {
    functions.logger.error('[WEBHOOK] Error processing webhook', error);
    res.status(200).send({ received: true });
  }
});
