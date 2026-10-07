import { describe, expect, it } from 'vitest';
import { centsToReais, formatCentsInput, parseMoneyToCents, reaisToCents } from './money';

describe('reaisToCents', () => {
  it('rounds to whole cents and is not fooled by binary floats', () => {
    expect(reaisToCents(39.9)).toBe(3990);
    expect(reaisToCents(1.005)).toBe(101);
    expect(reaisToCents(0.1 + 0.2)).toBe(30);
    expect(reaisToCents(-12.34)).toBe(-1234);
  });

  it('treats a non-finite value as zero', () => {
    expect(reaisToCents(Number.NaN)).toBe(0);
    expect(reaisToCents(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('centsToReais', () => {
  it('goes back to the wire value', () => {
    expect(centsToReais(18743)).toBe(187.43);
  });
});

describe('parseMoneyToCents', () => {
  it('accepts the usual notations', () => {
    expect(parseMoneyToCents('12')).toBe(1200);
    expect(parseMoneyToCents('12,5')).toBe(1250);
    expect(parseMoneyToCents('12.50')).toBe(1250);
    expect(parseMoneyToCents('1.234,56')).toBe(123456);
    expect(parseMoneyToCents('R$ 1.234,56')).toBe(123456);
    expect(parseMoneyToCents('1.234')).toBe(123400);
  });

  it('rejects empty, negative, letters, repeated separators and three decimals', () => {
    for (const bad of ['', '   ', '-5', 'abc', '1,2,3', '12,345', '1234567890']) {
      expect(parseMoneyToCents(bad), bad).toBeNull();
    }
  });
});

describe('formatCentsInput', () => {
  it('writes a plain editable value with a comma and two decimals', () => {
    expect(formatCentsInput(18743)).toBe('187,43');
    expect(formatCentsInput(5)).toBe('0,05');
    expect(formatCentsInput(123456)).toBe('1234,56');
    expect(formatCentsInput(-250)).toBe('-2,50');
  });

  it('round-trips with the parser', () => {
    for (const cents of [0, 1, 99, 100, 3990, 123456]) {
      expect(parseMoneyToCents(formatCentsInput(cents))).toBe(cents);
    }
  });
});
