import { describe, expect, test } from 'bun:test';
import { isAxiosErrorWithStatus, errorMessage } from '../error-utils';

describe('isAxiosErrorWithStatus', () => {
  test('recognizes an axios-shaped error with a numeric status', () => {
    const error = { response: { status: 502 } };
    expect(isAxiosErrorWithStatus(error)).toBe(true);
  });

  test('rejects a plain Error with no response field', () => {
    expect(isAxiosErrorWithStatus(new Error('boom'))).toBe(false);
  });

  test('rejects null and non-objects', () => {
    expect(isAxiosErrorWithStatus(null)).toBe(false);
    expect(isAxiosErrorWithStatus('string error')).toBe(false);
    expect(isAxiosErrorWithStatus(undefined)).toBe(false);
  });

  test('rejects a response object without a numeric status', () => {
    expect(isAxiosErrorWithStatus({ response: { status: '502' } })).toBe(false);
    expect(isAxiosErrorWithStatus({ response: {} })).toBe(false);
  });
});

describe('errorMessage', () => {
  test('extracts message from an Error instance', () => {
    expect(errorMessage(new Error('something broke'))).toBe('something broke');
  });

  test('stringifies non-Error values', () => {
    expect(errorMessage('raw string')).toBe('raw string');
    expect(errorMessage({ weird: true })).toBe('[object Object]');
  });
});
