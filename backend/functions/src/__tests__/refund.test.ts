import { describe, expect, test } from 'bun:test';
import {
  validateTransactionStatusTransition,
  TRANSACTION_STATUSES,
} from '../models';

describe('Refund workflow - status transitions', () => {
  test('verification_rejected -> refund_initiated is valid', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.VERIFICATION_REJECTED,
        TRANSACTION_STATUSES.REFUND_INITIATED
      )
    ).toBe(true);
  });

  test('verification_timeout -> refund_initiated is valid', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.VERIFICATION_TIMEOUT,
        TRANSACTION_STATUSES.REFUND_INITIATED
      )
    ).toBe(true);
  });

  test('funds_held -> refund_initiated is valid (manual refund)', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.FUNDS_HELD,
        TRANSACTION_STATUSES.REFUND_INITIATED
      )
    ).toBe(true);
  });

  test('verification_submitted -> refund_initiated is valid (manual refund)', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.VERIFICATION_SUBMITTED,
        TRANSACTION_STATUSES.REFUND_INITIATED
      )
    ).toBe(true);
  });

  test('refund_initiated -> refunded is valid', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.REFUND_INITIATED,
        TRANSACTION_STATUSES.REFUNDED
      )
    ).toBe(true);
  });

  test('refund_initiated -> refund_failed is valid', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.REFUND_INITIATED,
        TRANSACTION_STATUSES.REFUND_FAILED
      )
    ).toBe(true);
  });

  test('cannot refund completed transaction', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.COMPLETED,
        TRANSACTION_STATUSES.REFUND_INITIATED
      )
    ).toBe(false);
  });

  test('cannot refund already refunded transaction', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.REFUNDED,
        TRANSACTION_STATUSES.REFUND_INITIATED
      )
    ).toBe(false);
  });

  test('refund_failed is a terminal state', () => {
    expect(
      validateTransactionStatusTransition(
        TRANSACTION_STATUSES.REFUND_FAILED,
        TRANSACTION_STATUSES.REFUND_INITIATED
      )
    ).toBe(false);
  });
});
