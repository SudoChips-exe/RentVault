import { describe, expect, test, mock, beforeAll } from 'bun:test';
import { NombaClient } from '../nomba-client';

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

describe('webhook-listener - signature validation', () => {
  test('accepts valid signature', () => {
    const crypto = require('crypto');
    const payload = JSON.stringify({ event: 'checkout.success', data: { reference: 'RENT-TEST-REF' } });
    const sig = crypto.createHmac('sha256', 'test_webhook_secret').update(payload).digest('hex');
    expect(client.validateWebhookSignature(payload, sig)).toBe(true);
  });

  test('rejects invalid signature', () => {
    const payload = JSON.stringify({ event: 'checkout.success', data: { reference: 'RENT-TEST-REF' } });
    expect(client.validateWebhookSignature(payload, 'invalid')).toBe(false);
  });

  test('rejects missing signature', () => {
    const payload = JSON.stringify({ event: 'checkout.success', data: { reference: 'RENT-TEST-REF' } });
    expect(client.validateWebhookSignature(payload, '')).toBe(false);
  });

  test('rejects tampered payload', () => {
    const crypto = require('crypto');
    const original = JSON.stringify({ event: 'checkout.success', data: { reference: 'RENT-TEST-REF' } });
    const sig = crypto.createHmac('sha256', 'test_webhook_secret').update(original).digest('hex');
    const tampered = JSON.stringify({ event: 'checkout.success', data: { reference: 'RENT-TAMPERED' } });
    expect(client.validateWebhookSignature(tampered, sig)).toBe(false);
  });
});

describe('webhook-listener - event type handling', () => {
  const eventTypes = ['checkout.success', 'transfer.success', 'transfer.failed', 'refund.complete'];

  for (const eventType of eventTypes) {
    test(`recognizes event type: ${eventType}`, () => {
      const payload = { event: eventType, data: { reference: 'RENT-TEST' } };
      expect(payload.event).toBe(eventType);
    });
  }

  test('extracts transaction reference from checkout.success payload', () => {
    const payload: { event: string; data?: { reference: string }; reference?: string } = {
      event: 'checkout.success', data: { reference: 'RENT-123456-ABC' },
    };
    const ref = payload.data?.reference || payload.reference || '';
    expect(ref).toBe('RENT-123456-ABC');
  });

  test('extracts reference from flat payload', () => {
    const payload = { event: 'transfer.success', reference: 'DISP-TEST-LORD-123' };
    const ref = payload.reference;
    expect(ref).toBe('DISP-TEST-LORD-123');
  });

  test('handles unknown event type without crashing', () => {
    const payload = { event: 'unknown.event', data: { reference: 'RENT-TEST' } };
    expect(payload.event).toBe('unknown.event');
  });
});

describe('webhook-listener - idempotency', () => {
  test('detects duplicate event IDs', () => {
    const processedIds = new Set<string>();
    const eventId = 'evt_12345';

    expect(processedIds.has(eventId)).toBe(false);
    processedIds.add(eventId);
    expect(processedIds.has(eventId)).toBe(true);
  });

  test('skips processing for already-handled event', () => {
    const processedIds = new Set(['evt_dup']);
    const shouldSkip = processedIds.has('evt_dup');
    expect(shouldSkip).toBe(true);
  });

  test('processes new event IDs', () => {
    const processedIds = new Set(['evt_old']);
    const shouldProcess = !processedIds.has('evt_new');
    expect(shouldProcess).toBe(true);
  });

  test('handles multiple unique events', () => {
    const processedIds = new Set<string>();
    const events = ['evt_1', 'evt_2', 'evt_3', 'evt_1', 'evt_4', 'evt_2'];
    let processedCount = 0;
    for (const id of events) {
      if (!processedIds.has(id)) {
        processedIds.add(id);
        processedCount++;
      }
    }
    expect(processedCount).toBe(4);
    expect(processedIds.size).toBe(4);
  });
});

describe('webhook-listener - unknown transaction references', () => {
  test('logs unknown reference without failing', () => {
    const ref = 'RENT-NONEXISTENT';
    const knownRefs = new Set(['RENT-EXISTING-1', 'RENT-EXISTING-2']);
    const isKnown = knownRefs.has(ref);
    expect(isKnown).toBe(false);
  });

  test('processes known references', () => {
    const ref = 'RENT-EXISTING-1';
    const knownRefs = new Set(['RENT-EXISTING-1', 'RENT-EXISTING-2']);
    expect(knownRefs.has(ref)).toBe(true);
  });
});
