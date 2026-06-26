import { describe, expect, test } from 'bun:test';
import {
  calculateDisbursementAmounts,
  validateSplitPercentages,
} from '../models';

describe('Disbursement split calculation', () => {
  test('standard 80-15-5 split on 100,000 (kobo)', () => {
    const result = calculateDisbursementAmounts(100000, {
      landlordPercentage: 80,
      agentPercentage: 15,
      platformPercentage: 5,
    });
    expect(result.landlordAmount).toBe(80000);
    expect(result.agentAmount).toBe(15000);
    expect(result.platformAmount).toBe(5000);
  });

  test('no-agent 95-5 split on 250,000', () => {
    const result = calculateDisbursementAmounts(250000, {
      landlordPercentage: 95,
      agentPercentage: 0,
      platformPercentage: 5,
    });
    expect(result.landlordAmount).toBe(237500);
    expect(result.agentAmount).toBe(0);
    expect(result.platformAmount).toBe(12500);
  });

  test('landlord-only 100-0-0 split', () => {
    const result = calculateDisbursementAmounts(50000, {
      landlordPercentage: 100,
      agentPercentage: 0,
      platformPercentage: 0,
    });
    expect(result.landlordAmount).toBe(50000);
    expect(result.agentAmount).toBe(0);
    expect(result.platformAmount).toBe(0);
  });

  test('sum of amounts equals original total', () => {
    const amounts = [99999, 150000, 333333, 1000000];
    for (const total of amounts) {
      const result = calculateDisbursementAmounts(total, {
        landlordPercentage: 80,
        agentPercentage: 15,
        platformPercentage: 5,
      });
      const sum = result.landlordAmount + result.agentAmount + result.platformAmount;
      expect(sum).toBe(total);
    }
  });

  test('rounding works correctly for odd amounts', () => {
    const result = calculateDisbursementAmounts(100, {
      landlordPercentage: 33,
      agentPercentage: 33,
      platformPercentage: 34,
    });
    const sum = result.landlordAmount + result.agentAmount + result.platformAmount;
    expect(sum).toBe(100);
    expect(result.platformAmount).toBe(34);
  });

  test('rounding works for 3-way equal split of indivisible amount', () => {
    const result = calculateDisbursementAmounts(10, {
      landlordPercentage: 33.33,
      agentPercentage: 33.33,
      platformPercentage: 33.34,
    });
    const sum = result.landlordAmount + result.agentAmount + result.platformAmount;
    expect(sum).toBe(10);
  });

  test('validateSplitPercentages rejects bad configs', () => {
    expect(validateSplitPercentages(100, 10, 0).valid).toBe(false);
    expect(validateSplitPercentages(0, 0, 0).valid).toBe(false);
    expect(validateSplitPercentages(-10, 60, 50).valid).toBe(false);
  });

  test('throws error for invalid split config', () => {
    expect(() =>
      calculateDisbursementAmounts(1000, {
        landlordPercentage: 60,
        agentPercentage: 30,
        platformPercentage: 20,
      })
    ).toThrow('100');
  });
});
