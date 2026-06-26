import { describe, expect, test } from 'bun:test';
import {
  validateTransactionStatusTransition,
  TRANSACTION_STATUSES,
} from '../models';

describe('Verification workflow - status transitions', () => {
  test('funds_held -> verification_submitted is valid', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.FUNDS_HELD,
        TRANSACTION_STATUSES.VERIFICATION_SUBMITTED
      )
    ).toBe(true);
  });

  test('funds_held -> verification_timeout is valid', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.FUNDS_HELD,
        TRANSACTION_STATUSES.VERIFICATION_TIMEOUT
      )
    ).toBe(true);
  });

  test('verification_submitted -> verified is valid', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.VERIFICATION_SUBMITTED,
        TRANSACTION_STATUSES.VERIFIED
      )
    ).toBe(true);
  });

  test('verification_submitted -> verification_rejected is valid', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.VERIFICATION_SUBMITTED,
        TRANSACTION_STATUSES.VERIFICATION_REJECTED
      )
    ).toBe(true);
  });

  test('funds_held directly to verified is NOT valid (skips submission)', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.FUNDS_HELD,
        TRANSACTION_STATUSES.VERIFIED
      )
    ).toBe(false);
  });

  test('tenant cannot skip verification_submitted', () => {
    const validFromFundsHeld = ['verification_submitted', 'verification_timeout', 'refund_initiated'];
    const allStatuses = Object.values(TRANSACTION_STATUSES);
    for (const status of allStatuses) {
      if (!validFromFundsHeld.includes(status)) {
        expect(
          validateTransactionStatusTransition('funds_held', status)
        ).toBe(false);
      }
    }
  });

  test('verified leads to disbursement_pending', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.VERIFIED,
        TRANSACTION_STATUSES.DISBURSEMENT_PENDING
      )
    ).toBe(true);
  });
});
