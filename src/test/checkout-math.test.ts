import { describe, it, expect } from 'vitest';
import { computeDiscountedSubtotal, computeSaleTotals, computeTipAmount } from '@/lib/checkoutMath';

describe('computeDiscountedSubtotal', () => {
  it('applies no discount when coupon is null', () => {
    expect(computeDiscountedSubtotal(100, null)).toEqual({ discountAmt: 0, afterDiscount: 100 });
  });

  it('applies a percent discount', () => {
    expect(computeDiscountedSubtotal(100, { percent: 20, amount: 0 })).toEqual({ discountAmt: 20, afterDiscount: 80 });
  });

  it('applies a fixed-amount discount', () => {
    expect(computeDiscountedSubtotal(100, { percent: 0, amount: 15 })).toEqual({ discountAmt: 15, afterDiscount: 85 });
  });

  it('combines percent and fixed discounts', () => {
    expect(computeDiscountedSubtotal(100, { percent: 10, amount: 5 })).toEqual({ discountAmt: 15, afterDiscount: 85 });
  });

  it('never discounts below zero', () => {
    expect(computeDiscountedSubtotal(50, { percent: 100, amount: 50 })).toEqual({ discountAmt: 50, afterDiscount: 0 });
  });
});

describe('computeTipAmount', () => {
  it('computes a percent tip off the post-discount subtotal', () => {
    expect(computeTipAmount('percent', 15, 100)).toBe(15);
  });

  it('computes a fixed tip regardless of subtotal', () => {
    expect(computeTipAmount('fixed', 10, 100)).toBe(10);
  });

  it('computes a custom tip the same as fixed', () => {
    expect(computeTipAmount('custom', 7.5, 100)).toBe(7.5);
  });

  it('never returns a negative tip', () => {
    expect(computeTipAmount('custom', -5, 100)).toBe(0);
    expect(computeTipAmount('percent', -10, 100)).toBe(0);
  });
});

describe('computeSaleTotals', () => {
  it('returns the base amount when there is no discount, surcharge, or tip', () => {
    const totals = computeSaleTotals({ baseAmount: 100, surchargeRatePercent: 0, applySurcharge: false });
    expect(totals).toEqual({ base: 100, discountAmt: 0, afterDiscount: 100, surchargeAmt: 0, tipAmt: 0, grandTotal: 100 });
  });

  it('applies surcharge only when applySurcharge is true', () => {
    const withSurcharge = computeSaleTotals({ baseAmount: 100, surchargeRatePercent: 2, applySurcharge: true });
    expect(withSurcharge.surchargeAmt).toBe(2);
    expect(withSurcharge.grandTotal).toBe(102);

    const withoutSurcharge = computeSaleTotals({ baseAmount: 100, surchargeRatePercent: 2, applySurcharge: false });
    expect(withoutSurcharge.surchargeAmt).toBe(0);
    expect(withoutSurcharge.grandTotal).toBe(100);
  });

  it('computes surcharge off the post-discount subtotal, not the base amount', () => {
    const totals = computeSaleTotals({
      baseAmount: 100,
      coupon: { percent: 50, amount: 0 },
      surchargeRatePercent: 10,
      applySurcharge: true,
    });
    // afterDiscount = 50, surcharge = 10% of 50 = 5
    expect(totals.afterDiscount).toBe(50);
    expect(totals.surchargeAmt).toBe(5);
    expect(totals.grandTotal).toBe(55);
  });

  it('adds the tip on top of discount and surcharge', () => {
    const totals = computeSaleTotals({
      baseAmount: 100,
      coupon: { percent: 10, amount: 0 },
      surchargeRatePercent: 5,
      applySurcharge: true,
      tipAmount: 20,
    });
    // afterDiscount = 90, surcharge = 4.5, tip = 20
    expect(totals.afterDiscount).toBe(90);
    expect(totals.surchargeAmt).toBe(4.5);
    expect(totals.tipAmt).toBe(20);
    expect(totals.grandTotal).toBe(114.5);
  });

  it('treats a missing or negative tip as zero', () => {
    expect(computeSaleTotals({ baseAmount: 100, surchargeRatePercent: 0, applySurcharge: false }).tipAmt).toBe(0);
    expect(computeSaleTotals({ baseAmount: 100, surchargeRatePercent: 0, applySurcharge: false, tipAmount: -5 }).tipAmt).toBe(0);
  });
});
