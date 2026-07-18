// Pure checkout total calculations, shared by the POS checkout UI and the
// createSale mutation so the breakdown shown to the cashier always matches
// what actually gets charged and stored.

export interface CouponDiscount {
  percent: number;
  amount: number;
}

export type TipMethod = 'percent' | 'fixed' | 'custom';

export interface CartLine {
  price: number;
}

export interface SaleTotalsInput {
  baseAmount: number; // main service + add-ons, before discount
  coupon?: CouponDiscount | null;
  surchargeRatePercent: number;
  applySurcharge: boolean;
  taxRatePercent?: number;
  tipAmount?: number;
}

export interface SaleTotals {
  base: number;
  discountAmt: number;
  afterDiscount: number;
  surchargeAmt: number;
  taxAmt: number;
  tipAmt: number;
  grandTotal: number;
}

// Sums cart line prices (main service + add-on services + products) into a single
// baseAmount, so the checkout UI and createSale can't independently reduce the cart
// and drift apart on what's actually being charged.
export function computeBaseAmount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + (l.price || 0), 0);
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

export function computeSaleTotals({ baseAmount, coupon, surchargeRatePercent, applySurcharge, taxRatePercent, tipAmount }: SaleTotalsInput): SaleTotals {
  const base = baseAmount;
  const { discountAmt, afterDiscount } = computeDiscountedSubtotal(base, coupon);
  const surchargeAmt = applySurcharge ? afterDiscount * (surchargeRatePercent / 100) : 0;
  const taxAmt = afterDiscount * ((taxRatePercent || 0) / 100);
  const tipAmt = Math.max(0, tipAmount || 0);
  const grandTotal = afterDiscount + surchargeAmt + taxAmt + tipAmt;
  return { base, discountAmt, afterDiscount, surchargeAmt, taxAmt, tipAmt, grandTotal };
}

// Tip amount for a given method — percent tips are computed off the
// post-discount subtotal (afterDiscount), not the raw base amount, so the
// customer tips on what they're actually paying for services.
export function computeTipAmount(method: TipMethod, value: number, afterDiscount: number): number {
  if (method === 'percent') return Math.max(0, afterDiscount * value / 100);
  return Math.max(0, value);
}

export interface GiftCardApplication {
  giftCardApplied: number;
  remainingDue: number;
}

// Splits how much of grandTotal a gift card's balance covers vs. what's left
// for another tender (cash/card) in the same transaction. Called AFTER
// computeSaleTotals, not folded into it — a gift card is a payment split,
// not a discount, so tax/surcharge must still apply to the full grand total
// regardless of how it's ultimately paid.
export function applyGiftCardToTotal(grandTotal: number, giftCardBalance: number): GiftCardApplication {
  const giftCardApplied = Math.max(0, Math.min(grandTotal, giftCardBalance));
  return { giftCardApplied, remainingDue: Math.max(0, grandTotal - giftCardApplied) };
}
