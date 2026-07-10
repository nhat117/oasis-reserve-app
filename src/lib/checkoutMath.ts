// Pure checkout total calculations, shared by the POS checkout UI and the
// createSale mutation so the breakdown shown to the cashier always matches
// what actually gets charged and stored.

export interface CouponDiscount {
  percent: number;
  amount: number;
}

export type TipMethod = 'percent' | 'fixed' | 'custom';

export interface SaleTotalsInput {
  baseAmount: number; // main service + add-ons, before discount
  coupon?: CouponDiscount | null;
  surchargeRatePercent: number;
  applySurcharge: boolean;
  tipAmount?: number;
}

export interface SaleTotals {
  base: number;
  discountAmt: number;
  afterDiscount: number;
  surchargeAmt: number;
  tipAmt: number;
  grandTotal: number;
}

export function computeDiscountedSubtotal(base: number, coupon?: CouponDiscount | null): { discountAmt: number; afterDiscount: number } {
  let discountAmt = 0;
  if (coupon) {
    if (coupon.percent > 0) discountAmt += base * (coupon.percent / 100);
    if (coupon.amount > 0) discountAmt += coupon.amount;
    discountAmt = Math.min(discountAmt, base);
  }
  return { discountAmt, afterDiscount: Math.max(0, base - discountAmt) };
}

export function computeSaleTotals({ baseAmount, coupon, surchargeRatePercent, applySurcharge, tipAmount }: SaleTotalsInput): SaleTotals {
  const base = baseAmount;
  const { discountAmt, afterDiscount } = computeDiscountedSubtotal(base, coupon);
  const surchargeAmt = applySurcharge ? afterDiscount * (surchargeRatePercent / 100) : 0;
  const tipAmt = Math.max(0, tipAmount || 0);
  const grandTotal = afterDiscount + surchargeAmt + tipAmt;
  return { base, discountAmt, afterDiscount, surchargeAmt, tipAmt, grandTotal };
}

// Tip amount for a given method — percent tips are computed off the
// post-discount subtotal (afterDiscount), not the raw base amount, so the
// customer tips on what they're actually paying for services.
export function computeTipAmount(method: TipMethod, value: number, afterDiscount: number): number {
  if (method === 'percent') return Math.max(0, afterDiscount * value / 100);
  return Math.max(0, value);
}
