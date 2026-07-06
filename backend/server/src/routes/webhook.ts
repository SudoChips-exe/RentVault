import { Router } from 'express';
import express from 'express';
import * as admin from 'firebase-admin';
import { nombaClient } from '../nomba-client';
import { TRANSACTION_STATUSES } from '../models';
import { logTransactionStatusChange, logWebhookEvent } from '../audit-logger';
import { webhookRateLimit } from '../middleware';
import { confirmPaymentReceived } from '../payment-confirmation';

const db = admin.firestore();

export const webhookRouter = Router();

// Nomba signs the raw request body, so this route needs the unparsed body -
// mounted with express.raw() instead of the app-wide express.json() parser.
webhookRouter.post('/webhooks/nomba', webhookRateLimit, express.raw({ type: '*/*' }), async (req, res) => {
  const startTime = Date.now();

  try {
    const signature = req.headers['nomba-signature'] as string;
    const timestamp = req.headers['nomba-timestamp'] as string;
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

    if (!signature || !timestamp) {
      console.error('[WEBHOOK] Missing signature or timestamp header');
      const parsedForLog = safeParse(rawBody);
      await logWebhookEvent('unknown', 'unknown', 'missing_signature', parsedForLog);
      res.status(400).send({ error: 'Missing signature' });
      return;
    }

    const isValid = nombaClient.validateWebhookSignature(rawBody, signature, timestamp);
    if (!isValid) {
      console.error('[WEBHOOK] Invalid signature');
      const parsedForLog = safeParse(rawBody);
      await logWebhookEvent('unknown', 'unknown', 'invalid_signature', parsedForLog);
      res.status(400).send({ error: 'Invalid signature' });
      return;
    }

    const payload = JSON.parse(rawBody);
    // Real Nomba event names (see developer.nomba.com/docs/api-basics/webhook)
    // - not the checkout.success/transfer.success/refund.complete names this
    // handler previously assumed.
    const eventType: string = payload.event_type || '';
    const merchant = payload.data?.merchant || {};
    const txn = payload.data?.transaction || {};
    // No confirmed example of a card/checkout webhook payload was available
    // when this was written (Nomba's docs only show a virtual-account
    // example) - verify this fallback chain against a real sandbox test
    // delivery before relying on it in production.
    const orderReference: string =
      txn.merchantTxRef || txn.orderReference || txn.sessionId || txn.aliasAccountReference || '';

    if (!eventType) {
      console.warn('[WEBHOOK] Unknown event type', payload);
      res.status(200).send({ received: true });
      return;
    }

    console.log(`[WEBHOOK] Received ${eventType} for ${orderReference}`);

    await logWebhookEvent(eventType, orderReference, 'valid', payload);

    // The dedup marker is only written *after* processing succeeds (see
    // bottom of the switch below) - if it were written up front and
    // processing then failed, a retried delivery would be swallowed as
    // "already processed" and the event would be lost for good instead of
    // safely reprocessed.
    const eventId = payload.requestId || '';
    const dedupRef = eventId ? db.collection('webhookEvents').doc(eventId) : undefined;
    if (dedupRef) {
      const dedupDoc = await dedupRef.get();
      if (dedupDoc.exists) {
        console.log(`[WEBHOOK] Duplicate event ${eventId}, skipping`);
        res.status(200).send({ received: true, deduplicated: true });
        return;
      }
    }

    switch (eventType) {
      case 'payment_success': {
        const transactionsQuery = await db
          .collection('transactions')
          .where('transactionReference', '==', orderReference)
          .limit(1)
          .get();

        if (transactionsQuery.empty) {
          console.warn(`[WEBHOOK] Unknown transaction reference: ${orderReference}`, payload);
          res.status(200).send({ received: true });
          return;
        }

        const transactionDoc = transactionsQuery.docs[0];
        const transaction = transactionDoc.data();
        const paymentAmount = txn.transactionAmount || transaction.amount;

        await confirmPaymentReceived(
          transactionDoc.id,
          paymentAmount,
          txn.transactionId || '',
          `webhook:${eventId}`
        );

        console.log(`[WEBHOOK] Payment confirmed for ${orderReference}, status -> funds_held`);
        break;
      }

      case 'payout_success':
      case 'payout_failed': {
        // Disbursement transfers use our own reference scheme
        // `DISP-{transactionId}-{LORD|AGENT|PLAT}-{timestamp}` (see
        // disbursement.ts) so the transactionId and recipient are parsed
        // straight out of merchantTxRef instead of looked up by query -
        // Nomba has no concept of our landlord/agent/platform split.
        const match = /^DISP-(.+)-(LORD|AGENT|PLAT)-\d+$/.exec(txn.merchantTxRef || '');
        if (!match) {
          console.warn(`[WEBHOOK] Unrecognized payout reference: ${txn.merchantTxRef}`, payload);
          res.status(200).send({ received: true });
          return;
        }
        const [, transactionId, tag] = match;
        const recipientType = { LORD: 'landlord', AGENT: 'agent', PLAT: 'platform' }[tag]!;

        const transactionRef = db.collection('transactions').doc(transactionId);
        const transactionSnap = await transactionRef.get();
        if (!transactionSnap.exists) {
          console.warn(`[WEBHOOK] Unknown transaction ${transactionId} for payout ${txn.merchantTxRef}`);
          res.status(200).send({ received: true });
          return;
        }

        if (eventType === 'payout_failed') {
          await transactionRef.update({
            [`disbursements.${recipientType}.status`]: 'transfer_failed',
            [`disbursements.${recipientType}.updatedAt`]: admin.firestore.FieldValue.serverTimestamp(),
            status: TRANSACTION_STATUSES.DISBURSEMENT_PARTIAL_FAILURE,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          await logTransactionStatusChange(
            transactionId,
            TRANSACTION_STATUSES.DISBURSEMENT_PENDING,
            TRANSACTION_STATUSES.DISBURSEMENT_PARTIAL_FAILURE,
            `webhook:${eventId}`
          );

          console.error(`[WEBHOOK] Transfer failed for ${transactionId}, recipient: ${recipientType}`);
          break;
        }

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
            transactionId,
            TRANSACTION_STATUSES.DISBURSEMENT_PENDING,
            TRANSACTION_STATUSES.COMPLETED,
            `webhook:${eventId}`
          );

          console.log(`[WEBHOOK] All transfers completed for ${transactionId}`);
        }
        break;
      }

      case 'payment_reversal': {
        const transactionsQuery = await db
          .collection('transactions')
          .where('transactionReference', '==', orderReference)
          .limit(1)
          .get();

        if (transactionsQuery.empty) {
          console.warn(`[WEBHOOK] Unknown transaction reference: ${orderReference}`, payload);
          res.status(200).send({ received: true });
          return;
        }

        const transactionDoc = transactionsQuery.docs[0];

        await transactionDoc.ref.update({
          status: TRANSACTION_STATUSES.REFUNDED,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await logTransactionStatusChange(
          transactionDoc.id,
          TRANSACTION_STATUSES.REFUND_INITIATED,
          TRANSACTION_STATUSES.REFUNDED,
          `webhook:${eventId}`
        );

        console.log(`[WEBHOOK] Refund completed for ${orderReference}`);
        break;
      }

      default: {
        console.log(`[WEBHOOK] Unhandled event type: ${eventType} for ${orderReference}`);
      }
    }

    if (dedupRef) {
      await dedupRef.set({
        eventId,
        eventType,
        orderReference,
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
