import { describe, expect, test, beforeAll } from 'bun:test';
import { NombaClient } from '../nomba-client';

describe('NombaClient webhook signature validation', () => {
  let client: NombaClient;

  beforeAll(() => {
    client = new NombaClient({
      parentAccountId: 'test_parent',
      subAccountId: 'test_sub',
      clientId: 'test_client',
      privateKey: 'test_key',
      webhookSecret: 'test_webhook_secret',
      baseUrl: 'https://api.sandbox.nomba.com/v1',
    });
  });

  test('validates correct signature', () => {
    const payload = JSON.stringify({
      event: 'checkout.success',
      data: { reference: 'RENT-123456-ABC123' },
    });
    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', 'test_webhook_secret')
      .update(payload)
      .digest('hex');

    expect(client.validateWebhookSignature(payload, signature)).toBe(true);
  });

  test('rejects invalid signature', () => {
    const payload = JSON.stringify({
      event: 'checkout.success',
      data: { reference: 'RENT-123456-ABC123' },
    });

    expect(client.validateWebhookSignature(payload, 'invalid_signature')).toBe(false);
  });

  test('rejects empty signature', () => {
    const payload = JSON.stringify({
      event: 'checkout.success',
      data: { reference: 'RENT-123456-ABC123' },
    });

    expect(client.validateWebhookSignature(payload, '')).toBe(false);
  });

  test('signature is deterministic for same payload', () => {
    const payload = JSON.stringify({
      event: 'checkout.success',
      data: { reference: 'RENT-123456-ABC123' },
    });
    const crypto = require('crypto');
    const sig1 = crypto
      .createHmac('sha256', 'test_webhook_secret')
      .update(payload)
      .digest('hex');
    const sig2 = crypto
      .createHmac('sha256', 'test_webhook_secret')
      .update(payload)
      .digest('hex');

    expect(sig1).toBe(sig2);
  });

  test('different payload produces different signature', () => {
    const crypto = require('crypto');
    const payload1 = JSON.stringify({ event: 'checkout.success' });
    const payload2 = JSON.stringify({ event: 'transfer.success' });
    const sig1 = crypto
      .createHmac('sha256', 'test_webhook_secret')
      .update(payload1)
      .digest('hex');
    const sig2 = crypto
      .createHmac('sha256', 'test_webhook_secret')
      .update(payload2)
      .digest('hex');

    expect(sig1).not.toBe(sig2);
  });
});
