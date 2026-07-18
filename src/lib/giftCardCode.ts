// Restricted alphabet excludes visually ambiguous characters (0/O, 1/I, L)
// so a code read aloud or handwritten can't be mistyped at redemption.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 14;

// crypto.getRandomValues, not Math.random — the old discount-code-based gift
// card prototype used Math.random, which isn't suitable for anything
// security-sensitive (predictable, seedable).
export function generateGiftCardCode(length: number = CODE_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}
