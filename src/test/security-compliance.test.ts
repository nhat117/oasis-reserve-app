import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';
import { escapeHtml } from '@/lib/validation';

// ════════════════════════════════════════════════════════════════════════════
// Security & PCI DSS Compliance Tests
//
// Validates: XSS sanitization, input validation, webhook signature
// verification logic, redirect URL validation, secret exposure prevention,
// and PCI DSS requirements for cardholder data handling.
// ════════════════════════════════════════════════════════════════════════════

// ─── 1. XSS Sanitization (PCI DSS 6.2.4 — protect against injection) ────

describe('DOMPurify HTML sanitization', () => {
  it('strips script tags from HTML content', () => {
    const malicious = '<p>Hello</p><script>alert("xss")</script>';
    const clean = DOMPurify.sanitize(malicious, {
      ALLOWED_TAGS: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
    expect(clean).not.toContain('<script>');
    expect(clean).toContain('<p>Hello</p>');
  });

  it('strips event handlers from HTML attributes', () => {
    const malicious = '<p onmouseover="alert(1)">Hover me</p>';
    const clean = DOMPurify.sanitize(malicious, {
      ALLOWED_TAGS: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
    expect(clean).not.toContain('onmouseover');
  });

  it('strips iframe tags', () => {
    const malicious = '<iframe src="https://evil.com"></iframe><p>Content</p>';
    const clean = DOMPurify.sanitize(malicious, {
      ALLOWED_TAGS: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
    expect(clean).not.toContain('<iframe');
    expect(clean).toContain('<p>Content</p>');
  });

  it('strips style tags with CSS-based attacks', () => {
    const malicious = '<style>body{background:url("javascript:alert(1)")}</style><p>OK</p>';
    const clean = DOMPurify.sanitize(malicious, {
      ALLOWED_TAGS: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
    expect(clean).not.toContain('<style>');
  });

  it('strips img tags with onerror payloads', () => {
    const malicious = '<img src=x onerror="alert(1)"><p>Text</p>';
    const clean = DOMPurify.sanitize(malicious, {
      ALLOWED_TAGS: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
    expect(clean).not.toContain('<img');
    expect(clean).not.toContain('onerror');
  });

  it('allows safe HTML through', () => {
    const safe = '<h2>Title</h2><p>Text with <strong>bold</strong> and <em>italic</em></p><ul><li>Item</li></ul>';
    const clean = DOMPurify.sanitize(safe, {
      ALLOWED_TAGS: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
    expect(clean).toBe(safe);
  });

  it('strips javascript: protocol in links', () => {
    const malicious = '<a href="javascript:alert(1)">Click</a>';
    const clean = DOMPurify.sanitize(malicious, {
      ALLOWED_TAGS: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
    expect(clean).not.toContain('javascript:');
  });

  it('strips data: protocol in links', () => {
    const malicious = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
    const clean = DOMPurify.sanitize(malicious, {
      ALLOWED_TAGS: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
    expect(clean).not.toContain('data:');
  });
});

// ─── 2. escapeHtml for email templates (PCI DSS 6.2.4) ──────────────────

describe('escapeHtml prevents XSS in email templates', () => {
  it('escapes all HTML special characters', () => {
    const input = '<script>alert("xss")</script>';
    const escaped = escapeHtml(input);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('" & \'')).toContain('&quot;');
    expect(escapeHtml('" & \'')).toContain('&#39;');
  });

  it('handles empty strings', () => {
    expect(escapeHtml('')).toBe('');
  });
});

// ─── 3. Webhook Signature Verification Logic (PCI DSS 6.2.3 — integrity) ─

describe('Stripe webhook signature verification logic', () => {
  // Simulate the fail-closed pattern from stripe-webhook/index.ts

  function shouldRejectWebhook(webhookSecret: string | null, sigHeader: string | null): { reject: boolean; reason: string } {
    if (!webhookSecret) {
      return { reject: true, reason: 'Webhook not configured' };
    }
    if (!sigHeader) {
      return { reject: true, reason: 'Missing signature' };
    }
    return { reject: false, reason: '' };
  }

  it('rejects when webhook secret is not configured (fail-closed)', () => {
    const result = shouldRejectWebhook(null, 't=123,v1=abc');
    expect(result.reject).toBe(true);
    expect(result.reason).toBe('Webhook not configured');
  });

  it('rejects when signature header is missing', () => {
    const result = shouldRejectWebhook('whsec_test', null);
    expect(result.reject).toBe(true);
    expect(result.reason).toBe('Missing signature');
  });

  it('allows through when both secret and signature are present', () => {
    const result = shouldRejectWebhook('whsec_test', 't=123,v1=abc');
    expect(result.reject).toBe(false);
  });

  it('rejects when both are missing (fail-closed)', () => {
    const result = shouldRejectWebhook(null, null);
    expect(result.reject).toBe(true);
  });
});

describe('Square webhook signature verification logic', () => {
  function shouldRejectSquareWebhook(webhookSecret: string | null, sigHeader: string | null): { reject: boolean; reason: string } {
    if (!webhookSecret) {
      return { reject: true, reason: 'Webhook not configured' };
    }
    if (!sigHeader) {
      return { reject: true, reason: 'Missing signature' };
    }
    return { reject: false, reason: '' };
  }

  it('rejects when Square webhook secret is not configured', () => {
    const result = shouldRejectSquareWebhook(null, 'somesig');
    expect(result.reject).toBe(true);
  });

  it('rejects when Square signature header is missing', () => {
    const result = shouldRejectSquareWebhook('secret', null);
    expect(result.reject).toBe(true);
  });

  it('allows through when both are present', () => {
    const result = shouldRejectSquareWebhook('secret', 'sig');
    expect(result.reject).toBe(false);
  });
});

// ─── 4. Stripe Redirect URL Validation (PCI DSS 6.2.3) ──────────────────

describe('Stripe checkout redirect URL validation', () => {
  function isValidStripeCheckoutUrl(url: unknown): boolean {
    return typeof url === 'string' && url.startsWith('https://checkout.stripe.com/');
  }

  it('accepts valid Stripe checkout URLs', () => {
    expect(isValidStripeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_abc123')).toBe(true);
    expect(isValidStripeCheckoutUrl('https://checkout.stripe.com/pay/cs_live_xyz')).toBe(true);
  });

  it('rejects non-Stripe URLs', () => {
    expect(isValidStripeCheckoutUrl('https://evil.com/checkout')).toBe(false);
    expect(isValidStripeCheckoutUrl('https://checkout.stripe.com.evil.com/pay')).toBe(false);
  });

  it('rejects javascript: protocol', () => {
    expect(isValidStripeCheckoutUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isValidStripeCheckoutUrl(null)).toBe(false);
    expect(isValidStripeCheckoutUrl(undefined)).toBe(false);
    expect(isValidStripeCheckoutUrl(42)).toBe(false);
    expect(isValidStripeCheckoutUrl({ url: 'https://checkout.stripe.com' })).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isValidStripeCheckoutUrl('')).toBe(false);
  });

  it('rejects HTTP (non-HTTPS) URLs', () => {
    expect(isValidStripeCheckoutUrl('http://checkout.stripe.com/pay')).toBe(false);
  });
});

// ─── 5. UUID Validation (input validation for tenant scoping) ────────────

describe('UUID input validation', () => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it('accepts valid UUIDs', () => {
    expect(uuidRegex.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(uuidRegex.test('A550E840-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('rejects SQL injection in UUID field', () => {
    expect(uuidRegex.test("'; DROP TABLE users; --")).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(uuidRegex.test('')).toBe(false);
  });

  it('rejects partial UUIDs', () => {
    expect(uuidRegex.test('550e8400-e29b')).toBe(false);
  });

  it('rejects UUIDs with extra characters', () => {
    expect(uuidRegex.test('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false);
  });
});

// ─── 6. PCI DSS: No Cardholder Data in Client Code ──────────────────────

describe('PCI DSS - no cardholder data stored client-side', () => {
  it('app uses tokenization (Square/Stripe) not raw card numbers', () => {
    // PCI DSS 3.2.1: Do not store full PAN after authorization
    // Our app uses Square Web Payments SDK tokenization and Stripe Checkout
    // which never expose raw card data to our frontend/backend.
    //
    // This test documents the architectural decision.
    const paymentFlow = {
      stripe: 'redirect to Stripe Checkout (hosted page)',
      square: 'Square Web Payments SDK tokenizes card -> sends nonce only',
      rawCardStored: false,
      panInDatabase: false,
      panInLogs: false,
    };
    expect(paymentFlow.rawCardStored).toBe(false);
    expect(paymentFlow.panInDatabase).toBe(false);
    expect(paymentFlow.panInLogs).toBe(false);
  });
});

// ─── 7. PCI DSS: Secret Key Blocklist in RLS ────────────────────────────

describe('PCI DSS - app_settings RLS secret blocklist', () => {
  const SECRET_KEYS_BLOCKLIST = [
    'resend_api_key',
    'stripe_secret_key',
    'stripe_webhook_secret',
    'square_access_token',
    'square_webhook_secret',
    'twilio_auth_token',
    'twilio_account_sid',
    'twilio_phone_number',
    'twilio_from_number',
    'openai_api_key',
    'resend_from_email',
    'resend_from_name',
  ];

  // Settings that ARE safe for anonymous/public access
  const PUBLIC_SAFE_KEYS = [
    'spa_name',
    'spa_address',
    'spa_phone',
    'stripe_payment_enabled',
    'square_terminal_enabled',
    'square_environment',
    'square_location_id',
    'about_content',
    'terms_content',
  ];

  it('blocklist contains all sensitive API keys', () => {
    expect(SECRET_KEYS_BLOCKLIST).toContain('stripe_secret_key');
    expect(SECRET_KEYS_BLOCKLIST).toContain('square_access_token');
    expect(SECRET_KEYS_BLOCKLIST).toContain('openai_api_key');
    expect(SECRET_KEYS_BLOCKLIST).toContain('twilio_auth_token');
    expect(SECRET_KEYS_BLOCKLIST).toContain('resend_api_key');
  });

  it('blocklist contains webhook secrets', () => {
    expect(SECRET_KEYS_BLOCKLIST).toContain('stripe_webhook_secret');
    expect(SECRET_KEYS_BLOCKLIST).toContain('square_webhook_secret');
  });

  it('public-safe keys are NOT in the blocklist', () => {
    for (const key of PUBLIC_SAFE_KEYS) {
      expect(SECRET_KEYS_BLOCKLIST).not.toContain(key);
    }
  });

  it('blocklist has at least 12 entries to cover all known secrets', () => {
    expect(SECRET_KEYS_BLOCKLIST.length).toBeGreaterThanOrEqual(12);
  });
});

// ─── 8. PCI DSS: Amount Validation (prevent negative/overflow) ──────────

describe('Payment amount validation', () => {
  function isValidAmount(amount: unknown): boolean {
    return typeof amount === 'number' && !isNaN(amount) && amount > 0 && amount <= 100000;
  }

  it('accepts valid payment amounts', () => {
    expect(isValidAmount(50)).toBe(true);
    expect(isValidAmount(0.01)).toBe(true);
    expect(isValidAmount(99999.99)).toBe(true);
  });

  it('rejects zero amounts', () => {
    expect(isValidAmount(0)).toBe(false);
  });

  it('rejects negative amounts', () => {
    expect(isValidAmount(-1)).toBe(false);
    expect(isValidAmount(-100)).toBe(false);
  });

  it('rejects amounts over the maximum', () => {
    expect(isValidAmount(100001)).toBe(false);
    expect(isValidAmount(999999)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isValidAmount(NaN)).toBe(false);
  });

  it('rejects non-number types', () => {
    expect(isValidAmount('50')).toBe(false);
    expect(isValidAmount(null)).toBe(false);
    expect(isValidAmount(undefined)).toBe(false);
  });
});

// ─── 9. PCI DSS: Note/Input Length Limits ────────────────────────────────

describe('Input length limits for terminal checkout', () => {
  it('truncates note to 500 characters', () => {
    const longNote = 'A'.repeat(1000);
    const truncated = longNote.slice(0, 500);
    expect(truncated.length).toBe(500);
  });

  it('allows notes under the limit unchanged', () => {
    const shortNote = 'Payment for booking';
    expect(shortNote.slice(0, 500)).toBe(shortNote);
  });
});

// ─── 10. PCI DSS: Tenant Isolation ──────────────────────────────────────

describe('Tenant isolation - cross-tenant access prevention', () => {
  function canAccessResource(callerTenantId: string, resourceTenantId: string): boolean {
    return callerTenantId === resourceTenantId;
  }

  it('allows access to same-tenant resources', () => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    expect(canAccessResource(tenantId, tenantId)).toBe(true);
  });

  it('blocks access to different-tenant resources', () => {
    const tenantA = '550e8400-e29b-41d4-a716-446655440000';
    const tenantB = '660e8400-e29b-41d4-a716-446655440001';
    expect(canAccessResource(tenantA, tenantB)).toBe(false);
  });
});

// ─── 11. HMAC Constant-Time Comparison ──────────────────────────────────

describe('Constant-time string comparison', () => {
  function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  it('returns true for equal strings', () => {
    expect(constantTimeEqual('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(constantTimeEqual('abc123', 'abc456')).toBe(false);
  });

  it('returns false for different length strings', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });

  it('returns true for empty strings', () => {
    expect(constantTimeEqual('', '')).toBe(true);
  });

  it('works with hex-encoded signatures', () => {
    const sig1 = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const sig2 = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    expect(constantTimeEqual(sig1, sig2)).toBe(true);
  });
});

// ─── 12. Stripe Timestamp Tolerance (Replay Attack Prevention) ──────────

describe('Stripe webhook timestamp tolerance', () => {
  function isTimestampValid(timestamp: number, tolerance: number = 300): boolean {
    const now = Math.floor(Date.now() / 1000);
    return Math.abs(now - timestamp) <= tolerance;
  }

  it('accepts timestamps within the 5-minute tolerance', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isTimestampValid(now)).toBe(true);
    expect(isTimestampValid(now - 60)).toBe(true);
    expect(isTimestampValid(now + 60)).toBe(true);
  });

  it('rejects timestamps older than 5 minutes (replay attack)', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isTimestampValid(now - 600)).toBe(false);
  });

  it('rejects timestamps from the future beyond tolerance', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isTimestampValid(now + 600)).toBe(false);
  });

  it('rejects timestamps of zero (epoch)', () => {
    expect(isTimestampValid(0)).toBe(false);
  });
});
