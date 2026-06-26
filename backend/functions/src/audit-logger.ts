import * as admin from 'firebase-admin';
import { AuditEventType } from './models';

const db = admin.firestore();

export async function createAuditLog(params: {
  transactionId?: string;
  eventType: AuditEventType;
  actor: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const logEntry = {
    transactionId: params.transactionId || null,
    eventType: params.eventType,
    actor: params.actor,
    description: params.description,
    metadata: params.metadata || {},
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('auditLogs').add(logEntry);
}

export function logTransactionStatusChange(
  transactionId: string,
  previousStatus: string,
  newStatus: string,
  actor: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return createAuditLog({
    transactionId,
    eventType: 'transaction_status_change',
    actor,
    description: `Transaction status changed from ${previousStatus} to ${newStatus}`,
    metadata: {
      previousStatus,
      newStatus,
      ...metadata,
    },
  });
}

export function logNombaApiCall(
  endpoint: string,
  reference: string,
  httpStatus: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  return createAuditLog({
    eventType: 'nomba_api_call',
    actor: 'system',
    description: `Nomba API call to ${endpoint} for reference ${reference}`,
    metadata: {
      endpoint,
      reference,
      httpStatus,
      ...metadata,
    },
  });
}

export function logWebhookEvent(
  eventType: string,
  reference: string,
  validationResult: string,
  payload?: Record<string, unknown>
): Promise<void> {
  return createAuditLog({
    eventType: 'webhook_received',
    actor: 'webhook',
    description: `Webhook event ${eventType} for reference ${reference} (${validationResult})`,
    metadata: {
      webhookEventType: eventType,
      reference,
      validationResult,
      payload,
    },
  });
}

export function logVerificationAction(
  transactionId: string,
  action: string,
  actor: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return createAuditLog({
    transactionId,
    eventType: 'verification_action',
    actor,
    description: `Verification ${action} for transaction ${transactionId}`,
    metadata: {
      action,
      ...metadata,
    },
  });
}
