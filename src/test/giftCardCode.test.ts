import { describe, it, expect } from 'vitest';
import { generateGiftCardCode } from '@/lib/giftCardCode';

const AMBIGUOUS_CHARS = ['0', 'O', '1', 'I', 'L'];

describe('generateGiftCardCode', () => {
  it('defaults to a 14-character code', () => {
    expect(generateGiftCardCode()).toHaveLength(14);
  });

  it('respects a custom length', () => {
    expect(generateGiftCardCode(20)).toHaveLength(20);
  });

  it('only uses uppercase letters and digits', () => {
    const code = generateGiftCardCode();
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it('never contains visually ambiguous characters', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateGiftCardCode();
      for (const ch of AMBIGUOUS_CHARS) {
        expect(code).not.toContain(ch);
      }
    }
  });

  it('produces no duplicates across 10,000 generated codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      codes.add(generateGiftCardCode());
    }
    expect(codes.size).toBe(10_000);
  });
});
