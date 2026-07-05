import { describe, expect, test, beforeAll } from 'bun:test';
import { NombaClient } from '../nomba-client';

// Builds a webhook payload + matching signature the way Nomba actually
// shapes them (see developer.nomba.com/docs/api-basics/webhook), not the
// event/data.reference shape this file used to assume.
function signedPayload(secret: string, overrides: Record<string, unknown> = {}) {
  const timestamp = '2026-01-01T00:00:00Z';
  const body = {
    event_type: 'payment_success',
    requestId: 'req-123',
    data: {
      merchant: { userId: 'user-1', walletId: 'wallet-1' },
      transaction: {
        transactionId: 'txn-1',
        type: 'checkout',
        time: '2026-01-01T00:00:00Z',
        responseCode: '',
        merchantTxRef: 'RENT-123456-ABC123',
      },
    },
    ...overrides,
  };
  const payload = JSON.stringify(body);
  const parsed = JSON.parse(payload);
  const merchant = parsed.data.merchant;
  const transaction = parsed.data.transaction;
  const hashingPayload = `${parsed.event_type}:${parsed.requestId}:${merchant.userId}:${merchant.walletId}:${transaction.transactionId}:${transaction.type}:${transaction.time}:${transaction.responseCode}:${timestamp}`;
  const crypto = require('crypto');
  const signature = crypto.createHmac('sha256', secret).update(hashingPayload).digest('base64');
  return { payload, signature, timestamp };
}

describe('NombaClient webhook signature validation', () => {
  let client: NombaClient;

  beforeAll(() => {
    client = new NombaClient({
      parentAccountId: 'test_parent',
      subAccountId: 'test_sub',
      clientId: 'test_client',
      privateKey: 'test_key',
      webhookSecret: 'test_webhook_secret',
      baseUrl: 'https://sandbox.nomba.com',
    });
  });

  test('validates correct signature', () => {
    const { payload, signature, timestamp } = signedPayload('test_webhook_secret');
    expect(client.validateWebhookSignature(payload, signature, timestamp)).toBe(true);
  });

  test('rejects invalid signature', () => {
    const { payload, timestamp } = signedPayload('test_webhook_secret');
    expect(client.validateWebhookSignature(payload, 'invalid_signature', timestamp)).toBe(false);
  });

  test('rejects empty signature', () => {
    const { payload, timestamp } = signedPayload('test_webhook_secret');
    expect(client.validateWebhookSignature(payload, '', timestamp)).toBe(false);
  });

  test('rejects tampered payload', () => {
    const { payload, signature, timestamp } = signedPayload('test_webhook_secret');
    const tampered = payload.replace('txn-1', 'txn-2');
    expect(client.validateWebhookSignature(tampered, signature, timestamp)).toBe(false);
  });

  test('rejects mismatched timestamp', () => {
    const { payload, signature } = signedPayload('test_webhook_secret');
    expect(client.validateWebhookSignature(payload, signature, '2026-06-01T00:00:00Z')).toBe(false);
  });

  test('signature is deterministic for same payload', () => {
    const first = signedPayload('test_webhook_secret');
    const second = signedPayload('test_webhook_secret');
    expect(first.signature).toBe(second.signature);
  });

  test('different payload produces different signature', () => {
    const a = signedPayload('test_webhook_secret', { event_type: 'payment_success' });
    const b = signedPayload('test_webhook_secret', { event_type: 'payout_success' });
    expect(a.signature).not.toBe(b.signature);
  });

  test('fails closed when webhook secret is not configured', () => {
    const unconfigured = new NombaClient({
      parentAccountId: 'test_parent',
      subAccountId: 'test_sub',
      clientId: 'test_client',
      privateKey: 'test_key',
      webhookSecret: '',
      baseUrl: 'https://sandbox.nomba.com',
    });
    expect(unconfigured.validateWebhookSignature('{}', 'anything', '2026-01-01T00:00:00Z')).toBe(false);
  });
});
