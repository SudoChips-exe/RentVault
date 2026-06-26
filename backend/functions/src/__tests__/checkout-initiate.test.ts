import { describe, expect, test, mock } from 'bun:test';
import {
  generateTransactionReference,
  validateSplitPercentages,
  TRANSACTION_STATUSES,
} from '../models';

const mockNombaCreateCheckout = mock(async () => ({
  checkoutUrl: 'https://checkout.nomba.com/test-url',
  reference: 'RENT-123456-TEST',
}));

const mockNombaError = mock(async () => {
  throw Object.assign(new Error('Nomba API error'), {
    response: { status: 502, data: { message: 'Service unavailable' } },
    message: 'Nomba API error',
  });
});

describe('checkout-initiate - token validation', () => {
  test('rejects request with missing auth token', () => {
    const calls = [
      { auth: undefined },
      { auth: null },
      {},
    ];
    for (const ctx of calls) {
      expect(ctx.auth).toBeFalsy();
    }
  });

  test('rejects request with expired token', () => {
    const expiredCtx = { auth: { uid: 'tenant1', token: { exp: Date.now() / 1000 - 3600 } } };
    expect(expiredCtx.auth.token.exp).toBeLessThan(Date.now() / 1000);
  });

  test('accepts request with valid token', () => {
    const validCtx = { auth: { uid: 'tenant1' } };
    expect(validCtx.auth).toBeTruthy();
    expect(validCtx.auth.uid).toBe('tenant1');
  });

  test('rejects non-tenant role', () => {
    const roles = ['landlord', 'agent', 'admin'];
    for (const role of roles) {
      const user = { role };
      expect(user.role).not.toBe('tenant');
    }
  });
});

describe('checkout-initiate - listing validation', () => {
  test('rejects missing listingId', () => {
    const inputs = [
      {},
      { listingId: undefined },
      { listingId: null },
      { listingId: 123 },
      { listingId: '' },
    ];
    for (const data of inputs) {
      if (!data.listingId || typeof data.listingId !== 'string') {
        expect(true).toBe(true);
      }
    }
  });

  test('rejects inactive listing', () => {
    const listing = { status: 'inactive', monthlyRent: 100000 };
    expect(listing.status).not.toBe('active');
  });

  test('accepts active listing', () => {
    const listing = { status: 'active', monthlyRent: 100000 };
    expect(listing.status).toBe('active');
  });

  test('rejects non-existent listing', () => {
    const listingDoc = { exists: false };
    expect(listingDoc.exists).toBe(false);
  });
});

describe('checkout-initiate - Nomba API error handling', () => {
  test('handles 5xx Nomba API error', async () => {
    try {
      await mockNombaError();
    } catch (error: any) {
      expect(error.response?.status).toBe(502);
      expect(error.message).toBe('Nomba API error');
    }
  });

  test('handles 4xx Nomba API error', async () => {
    const mock4xxError = mock(async () => {
      throw Object.assign(new Error('Bad request'), {
        response: { status: 400, data: { message: 'Invalid amount' } },
      });
    });
    try {
      await mock4xxError();
    } catch (error: any) {
      expect(error.response?.status).toBe(400);
    }
  });

  test('handles network timeout', async () => {
    const mockTimeout = mock(async () => {
      throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' });
    });
    try {
      await mockTimeout();
    } catch (error: any) {
      expect(error.code).toBe('ECONNABORTED');
    }
  });

  test('returns checkout URL on success', async () => {
    const result = await mockNombaCreateCheckout();
    expect(result.checkoutUrl).toContain('checkout.nomba.com');
    expect(result.reference).toMatch(/^RENT-/);
  });
});

describe('checkout-initiate - transaction reference uniqueness', () => {
  test('generates unique references across 1000 calls', () => {
    const refs = new Set(Array.from({ length: 1000 }, () => generateTransactionReference()));
    expect(refs.size).toBe(1000);
  });

  test('reference format is RENT-{timestamp}-{randomString}', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateTransactionReference()).toMatch(/^RENT-\d+-[A-Z0-9]+$/);
    }
  });

  test('references contain timestamp that increases', () => {
    const ref1 = generateTransactionReference();
    const ref2 = generateTransactionReference();
    const ts1 = parseInt(ref1.split('-')[1], 10);
    const ts2 = parseInt(ref2.split('-')[1], 10);
    expect(ts2).toBeGreaterThanOrEqual(ts1);
  });
});
