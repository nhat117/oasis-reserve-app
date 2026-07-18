import { describe, it, expect } from 'vitest';
import { applyGiftCardToTotal } from '@/lib/checkoutMath';

describe('applyGiftCardToTotal', () => {
  it('applies the full balance when it covers the total', () => {
    expect(applyGiftCardToTotal(30, 50)).toEqual({ giftCardApplied: 30, remainingDue: 0 });
  });

  it('applies the full balance and leaves a remainder when it only partially covers the total', () => {
    expect(applyGiftCardToTotal(35, 20)).toEqual({ giftCardApplied: 20, remainingDue: 15 });
  });

  it('applies nothing when the balance is zero', () => {
    expect(applyGiftCardToTotal(35, 0)).toEqual({ giftCardApplied: 0, remainingDue: 35 });
  });

  it('applies nothing when the balance is negative', () => {
    expect(applyGiftCardToTotal(35, -10)).toEqual({ giftCardApplied: 0, remainingDue: 35 });
  });

  it('applies nothing when the grand total is zero', () => {
    expect(applyGiftCardToTotal(0, 50)).toEqual({ giftCardApplied: 0, remainingDue: 0 });
  });

  it('matches the balance exactly when it equals the total', () => {
    expect(applyGiftCardToTotal(20, 20)).toEqual({ giftCardApplied: 20, remainingDue: 0 });
  });
});
