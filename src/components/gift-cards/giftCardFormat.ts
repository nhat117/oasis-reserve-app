// Gift card amounts are entered/stored directly in AUD — do not use
// useI18n's formatPrice, which converts a stored VND amount to AUD display.
export const formatAud = (amount: number) => `A$ ${amount.toLocaleString()}`;
