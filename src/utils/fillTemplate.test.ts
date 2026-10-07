import { describe, expect, it } from 'vitest';
import { fillTemplate } from './fillTemplate';

describe('fillTemplate', () => {
  it('replaces every occurrence of each placeholder', () => {
    expect(fillTemplate('{a} and {b} and {a}', { a: 'x', b: 2 })).toBe('x and 2 and x');
  });

  it('inserts values literally', () => {
    expect(fillTemplate('Total: {amount}', { amount: '$&1,00 $1' })).toBe('Total: $&1,00 $1');
  });

  it('leaves a placeholder without a value, and a text without placeholders, alone', () => {
    expect(fillTemplate('Hello {name}', {})).toBe('Hello {name}');
    expect(fillTemplate('Plain', { name: 'x' })).toBe('Plain');
  });
});
