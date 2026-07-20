import { Router } from 'express';
import express from 'express';
import * as admin from 'firebase-admin';
import { monnifyClient } from '../monnify-client';
import { TRANSACTION_STATUSES } from '../models';
import { logTransactionStatusChange, logWebhookEvent } from '../audit-logger';
import { webhookRateLimit } from '../middleware';
import { confirmPaymentReceived } from '../payment-confirmation';

const db = admin.firestore();

export const monnifyWebhookRouter = Router();

// Monnify signs the raw request body, so this route needs the unparsed body -
// same reasoning as webhook.ts's Nomba route.
//
// Payload shape below (eventType + eventData, paymentReference/amountPaid for
// collections, our own `reference` echoed back for disbursements) is based on
// Monnify's documented event categories, not a confirmed real sample - their
// docs describe the event categories (Successful Collection, Successful/
// Failed Disbursement, etc.) but no field-level JSON sample was available
// when this was written. Verify field names against a real sandbox webhook
// delivery before relying on this in production; reconciliation polling
// (reconcile.ts/internal.ts) is the safety net in the meantime, same as it
// already is for Nomba.
monnifyWebhookRouter.post('/webhooks/monnify', webhookRateLimit, express.raw({ type: '*/*' }), async (req, res) => {
  const startTime = Date.now();

  try {
    const signature = req.headers['monnify-signature'] as string;
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

    if (!signature) {
      console.error('[MONNIFY_WEBHOOK] Missing signature header');
      const parsedForLog = safeParse(rawBody);
      await logWebhookEvent('unknown', 'unknown', 'missing_signature', parsedForLog);
      res.status(400).send({ error: 'Missing signature' });
      return;
    }

    const isValid = monnifyClient.validateWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.error('[MONNIFY_WEBHOOK] Invalid signature');
      const parsedForLog = safeParse(rawBody);
      await logWebhookEvent('unknown', 'unknown', 'invalid_signature', parsedForLog);
      res.status(400).send({ error: 'Invalid signature' });
      return;
    }

    const payload = JSON.parse(rawBody);
    const eventType: string = payload.eventType || '';
    const eventData = payload.eventData || {};
    const paymentReference: string = eventData.paymentReference || eventData.reference || '';

    if (!eventType) {
      console.warn('[MONNIFY_WEBHOOK] Unknown event type', payload);
      res.status(200).send({ received: true });
      return;
    }

    console.log(`[MONNIFY_WEBHOOK] Received ${eventType} for ${paymentReference}`);

    await logWebhookEvent(eventType, paymentReference, 'valid', payload);

    // Dedup marker written only after processing succeeds - see webhook.ts
    // for why (a retried delivery must be reprocessed, not swallowed, if the
    // first attempt failed partway through).
    const eventId: string = payload.eventId || eventData.transactionReference || '';
    const dedupRef = eventId ? db.collection('webhookEvents').doc(`monnify:${eventId}`) : undefined;
    if (dedupRef) {
      const dedupDoc = await dedupRef.get();
      if (dedupDoc.exists) {
        console.log(`[MONNIFY_WEBHOOK] Duplicate event ${eventId}, skipping`);
        res.status(200).send({ received: true, deduplicated: true });
        return;
      }
    }

    switch (eventType) {
      case 'SUCCESSFUL_TRANSACTION':
      case 'SUCCESSFUL_COLLECTION': {
        const transactionsQuery = await db
          .collection('transactions')
          .where('transactionReference', '==', paymentReference)
          .limit(1)
          .get();

        if (transactionsQuery.empty) {
          console.warn(`[MONNIFY_WEBHOOK] Unknown transaction reference: ${paymentReference}`, payload);
          res.status(200).send({ received: true });
          return;
        }

        const transactionDoc = transactionsQuery.docs[0];
        const transaction = transactionDoc.data();
        const paymentAmount = eventData.amountPaid
          ? Math.round(eventData.amountPaid * 100)
          : transaction.amount;

        await confirmPaymentReceived(
          transactionDoc.id,
          paymentAmount,
          eventData.transactionReference || paymentReference,
          `webhook:monnify:${eventId}`,
          'monnify'
        );

        console.log(`[MONNIFY_WEBHOOK] Payment confirmed for ${paymentReference}, status -> funds_held`);
        break;
      }

      case 'SUCCESSFUL_DISBURSEMENT':
      case 'FAILED_DISBURSEMENT': {
        // Disbursement transfers use our own reference scheme
        // `DISP-{transactionId}-{LORD|AGENT|PLAT}-{timestamp}` (see
        // disbursement.ts) - Monnify echoes back whatever we sent as
        // `reference`, so the transactionId/recipient are parsed straight
        // out of it instead of looked up by query.
        const transferReference: string = eventData.reference || '';
        const match = /^DISP-(.+)-(LORD|AGENT|PLAT)-\d+$/.exec(transferReference);
        if (!match) {
          console.warn(`[MONNIFY_WEBHOOK] Unrecognized payout reference: ${transferReference}`, payload);
          res.status(200).send({ received: true });
          return;
        }
        const [, transactionId, tag] = match;
        const recipientType = { LORD: 'landlord', AGENT: 'agent', PLAT: 'platform' }[tag]!;

        const transactionRef = db.collection('transactions').doc(transactionId);
        const transactionSnap = await transactionRef.get();
        if (!transactionSnap.exists) {
          console.warn(`[MONNIFY_WEBHOOK] Unknown transaction ${transactionId} for payout ${transferReference}`);
          res.status(200).send({ received: true });
          return;
        }

        if (eventType === 'FAILED_DISBURSEMENT') {
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
            `webhook:monnify:${eventId}`
          );

          console.error(`[MONNIFY_WEBHOOK] Transfer failed for ${transactionId}, recipient: ${recipientType}`);
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
            `webhook:monnify:${eventId}`
          );

          console.log(`[MONNIFY_WEBHOOK] All transfers completed for ${transactionId}`);
        }
        break;
      }

      case 'SUCCESSFUL_REFUND': {
        const transactionsQuery = await db
          .collection('transactions')
          .where('transactionReference', '==', paymentReference)
          .limit(1)
          .get();

        if (transactionsQuery.empty) {
          console.warn(`[MONNIFY_WEBHOOK] Unknown transaction reference: ${paymentReference}`, payload);
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
          `webhook:monnify:${eventId}`
        );

        console.log(`[MONNIFY_WEBHOOK] Refund completed for ${paymentReference}`);
        break;
      }

      default: {
        console.log(`[MONNIFY_WEBHOOK] Unhandled event type: ${eventType} for ${paymentReference}`);
      }
    }

    if (dedupRef) {
      await dedupRef.set({
        eventId,
        eventType,
        paymentReference,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const elapsed = Date.now() - startTime;
    console.log(`[MONNIFY_WEBHOOK] Processed in ${elapsed}ms`);

    res.status(200).send({ received: true });
  } catch (error) {
    // Genuine processing failures get a 5xx so Monnify retries the delivery -
    // malformed/duplicate/unknown-reference requests are all handled above
    // with explicit early 200/400 returns and never reach this catch.
    console.error('[MONNIFY_WEBHOOK] Error processing webhook', error);
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
