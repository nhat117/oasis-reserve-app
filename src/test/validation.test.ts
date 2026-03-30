import { describe, it, expect } from 'vitest';
import {
  bookingCustomerSchema,
  loginSchema,
  forgotPasswordSchema,
  escapeHtml,
  validateField,
} from '@/lib/validation';

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------
describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('escapes quotes', () => {
    expect(escapeHtml(`He said "it's fine"`)).toBe(
      'He said &quot;it&#39;s fine&quot;',
    );
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('handles multiple special characters together', () => {
    expect(escapeHtml('<b>"Tom & Jerry\'s"</b>')).toBe(
      '&lt;b&gt;&quot;Tom &amp; Jerry&#39;s&quot;&lt;/b&gt;',
    );
  });
});

// ---------------------------------------------------------------------------
// bookingCustomerSchema
// ---------------------------------------------------------------------------
describe('bookingCustomerSchema', () => {
  const valid = {
    customerName: 'Jane Doe',
    customerPhone: '+61 412 345 678',
    customerEmail: 'jane@example.com',
  };

  it('accepts valid customer data', () => {
    expect(bookingCustomerSchema.safeParse(valid).success).toBe(true);
  });

  // Name
  it('rejects name shorter than 2 chars', () => {
    const r = bookingCustomerSchema.safeParse({ ...valid, customerName: 'A' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/at least 2/);
  });

  it('rejects name longer than 100 chars', () => {
    const r = bookingCustomerSchema.safeParse({ ...valid, customerName: 'A'.repeat(101) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/under 100/);
  });

  it('rejects name containing HTML tags (XSS)', () => {
    const r = bookingCustomerSchema.safeParse({ ...valid, customerName: '<script>alert(1)</script>' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/invalid characters/);
  });

  it('trims whitespace from name', () => {
    const r = bookingCustomerSchema.safeParse({ ...valid, customerName: '  Jane Doe  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.customerName).toBe('Jane Doe');
  });

  // Phone
  it('rejects phone shorter than 7 characters', () => {
    const r = bookingCustomerSchema.safeParse({ ...valid, customerPhone: '12345' });
    expect(r.success).toBe(false);
  });

  it('rejects phone with invalid characters', () => {
    const r = bookingCustomerSchema.safeParse({ ...valid, customerPhone: 'abc-invalid' });
    expect(r.success).toBe(false);
  });

  it('accepts phone with parentheses and dashes', () => {
    const r = bookingCustomerSchema.safeParse({ ...valid, customerPhone: '(04) 1234-5678' });
    expect(r.success).toBe(true);
  });

  // Email
  it('rejects empty email', () => {
    const r = bookingCustomerSchema.safeParse({ ...valid, customerEmail: '' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const r = bookingCustomerSchema.safeParse({ ...valid, customerEmail: 'not-an-email' });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loginSchema
// ---------------------------------------------------------------------------
describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(loginSchema.safeParse({ email: 'admin@shop.com', password: 'secret' }).success).toBe(true);
  });

  it('rejects empty email', () => {
    const r = loginSchema.safeParse({ email: '', password: 'secret' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const r = loginSchema.safeParse({ email: 'nope', password: 'secret' });
    expect(r.success).toBe(false);
  });

  it('rejects empty password', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', password: '' });
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// forgotPasswordSchema
// ---------------------------------------------------------------------------
describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
  });

  it('rejects empty email', () => {
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
  });

  it('rejects malformed email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'bad@@' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateField helper
// ---------------------------------------------------------------------------
describe('validateField', () => {
  it('returns null for valid field', () => {
    expect(validateField(loginSchema, 'email', 'ok@ok.com')).toBeNull();
  });

  it('returns error message for invalid field', () => {
    const msg = validateField(loginSchema, 'email', 'bad');
    expect(msg).toBeTruthy();
    expect(typeof msg).toBe('string');
  });

  it('returns null for non-existent field', () => {
    expect(validateField(loginSchema, 'nonexistent' as any, 'x')).toBeNull();
  });

  it('returns first error for empty required field', () => {
    const msg = validateField(loginSchema, 'password', '');
    expect(msg).toMatch(/required/i);
  });
});
