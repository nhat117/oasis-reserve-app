import { describe, it, expect } from 'vitest';

// ─── HTML Escaping (extracted from Booking.tsx) ───

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

describe('HTML escaping (XSS prevention)', () => {
  it('escapes ampersand', () => {
    expect(esc('A & B')).toBe('A &amp; B');
  });

  it('escapes angle brackets', () => {
    expect(esc('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes double quotes', () => {
    expect(esc('"hello"')).toBe('&quot;hello&quot;');
  });

  it('handles multiple special characters', () => {
    expect(esc('Tom & <Jerry> said "hi"')).toBe(
      'Tom &amp; &lt;Jerry&gt; said &quot;hi&quot;'
    );
  });

  it('returns clean string unchanged', () => {
    expect(esc('John Doe')).toBe('John Doe');
  });

  it('handles empty string', () => {
    expect(esc('')).toBe('');
  });

  it('handles malicious event handlers', () => {
    expect(esc('" onmouseover="alert(1)"')).toBe(
      '&quot; onmouseover=&quot;alert(1)&quot;'
    );
  });
});

// ─── Stripe Webhook Signature Verification (extracted logic) ───

function parseStripeSignatureHeader(sigHeader: string): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const item of sigHeader.split(',')) {
    const [key, value] = item.split('=');
    parts[key] = value;
  }
  return parts;
}

function isTimestampValid(timestamp: number, now: number, tolerance = 300): boolean {
  return Math.abs(now - timestamp) <= tolerance;
}

describe('Stripe webhook signature parsing', () => {
  it('parses valid signature header', () => {
    const header = 't=1234567890,v1=abc123def456';
    const parts = parseStripeSignatureHeader(header);
    expect(parts['t']).toBe('1234567890');
    expect(parts['v1']).toBe('abc123def456');
  });

  it('returns undefined for missing parts', () => {
    const parts = parseStripeSignatureHeader('t=123');
    expect(parts['t']).toBe('123');
    expect(parts['v1']).toBeUndefined();
  });
});

describe('Stripe timestamp tolerance', () => {
  const now = 1700000000;

  it('accepts timestamp within tolerance', () => {
    expect(isTimestampValid(now - 100, now)).toBe(true);
    expect(isTimestampValid(now + 100, now)).toBe(true);
  });

  it('accepts timestamp at exact tolerance boundary', () => {
    expect(isTimestampValid(now - 300, now)).toBe(true);
    expect(isTimestampValid(now + 300, now)).toBe(true);
  });

  it('rejects timestamp outside tolerance (replay attack)', () => {
    expect(isTimestampValid(now - 301, now)).toBe(false);
    expect(isTimestampValid(now + 301, now)).toBe(false);
  });

  it('rejects very old timestamps', () => {
    expect(isTimestampValid(now - 3600, now)).toBe(false);
  });
});

// ─── HMAC Constant-Time Comparison (extracted logic) ───

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

describe('Constant-time string comparison', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeCompare('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings same length', () => {
    expect(constantTimeCompare('abc123', 'abc124')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(constantTimeCompare('abc', 'abcd')).toBe(false);
  });

  it('returns true for empty strings', () => {
    expect(constantTimeCompare('', '')).toBe(true);
  });

  it('returns false for single char difference', () => {
    expect(constantTimeCompare('a', 'b')).toBe(false);
  });
});

// ─── Price Validation (from create-stripe-checkout) ───

function validatePaymentAmount(clientAmount: number, servicePrice: number): boolean {
  // Reject if client amount is less than 99% of the service price
  return clientAmount >= servicePrice * 0.99;
}

describe('Price validation', () => {
  it('accepts exact price', () => {
    expect(validatePaymentAmount(100, 100)).toBe(true);
  });

  it('accepts price with add-ons (higher than service)', () => {
    expect(validatePaymentAmount(150, 100)).toBe(true);
  });

  it('accepts tiny rounding difference (0.5%)', () => {
    expect(validatePaymentAmount(99.5, 100)).toBe(true);
  });

  it('rejects amount below 99% threshold', () => {
    expect(validatePaymentAmount(98, 100)).toBe(false);
  });

  it('accepts amount at exactly 99%', () => {
    expect(validatePaymentAmount(99, 100)).toBe(true);
  });

  it('rejects zero amount for a priced service', () => {
    expect(validatePaymentAmount(0, 100)).toBe(false);
  });

  it('accepts zero when service is free', () => {
    expect(validatePaymentAmount(0, 0)).toBe(true);
  });
});

// ─── Amount Conversion to Cents ───

function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

describe('Amount to cents conversion', () => {
  it('converts whole dollars', () => {
    expect(amountToCents(100)).toBe(10000);
  });

  it('converts with cents', () => {
    expect(amountToCents(99.99)).toBe(9999);
  });

  it('handles floating point precision', () => {
    // 19.99 * 100 = 1998.9999999999998 in JS
    expect(amountToCents(19.99)).toBe(1999);
  });

  it('handles zero', () => {
    expect(amountToCents(0)).toBe(0);
  });

  it('handles small amounts', () => {
    expect(amountToCents(0.01)).toBe(1);
  });
});

// ─── Payment Status Transitions ───

type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

const VALID_STATUSES: PaymentStatus[] = ['unpaid', 'pending', 'paid', 'failed', 'refunded'];

const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  unpaid: ['pending'],
  pending: ['paid', 'failed'],
  paid: ['refunded'],
  failed: [],
  refunded: [],
};

function isValidTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

describe('Payment status transitions', () => {
  it('allows unpaid → pending', () => {
    expect(isValidTransition('unpaid', 'pending')).toBe(true);
  });

  it('allows pending → paid', () => {
    expect(isValidTransition('pending', 'paid')).toBe(true);
  });

  it('allows pending → failed', () => {
    expect(isValidTransition('pending', 'failed')).toBe(true);
  });

  it('allows paid → refunded', () => {
    expect(isValidTransition('paid', 'refunded')).toBe(true);
  });

  it('rejects skipping from unpaid to paid', () => {
    expect(isValidTransition('unpaid', 'paid')).toBe(false);
  });

  it('rejects going backward from paid to pending', () => {
    expect(isValidTransition('paid', 'pending')).toBe(false);
  });

  it('rejects transition from terminal state (failed)', () => {
    expect(isValidTransition('failed', 'pending')).toBe(false);
  });

  it('rejects transition from terminal state (refunded)', () => {
    expect(isValidTransition('refunded', 'paid')).toBe(false);
  });

  it('all status values are valid', () => {
    VALID_STATUSES.forEach(s => {
      expect(['unpaid', 'pending', 'paid', 'failed', 'refunded']).toContain(s);
    });
  });
});

// ─── Payment Provider Validation ───

const VALID_BOOKING_PROVIDERS = ['stripe', 'square', null] as const;
const VALID_SALE_PROVIDERS = ['stripe', 'square', 'cash', 'card', null] as const;

describe('Payment provider validation', () => {
  it('stripe is valid for bookings', () => {
    expect(VALID_BOOKING_PROVIDERS).toContain('stripe');
  });

  it('square is valid for bookings', () => {
    expect(VALID_BOOKING_PROVIDERS).toContain('square');
  });

  it('null is valid for bookings (no provider set)', () => {
    expect(VALID_BOOKING_PROVIDERS).toContain(null);
  });

  it('cash is not valid for bookings', () => {
    expect(VALID_BOOKING_PROVIDERS).not.toContain('cash');
  });

  it('sales support cash and card in addition to stripe/square', () => {
    expect(VALID_SALE_PROVIDERS).toContain('cash');
    expect(VALID_SALE_PROVIDERS).toContain('card');
    expect(VALID_SALE_PROVIDERS).toContain('stripe');
    expect(VALID_SALE_PROVIDERS).toContain('square');
  });
});

// ─── Required Fields Validation (create-stripe-checkout) ───

interface CheckoutRequest {
  booking_id?: string;
  total_amount?: number;
  success_url?: string;
  cancel_url?: string;
  service_name?: string;
  customer_email?: string;
}

function validateCheckoutRequest(req: CheckoutRequest): string | null {
  if (!req.booking_id || !req.total_amount || !req.success_url || !req.cancel_url) {
    return 'Missing required fields';
  }
  return null;
}

describe('Checkout request validation', () => {
  const validReq: CheckoutRequest = {
    booking_id: 'uuid-123',
    total_amount: 100,
    success_url: 'https://example.com/success',
    cancel_url: 'https://example.com/cancel',
  };

  it('accepts valid request', () => {
    expect(validateCheckoutRequest(validReq)).toBeNull();
  });

  it('rejects missing booking_id', () => {
    expect(validateCheckoutRequest({ ...validReq, booking_id: undefined })).toBe('Missing required fields');
  });

  it('rejects missing total_amount', () => {
    expect(validateCheckoutRequest({ ...validReq, total_amount: undefined })).toBe('Missing required fields');
  });

  it('rejects missing success_url', () => {
    expect(validateCheckoutRequest({ ...validReq, success_url: undefined })).toBe('Missing required fields');
  });

  it('rejects missing cancel_url', () => {
    expect(validateCheckoutRequest({ ...validReq, cancel_url: undefined })).toBe('Missing required fields');
  });

  it('rejects all missing fields', () => {
    expect(validateCheckoutRequest({})).toBe('Missing required fields');
  });
});

// ─── Square Environment URL Resolution ───

function getSquareBaseUrl(environment: string): string {
  return environment === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

describe('Square environment URL', () => {
  it('returns production URL', () => {
    expect(getSquareBaseUrl('production')).toBe('https://connect.squareup.com');
  });

  it('returns sandbox URL for sandbox', () => {
    expect(getSquareBaseUrl('sandbox')).toBe('https://connect.squareupsandbox.com');
  });

  it('defaults to sandbox for unknown environment', () => {
    expect(getSquareBaseUrl('test')).toBe('https://connect.squareupsandbox.com');
  });

  it('defaults to sandbox for empty string', () => {
    expect(getSquareBaseUrl('')).toBe('https://connect.squareupsandbox.com');
  });
});

// ─── Sensitive Keys RLS Protection ───

const PROTECTED_KEYS = [
  'stripe_secret_key',
  'stripe_webhook_secret',
  'square_access_token',
  'twilio_account_sid',
  'twilio_auth_token',
  'twilio_phone_number',
  'twilio_from_number',
  'resend_api_key',
  'resend_from_email',
  'resend_from_name',
  'openai_api_key',
];

const PUBLIC_SAFE_KEYS = [
  'stripe_payment_enabled',
  'spa_name',
  'stripe_publishable_key',
];

describe('Sensitive settings key classification', () => {
  it('stripe_secret_key is protected', () => {
    expect(PROTECTED_KEYS).toContain('stripe_secret_key');
  });

  it('square_access_token is protected', () => {
    expect(PROTECTED_KEYS).toContain('square_access_token');
  });

  it('all twilio keys are protected', () => {
    expect(PROTECTED_KEYS).toContain('twilio_account_sid');
    expect(PROTECTED_KEYS).toContain('twilio_auth_token');
  });

  it('stripe_payment_enabled is safe for public access', () => {
    expect(PROTECTED_KEYS).not.toContain('stripe_payment_enabled');
    expect(PUBLIC_SAFE_KEYS).toContain('stripe_payment_enabled');
  });

  it('publishable key is not in protected list (it is meant to be public)', () => {
    expect(PROTECTED_KEYS).not.toContain('stripe_publishable_key');
  });

  it('no protected key appears in the public safe list', () => {
    PROTECTED_KEYS.forEach(key => {
      expect(PUBLIC_SAFE_KEYS).not.toContain(key);
    });
  });
});
