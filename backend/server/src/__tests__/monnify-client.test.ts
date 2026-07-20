import { describe, expect, test, beforeAll } from 'bun:test';
import { MonnifyClient } from '../monnify-client';

// Monnify signs SHA-512(secretKey + rawBody), hex-encoded, sent in the
// 'monnify-signature' header - see monnify-client.ts's validateWebhookSignature.
function signedPayload(secret: string, overrides: Record<string, unknown> = {}) {
  const body = {
    eventType: 'SUCCESSFUL_TRANSACTION',
    eventData: {
      paymentReference: 'RENT-123456-ABC123',
      transactionReference: 'MNFY|20260101|000123',
      amountPaid: 50000,
    },
    ...overrides,
  };
  const payload = JSON.stringify(body);
  const crypto = require('crypto');
  const signature = crypto.createHash('sha512').update(secret + payload).digest('hex');
  return { payload, signature };
}

describe('MonnifyClient webhook signature validation', () => {
  let client: MonnifyClient;

  beforeAll(() => {
    client = new MonnifyClient({
      contractCode: 'test_contract',
      apiKey: 'test_api_key',
      secretKey: 'test_secret_key',
      baseUrl: 'https://sandbox.monnify.com',
      sourceAccountNumber: 'test_source_account',
    });
  });

  test('validates correct signature', () => {
    const { payload, signature } = signedPayload('test_secret_key');
    expect(client.validateWebhookSignature(payload, signature)).toBe(true);
  });

  test('rejects invalid signature', () => {
    const { payload } = signedPayload('test_secret_key');
    expect(client.validateWebhookSignature(payload, 'aa'.repeat(64))).toBe(false);
  });

  test('rejects empty signature', () => {
    const { payload } = signedPayload('test_secret_key');
    expect(client.validateWebhookSignature(payload, '')).toBe(false);
  });

  test('rejects tampered payload', () => {
    const { payload, signature } = signedPayload('test_secret_key');
    const tampered = payload.replace('50000', '99999');
    expect(client.validateWebhookSignature(tampered, signature)).toBe(false);
  });

  test('signature is deterministic for same payload', () => {
    const first = signedPayload('test_secret_key');
    const second = signedPayload('test_secret_key');
    expect(first.signature).toBe(second.signature);
  });

  test('different payload produces different signature', () => {
    const a = signedPayload('test_secret_key', { eventType: 'SUCCESSFUL_TRANSACTION' });
    const b = signedPayload('test_secret_key', { eventType: 'SUCCESSFUL_DISBURSEMENT' });
    expect(a.signature).not.toBe(b.signature);
  });

  test('fails closed when secret key is not configured', () => {
    const unconfigured = new MonnifyClient({
      contractCode: 'test_contract',
      apiKey: 'test_api_key',
      secretKey: '',
      baseUrl: 'https://sandbox.monnify.com',
      sourceAccountNumber: 'test_source_account',
    });
    expect(unconfigured.validateWebhookSignature('{}', 'anything')).toBe(false);
  });
});
