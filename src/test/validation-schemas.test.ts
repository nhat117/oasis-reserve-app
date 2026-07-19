import { describe, it, expect } from 'vitest';
import {
  bookingCustomerSchema, loginSchema, serviceSchema, therapistSchema, weeklyShiftBlockSchema, validateDayBlocks,
  adminBookingSchema, saleSchema, membershipTierSchema, discountCodeSchema,
  holidaySchema, unavailabilitySchema, appSettingSchema,
  edgeFnCheckoutSchema, edgeFnRefundSchema, edgeFnEmailSchema,
  edgeFnTranslateSchema, edgeFnDeleteAllSchema, edgeFnCreateAdminSchema,
  validateField, validateForm, escapeHtml,
} from '@/lib/validation';

// ─── Customer-facing schemas ───

describe('bookingCustomerSchema', () => {
  it('accepts valid input', () => {
    const result = bookingCustomerSchema.safeParse({
      customerName: 'John Doe',
      customerPhone: '0412345678',
      customerEmail: 'john@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects short name', () => {
    const result = bookingCustomerSchema.safeParse({
      customerName: 'J',
      customerPhone: '0412345678',
      customerEmail: 'john@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects HTML in name', () => {
    const result = bookingCustomerSchema.safeParse({
      customerName: '<script>alert(1)</script>',
      customerPhone: '0412345678',
      customerEmail: 'john@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = bookingCustomerSchema.safeParse({
      customerName: 'John',
      customerPhone: '0412345678',
      customerEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid phone', () => {
    const result = bookingCustomerSchema.safeParse({
      customerName: 'John',
      customerPhone: '12',
      customerEmail: 'john@example.com',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'pass' }).success).toBe(true);
  });

  it('rejects empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

// ─── Admin dashboard schemas ───

describe('serviceSchema', () => {
  it('accepts valid service', () => {
    expect(serviceSchema.safeParse({
      name: 'Gel Manicure', description: 'Premium gel nails', duration_minutes: 60, price: 100,
    }).success).toBe(true);
  });

  it('rejects duration under 5', () => {
    expect(serviceSchema.safeParse({
      name: 'Spa', description: '', duration_minutes: 2, price: 50,
    }).success).toBe(false);
  });

  it('rejects negative price', () => {
    expect(serviceSchema.safeParse({
      name: 'Spa', description: '', duration_minutes: 30, price: -10,
    }).success).toBe(false);
  });

  it('rejects HTML in name', () => {
    expect(serviceSchema.safeParse({
      name: '<img onerror=alert(1)>', description: '', duration_minutes: 30, price: 50,
    }).success).toBe(false);
  });
});

describe('therapistSchema', () => {
  it('accepts valid therapist', () => {
    expect(therapistSchema.safeParse({
      name: 'Alice', phone: '', email: '',
    }).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(therapistSchema.safeParse({
      name: '', phone: '', email: '',
    }).success).toBe(false);
  });
});

describe('weeklyShiftBlockSchema', () => {
  it('accepts a valid block', () => {
    expect(weeklyShiftBlockSchema.safeParse({
      day_of_week: 1, is_working: true, start_minute: 540, end_minute: 1020,
    }).success).toBe(true);
  });

  it('accepts a quarter-hour boundary', () => {
    expect(weeklyShiftBlockSchema.safeParse({
      day_of_week: 1, is_working: true, start_minute: 630, end_minute: 810,
    }).success).toBe(true);
  });

  it('rejects start_minute > 1440', () => {
    expect(weeklyShiftBlockSchema.safeParse({
      day_of_week: 1, is_working: true, start_minute: 1500, end_minute: 1020,
    }).success).toBe(false);
  });

  it('rejects end_minute not after start_minute', () => {
    expect(weeklyShiftBlockSchema.safeParse({
      day_of_week: 1, is_working: true, start_minute: 1020, end_minute: 540,
    }).success).toBe(false);
  });

  it('rejects day_of_week outside 1-7', () => {
    expect(weeklyShiftBlockSchema.safeParse({
      day_of_week: 8, is_working: true, start_minute: 540, end_minute: 1020,
    }).success).toBe(false);
  });

  it('rejects a start_minute not aligned to 15 minutes', () => {
    expect(weeklyShiftBlockSchema.safeParse({
      day_of_week: 1, is_working: true, start_minute: 541, end_minute: 1020,
    }).success).toBe(false);
  });
});

describe('validateDayBlocks', () => {
  it('accepts an empty day (off)', () => {
    expect(validateDayBlocks([])).toBeNull();
  });

  it('accepts non-overlapping blocks with a gap', () => {
    expect(validateDayBlocks([
      { start_minute: 630, end_minute: 810 },
      { start_minute: 1020, end_minute: 1290 },
    ])).toBeNull();
  });

  it('accepts touching blocks (no gap)', () => {
    expect(validateDayBlocks([
      { start_minute: 540, end_minute: 720 },
      { start_minute: 720, end_minute: 900 },
    ])).toBeNull();
  });

  it('rejects overlapping blocks', () => {
    expect(validateDayBlocks([
      { start_minute: 540, end_minute: 780 },
      { start_minute: 720, end_minute: 900 },
    ])).toBe('Shift blocks cannot overlap');
  });

  it('rejects a block with end before start', () => {
    expect(validateDayBlocks([{ start_minute: 900, end_minute: 540 }])).not.toBeNull();
  });
});

describe('saleSchema', () => {
  it('accepts valid sale', () => {
    expect(saleSchema.safeParse({
      amount: 150, customerName: 'Bob', customerPhone: '0412345678', notes: '', paymentMethod: 'cash',
    }).success).toBe(true);
  });

  it('rejects invalid payment method', () => {
    expect(saleSchema.safeParse({
      amount: 150, customerName: '', customerPhone: '', notes: '', paymentMethod: 'bitcoin',
    }).success).toBe(false);
  });

  it('rejects amount over 100000', () => {
    expect(saleSchema.safeParse({
      amount: 999999, customerName: '', customerPhone: '', notes: '', paymentMethod: 'cash',
    }).success).toBe(false);
  });
});

describe('membershipTierSchema', () => {
  it('accepts valid tier', () => {
    expect(membershipTierSchema.safeParse({ name: 'Gold', min_visits: 10, discount_percent: 15 }).success).toBe(true);
  });

  it('rejects discount over 100%', () => {
    expect(membershipTierSchema.safeParse({ name: 'Gold', min_visits: 10, discount_percent: 150 }).success).toBe(false);
  });
});

describe('discountCodeSchema', () => {
  it('accepts valid code', () => {
    expect(discountCodeSchema.safeParse({
      code: 'SUMMER2024', discount_percent: 20, discount_amount: 0, valid_from: '', valid_to: '', max_uses: null,
    }).success).toBe(true);
  });

  it('rejects code with special chars', () => {
    expect(discountCodeSchema.safeParse({
      code: 'DROP TABLE;', discount_percent: 20, discount_amount: 0, valid_from: '', valid_to: '', max_uses: null,
    }).success).toBe(false);
  });
});

describe('holidaySchema', () => {
  it('accepts valid holiday', () => {
    expect(holidaySchema.safeParse({ date: '2025-12-25', reason: 'Christmas', earlyCloseHour: null }).success).toBe(true);
  });

  it('rejects empty date', () => {
    expect(holidaySchema.safeParse({ date: '', reason: '', earlyCloseHour: null }).success).toBe(false);
  });
});

describe('unavailabilitySchema', () => {
  it('accepts valid UUID therapist', () => {
    expect(unavailabilitySchema.safeParse({
      therapistId: '550e8400-e29b-41d4-a716-446655440000', date: '2025-06-01', reason: 'Sick',
    }).success).toBe(true);
  });

  it('rejects non-UUID therapist', () => {
    expect(unavailabilitySchema.safeParse({
      therapistId: 'not-a-uuid', date: '2025-06-01', reason: '',
    }).success).toBe(false);
  });
});

describe('appSettingSchema', () => {
  it('accepts valid setting', () => {
    expect(appSettingSchema.safeParse({ key: 'spa_name', value: 'My Spa' }).success).toBe(true);
  });

  it('rejects uppercase key', () => {
    expect(appSettingSchema.safeParse({ key: 'SPA_NAME', value: 'My Spa' }).success).toBe(false);
  });

  it('rejects value over 5000 chars', () => {
    expect(appSettingSchema.safeParse({ key: 'test', value: 'x'.repeat(5001) }).success).toBe(false);
  });
});

// ─── Edge function schemas ───

describe('edgeFnCheckoutSchema', () => {
  it('accepts valid checkout', () => {
    expect(edgeFnCheckoutSchema.safeParse({
      booking_id: '550e8400-e29b-41d4-a716-446655440000',
      total_amount: 100,
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
    }).success).toBe(true);
  });

  it('rejects non-UUID booking_id', () => {
    expect(edgeFnCheckoutSchema.safeParse({
      booking_id: 'bad-id',
      total_amount: 100,
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
    }).success).toBe(false);
  });

  it('rejects non-positive amount', () => {
    expect(edgeFnCheckoutSchema.safeParse({
      booking_id: '550e8400-e29b-41d4-a716-446655440000',
      total_amount: 0,
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
    }).success).toBe(false);
  });
});

describe('edgeFnRefundSchema', () => {
  it('accepts valid UUID', () => {
    expect(edgeFnRefundSchema.safeParse({ booking_id: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(true);
  });

  it('rejects non-UUID', () => {
    expect(edgeFnRefundSchema.safeParse({ booking_id: 'abc' }).success).toBe(false);
  });
});

describe('edgeFnEmailSchema', () => {
  it('accepts valid email payload', () => {
    expect(edgeFnEmailSchema.safeParse({
      to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>',
    }).success).toBe(true);
  });

  it('rejects empty subject', () => {
    expect(edgeFnEmailSchema.safeParse({
      to: 'user@example.com', subject: '', html: '<p>Hi</p>',
    }).success).toBe(false);
  });

  it('rejects body over 100KB', () => {
    expect(edgeFnEmailSchema.safeParse({
      to: 'user@example.com', subject: 'Hi', html: 'x'.repeat(100001),
    }).success).toBe(false);
  });
});

describe('edgeFnTranslateSchema', () => {
  it('accepts valid keys and lang', () => {
    expect(edgeFnTranslateSchema.safeParse({ keys: ['hello', 'bye'], lang: 'vi' }).success).toBe(true);
  });

  it('rejects empty keys array', () => {
    expect(edgeFnTranslateSchema.safeParse({ keys: [], lang: 'vi' }).success).toBe(false);
  });
});

describe('edgeFnDeleteAllSchema', () => {
  it('rejects empty password', () => {
    expect(edgeFnDeleteAllSchema.safeParse({ password: '' }).success).toBe(false);
  });
});

describe('edgeFnCreateAdminSchema', () => {
  it('accepts valid admin creation', () => {
    expect(edgeFnCreateAdminSchema.safeParse({
      email: 'admin@test.com', password: 'secure123',
    }).success).toBe(true);
  });

  it('rejects short password', () => {
    expect(edgeFnCreateAdminSchema.safeParse({
      email: 'admin@test.com', password: '12345',
    }).success).toBe(false);
  });

  it('accepts role enum', () => {
    expect(edgeFnCreateAdminSchema.safeParse({
      email: 'e@t.com', password: '123456', role: 'employee',
    }).success).toBe(true);
  });

  it('rejects invalid role', () => {
    expect(edgeFnCreateAdminSchema.safeParse({
      email: 'e@t.com', password: '123456', role: 'superadmin',
    }).success).toBe(false);
  });
});

// ─── Utilities ───

describe('validateField', () => {
  it('returns null for valid field', () => {
    expect(validateField(bookingCustomerSchema, 'customerName', 'John Doe')).toBeNull();
  });

  it('returns error message for invalid field', () => {
    const err = validateField(bookingCustomerSchema, 'customerName', 'J');
    expect(err).toContain('at least 2');
  });
});

describe('validateForm', () => {
  it('returns null for valid form', () => {
    expect(validateForm(loginSchema, { email: 'a@b.com', password: 'x' })).toBeNull();
  });

  it('returns first error for invalid form', () => {
    const err = validateForm(loginSchema, { email: 'bad', password: '' });
    expect(err).toBeTruthy();
  });
});

describe('escapeHtml', () => {
  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello" & \'world\'')).toBe('&quot;hello&quot; &amp; &#39;world&#39;');
  });

  it('returns plain string unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});
