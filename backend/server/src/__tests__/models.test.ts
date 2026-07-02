import { describe, expect, test } from 'bun:test';
import {
  validateSplitPercentages,
  validateTransactionStatusTransition,
  generateTransactionReference,
  calculateDisbursementAmounts,
  TRANSACTION_STATUSES,
} from '../models';

describe('validateSplitPercentages', () => {
  test('accepts valid 80-15-5 split', () => {
    expect(validateSplitPercentages(80, 15, 5)).toEqual({ valid: true });
  });

  test('accepts no-agent 95-5 split', () => {
    expect(validateSplitPercentages(95, 0, 5)).toEqual({ valid: true });
  });

  test('accepts 100-0-0 split', () => {
    expect(validateSplitPercentages(100, 0, 0)).toEqual({ valid: true });
  });

  test('rejects split not summing to 100', () => {
    const result = validateSplitPercentages(50, 20, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('100');
  });

  test('rejects negative percentages', () => {
    const result = validateSplitPercentages(80, 25, -5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('non-negative');
  });

  test('accepts fractional percentages summing to 100', () => {
    expect(validateSplitPercentages(33.33, 33.33, 33.34)).toEqual({ valid: true });
  });
});

describe('validateTransactionStatusTransition', () => {
  test('pending_payment -> funds_held is valid', () => {
    expect(validateTransactionStatusTransition('pending_payment', 'funds_held')).toBe(true);
  });

  test('funds_held -> verification_submitted is valid', () => {
    expect(validateTransactionStatusTransition('funds_held', 'verification_submitted')).toBe(true);
  });

  test('verification_submitted -> verified is valid', () => {
    expect(validateTransactionStatusTransition('verification_submitted', 'verified')).toBe(true);
  });

  test('verification_submitted -> verification_rejected is valid', () => {
    expect(validateTransactionStatusTransition('verification_submitted', 'verification_rejected')).toBe(true);
  });

  test('verified -> disbursement_pending is valid', () => {
    expect(validateTransactionStatusTransition('verified', 'disbursement_pending')).toBe(true);
  });

  test('refund_initiated -> refunded is valid', () => {
    expect(validateTransactionStatusTransition('refund_initiated', 'refunded')).toBe(true);
  });

  test('completed can transition to nothing', () => {
    expect(validateTransactionStatusTransition('completed', 'funds_held')).toBe(false);
  });

  test('pending_payment -> verified is invalid (skipping statuses)', () => {
    expect(validateTransactionStatusTransition('pending_payment', 'verified')).toBe(false);
  });

  test('refunded cannot transition further', () => {
    expect(validateTransactionStatusTransition('refunded', 'refund_initiated')).toBe(false);
  });

  // Regression test: refund.ts previously used a hand-maintained
  // REFUNDABLE_STATUSES list that omitted verification_timeout, so every
  // timeout-triggered auto-refund (internal.ts) silently failed its
  // precondition check. refund.ts now delegates to this function instead.
  test('verification_timeout -> refund_initiated is valid (auto-refund on timeout)', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.VERIFICATION_TIMEOUT,
        TRANSACTION_STATUSES.REFUND_INITIATED
      )
    ).toBe(true);
  });

  test('verification_rejected -> refund_initiated is valid', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.VERIFICATION_REJECTED,
        TRANSACTION_STATUSES.REFUND_INITIATED
      )
    ).toBe(true);
  });

  test('cannot refund an already-completed transaction', () => {
    expect(
      validateTransactionStatusTransition(TRANSACTION_STATUSES.COMPLETED, TRANSACTION_STATUSES.REFUND_INITIATED)
    ).toBe(false);
  });

  test('cannot approve verification twice (second concurrent call sees non-submitted status)', () => {
    // Simulates the race this transition-check now guards against in
    // verification.ts's verificationApprove: once a transaction is already
    // `verified`, a second concurrent approve attempt must be rejected.
    expect(validateTransactionStatusTransition(TRANSACTION_STATUSES.VERIFIED, TRANSACTION_STATUSES.VERIFIED)).toBe(
      false
    );
  });
});

describe('generateTransactionReference', () => {
  test('generates reference with RENT- prefix', () => {
    const ref = generateTransactionReference();
    expect(ref.startsWith('RENT-')).toBe(true);
  });

  test('generates references with timestamp and random string', () => {
    const ref = generateTransactionReference();
    const parts = ref.split('-');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('RENT');
    expect(parts[1]).toMatch(/^\d+$/);
    expect(parts[2].length).toBeGreaterThan(0);
  });

  test('generates unique references', () => {
    const refs = new Set(Array.from({ length: 100 }, () => generateTransactionReference()));
    expect(refs.size).toBe(100);
  });
});

describe('calculateDisbursementAmounts', () => {
  test('calculates 80-15-5 split correctly', () => {
    const result = calculateDisbursementAmounts(100000, {
      landlordPercentage: 80,
      agentPercentage: 15,
      platformPercentage: 5,
    });
    expect(result.landlordAmount).toBe(80000);
    expect(result.agentAmount).toBe(15000);
    expect(result.platformAmount).toBe(5000);
  });

  test('calculates no-agent 95-5 split correctly', () => {
    const result = calculateDisbursementAmounts(200000, {
      landlordPercentage: 95,
      agentPercentage: 0,
      platformPercentage: 5,
    });
    expect(result.landlordAmount).toBe(190000);
    expect(result.agentAmount).toBe(0);
    expect(result.platformAmount).toBe(10000);
  });

  test('handles rounding edge cases', () => {
    const result = calculateDisbursementAmounts(101, {
      landlordPercentage: 33.33,
      agentPercentage: 33.33,
      platformPercentage: 33.34,
    });
    const total = result.landlordAmount + result.agentAmount + result.platformAmount;
    expect(total).toBe(101);
  });

  test('rounds to integer minor units', () => {
    const result = calculateDisbursementAmounts(99, {
      landlordPercentage: 33,
      agentPercentage: 33,
      platformPercentage: 34,
    });
    expect(Number.isInteger(result.landlordAmount)).toBe(true);
    expect(Number.isInteger(result.agentAmount)).toBe(true);
    expect(Number.isInteger(result.platformAmount)).toBe(true);
  });

  test('throws on invalid split config', () => {
    expect(() =>
      calculateDisbursementAmounts(100000, {
        landlordPercentage: 50,
        agentPercentage: 20,
        platformPercentage: 10,
      })
    ).toThrow('100');
  });

  test('preserves total amount', () => {
    const amounts = [50000, 150000, 250000, 1000000];
    for (const amount of amounts) {
      const result = calculateDisbursementAmounts(amount, {
        landlordPercentage: 80,
        agentPercentage: 15,
        platformPercentage: 5,
      });
      const total = result.landlordAmount + result.agentAmount + result.platformAmount;
      expect(total).toBe(amount);
    }
  });
});
