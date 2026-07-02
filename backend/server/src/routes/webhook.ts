import { Router } from 'express';
import express from 'express';
import * as admin from 'firebase-admin';
import { nombaClient } from '../nomba-client';
import { TRANSACTION_STATUSES } from '../models';
import { logTransactionStatusChange, logWebhookEvent } from '../audit-logger';
import { webhookRateLimit } from '../middleware';
import { config } from '../config';

const db = admin.firestore();

export const webhookRouter = Router();

// Nomba signs the raw request body, so this route needs the unparsed body -
// mounted with express.raw() instead of the app-wide express.json() parser.
webhookRouter.post('/webhook-listener', webhookRateLimit, express.raw({ type: '*/*' }), async (req, res) => {
  const startTime = Date.now();

  try {
    const signature = req.headers['x-nomba-signature'] as string;
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

    if (!signature) {
      console.error('[WEBHOOK] Missing signature header');
      const parsedForLog = safeParse(rawBody);
      await logWebhookEvent('unknown', 'unknown', 'missing_signature', parsedForLog);
      res.status(400).send({ error: 'Missing signature' });
      return;
    }

    const isValid = nombaClient.validateWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.error('[WEBHOOK] Invalid signature');
      const parsedForLog = safeParse(rawBody);
      await logWebhookEvent('unknown', 'unknown', 'invalid_signature', parsedForLog);
      res.status(400).send({ error: 'Invalid signature' });
      return;
    }

    const payload = JSON.parse(rawBody);
    const eventType: string = payload.event || payload.event_type || payload.type;
    const transactionReference: string =
      payload.data?.reference ||
      payload.reference ||
      payload.data?.transaction_reference ||
      '';

    if (!eventType) {
      console.warn('[WEBHOOK] Unknown event type', payload);
      res.status(200).send({ received: true });
      return;
    }

    console.log(`[WEBHOOK] Received ${eventType} for ${transactionReference}`);

    await logWebhookEvent(eventType, transactionReference, 'valid', payload);

    // The dedup marker is only written *after* processing succeeds (see
    // bottom of the switch below) - if it were written up front and
    // processing then failed, a retried delivery would be swallowed as
    // "already processed" and the event would be lost for good instead of
    // safely reprocessed.
    const eventId = payload.id || payload.event_id || '';
    const dedupRef = eventId ? db.collection('webhookEvents').doc(eventId) : undefined;
    if (dedupRef) {
      const dedupDoc = await dedupRef.get();
      if (dedupDoc.exists) {
        console.log(`[WEBHOOK] Duplicate event ${eventId}, skipping`);
        res.status(200).send({ received: true, deduplicated: true });
        return;
      }
    }

    const transactionsQuery = await db
      .collection('transactions')
      .where('transactionReference', '==', transactionReference)
      .limit(1)
      .get();

    if (transactionsQuery.empty) {
      console.warn(`[WEBHOOK] Unknown transaction reference: ${transactionReference}`, payload);
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
        // Countdown starts once funds actually land in escrow, not at
        // checkout initiation - read by the landlord/tenant "verification
        // deadline" countdown UI and by the timeout checker (internal.ts).
        const verificationDeadline = admin.firestore.Timestamp.fromMillis(
          Date.now() + config.verification.timeoutHours * 60 * 60 * 1000
        );

        await transactionRef.update({
          status: TRANSACTION_STATUSES.FUNDS_HELD,
          nombaPaymentReference: paymentReference,
          amount: paymentAmount,
          verificationDeadline,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await logTransactionStatusChange(
          transactionDoc.id,
          TRANSACTION_STATUSES.PENDING_PAYMENT,
          TRANSACTION_STATUSES.FUNDS_HELD,
          `webhook:${eventId}`
        );

        console.log(`[WEBHOOK] Payment confirmed for ${transactionReference}, status -> funds_held`);
        break;
      }

      case 'transfer.success': {
        const transferReference = payload.data?.reference || payload.reference || '';
        const recipientType = payload.data?.recipient_type || '';
        void transferReference;

        await transactionRef.update({
          [`disbursements.${recipientType}.status`]: 'disbursed',
          [`disbursements.${recipientType}.updatedAt`]: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const disbursements = (await transactionRef.get()).data()?.disbursements || {};
        const allDisbursed = Object.values(disbursements as Record<string, { status?: string }>)
          .every((d) => d.status === 'disbursed');

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

          console.log(`[WEBHOOK] All transfers completed for ${transactionReference}`);
        }
        break;
      }

      case 'transfer.failed': {
        const failedRecipientType = payload.data?.recipient_type || '';

        await transactionRef.update({
          [`disbursements.${failedRecipientType}.status`]: 'transfer_failed',
          [`disbursements.${failedRecipientType}.updatedAt`]: admin.firestore.FieldValue.serverTimestamp(),
          status: TRANSACTION_STATUSES.DISBURSEMENT_PARTIAL_FAILURE,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await logTransactionStatusChange(
          transactionDoc.id,
          TRANSACTION_STATUSES.DISBURSEMENT_PENDING,
          TRANSACTION_STATUSES.DISBURSEMENT_PARTIAL_FAILURE,
          `webhook:${eventId}`
        );

        console.error(`[WEBHOOK] Transfer failed for ${transactionReference}, recipient: ${failedRecipientType}`);
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

        console.log(`[WEBHOOK] Refund completed for ${transactionReference}`);
        break;
      }

      default: {
        console.log(`[WEBHOOK] Unhandled event type: ${eventType} for ${transactionReference}`);
      }
    }

    if (dedupRef) {
      await dedupRef.set({
        eventId,
        eventType,
        transactionReference,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const elapsed = Date.now() - startTime;
    console.log(`[WEBHOOK] Processed in ${elapsed}ms`);

    res.status(200).send({ received: true });
  } catch (error) {
    // Genuine processing failures (e.g. a Firestore write hiccup) get a 5xx
    // so Nomba retries the delivery - malformed/duplicate/unknown-reference
    // requests are all handled above with explicit early 200/400 returns and
    // never reach this catch.
    console.error('[WEBHOOK] Error processing webhook', error);
    res.status(500).send({ error: 'internal_error' });
  }
});

function safeParse(rawBody: string): Record<string, unknown> {
  try {
    return JSON.parse(rawBody);
  } catch {
    return { raw: rawBody };
  }
}
