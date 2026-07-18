import { z } from 'zod';

const PHONE_REGEX = /^[\d\s\-+().]{7,20}$/;
const HTML_TAG_REGEX = /<[^>]*>/g;

const noHtmlTags = (val: string) => !HTML_TAG_REGEX.test(val);

// Reusable field builders
const safeName = (label = 'Name') =>
  z.string().trim()
    .min(2, `${label} must be at least 2 characters`)
    .max(100, `${label} must be under 100 characters`)
    .refine(noHtmlTags, `${label} contains invalid characters`);

const safeText = (label = 'Text', maxLen = 500) =>
  z.string().trim()
    .max(maxLen, `${label} must be under ${maxLen} characters`)
    .refine(noHtmlTags, `${label} contains invalid characters`);

const optionalSafeText = (label = 'Text', maxLen = 500) =>
  z.string().trim()
    .max(maxLen, `${label} must be under ${maxLen} characters`)
    .refine(noHtmlTags, `${label} contains invalid characters`)
    .optional()
    .or(z.literal(''));

const safePhone = z.string().trim()
  .min(7, 'Phone number is too short')
  .regex(PHONE_REGEX, 'Please enter a valid phone number');

const optionalPhone = z.string().trim()
  .regex(PHONE_REGEX, 'Please enter a valid phone number')
  .optional()
  .or(z.literal(''));

const safeEmail = z.string().trim()
  .min(1, 'Email is required')
  .email('Please enter a valid email address');

const optionalEmail = z.string().trim()
  .email('Please enter a valid email address')
  .optional()
  .or(z.literal(''));

// ─── Customer-facing forms ───

export const bookingCustomerSchema = z.object({
  customerName: safeName('Name'),
  customerPhone: safePhone,
  customerEmail: safeEmail,
});

export const loginSchema = z.object({
  email: safeEmail,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: safeEmail,
});

// ─── Admin dashboard forms ───

export const serviceSchema = z.object({
  name: safeName('Service name'),
  description: optionalSafeText('Description', 1000),
  duration_minutes: z.number().int().min(5, 'Min 5 minutes').max(480, 'Max 8 hours'),
  price: z.number().min(0, 'Price cannot be negative').max(100000, 'Price too high'),
});

export const productSchema = z.object({
  name: safeName('Product name'),
  description: optionalSafeText('Description', 1000),
  price: z.number().min(0, 'Price cannot be negative').max(100000, 'Price too high'),
});

export const therapistSchema = z.object({
  name: safeName('Therapist name'),
  phone: optionalPhone,
  email: optionalEmail,
  start_hour: z.number().int().min(0).max(23),
  end_hour: z.number().int().min(1).max(24),
  break_start: z.number().int().min(0).max(23).nullable(),
  break_end: z.number().int().min(0).max(24).nullable(),
});

export const adminBookingSchema = z.object({
  customerName: safeName('Customer name'),
  customerPhone: safePhone,
  customerEmail: optionalEmail,
  notes: optionalSafeText('Notes', 500),
});

export const saleSchema = z.object({
  amount: z.number().min(0, 'Amount cannot be negative').max(100000, 'Amount too high'),
  customerName: z.string().trim().max(100).refine(noHtmlTags, 'Invalid characters').optional().or(z.literal('')),
  customerPhone: optionalPhone,
  notes: optionalSafeText('Notes', 500),
  paymentMethod: z.enum(['cash', 'card', 'stripe', 'square']),
  tipAmount: z.number().min(0, 'Tip cannot be negative').max(10000, 'Tip too high').optional(),
});

export const membershipTierSchema = z.object({
  name: safeName('Tier name'),
  min_visits: z.number().int().min(0, 'Min visits cannot be negative').max(10000),
  discount_percent: z.number().min(0, 'Discount cannot be negative').max(100, 'Max 100%'),
});

export const discountCodeSchema = z.object({
  code: z.string().trim()
    .min(1, 'Code is required')
    .max(50, 'Code too long')
    .regex(/^[A-Z0-9_-]+$/i, 'Code can only contain letters, numbers, dashes, underscores'),
  discount_percent: z.number().min(0).max(100),
  discount_amount: z.number().min(0).max(100000),
  valid_from: z.string().optional().or(z.literal('')),
  valid_to: z.string().optional().or(z.literal('')),
  max_uses: z.number().int().min(0).nullable(),
});

// Gift cards are stored-value and admin-created only — no `code` field here
// since the code is always system-generated, never typed by the admin.
export const giftCardCreateSchema = z.object({
  initialValue: z.number().positive('Amount must be positive').max(100000, 'Amount too high'),
  purchaserName: optionalSafeText('Purchaser name', 100),
  purchaserNote: optionalSafeText('Note', 500),
});

export const giftCardRedeemSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(20, 'Code too long'),
  amount: z.number().positive('Amount must be positive'),
});

export const giftCardAdjustSchema = z.object({
  delta: z.number().refine(v => v !== 0, 'Adjustment cannot be zero'),
  reason: z.string().trim()
    .min(1, 'Reason is required')
    .max(500, 'Reason must be under 500 characters')
    .refine(noHtmlTags, 'Reason contains invalid characters'),
});

export const holidaySchema = z.object({
  date: z.string().min(1, 'Date is required'),
  reason: optionalSafeText('Reason', 200),
  earlyCloseHour: z.number().int().min(0).max(24).nullable().optional(),
});

export const unavailabilitySchema = z.object({
  therapistId: z.string().uuid('Invalid therapist'),
  date: z.string().min(1, 'Date is required'),
  reason: optionalSafeText('Reason', 200),
});

export const appSettingSchema = z.object({
  key: z.string().trim().min(1).max(100).regex(/^[a-z_]+$/, 'Invalid setting key'),
  value: z.string().max(5000, 'Value too long'),
});

// ─── Edge function input schemas ───

export const edgeFnCheckoutSchema = z.object({
  booking_id: z.string().uuid('Invalid booking ID'),
  total_amount: z.number().positive('Amount must be positive'),
  success_url: z.string().url('Invalid success URL'),
  cancel_url: z.string().url('Invalid cancel URL'),
  service_name: z.string().max(200).optional(),
  customer_email: z.string().email().optional().or(z.literal('')),
  customer_name: z.string().max(100).optional(),
});

export const edgeFnRefundSchema = z.object({
  booking_id: z.string().uuid('Invalid booking ID'),
});

export const edgeFnEmailSchema = z.object({
  to: z.string().email('Invalid recipient email'),
  subject: z.string().min(1, 'Subject required').max(500, 'Subject too long'),
  html: z.string().min(1, 'HTML body required').max(100000, 'Email body too large'),
  from_name: z.string().max(100).optional(),
  from_email: z.string().email().optional(),
});

export const edgeFnTranslateSchema = z.object({
  keys: z.array(z.string().max(500)).min(1).max(100),
  lang: z.string().min(2).max(10),
});

export const edgeFnNotifyBookingSchema = z.object({
  id: z.string().uuid(),
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(30).optional(),
  booking_date: z.string().min(1),
  start_time: z.string().min(1),
  service_id: z.string().uuid().optional().nullable(),
  therapist_id: z.string().uuid().optional().nullable(),
  tenant_id: z.string().uuid(),
});

export const edgeFnDeleteAllSchema = z.object({
  password: z.string().min(1, 'Password required'),
});

export const edgeFnCreateAdminSchema = z.object({
  email: safeEmail,
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'employee']).optional(),
});

// ─── Types ───

export type BookingCustomerForm = z.infer<typeof bookingCustomerSchema>;
export type LoginForm = z.infer<typeof loginSchema>;
export type ServiceForm = z.infer<typeof serviceSchema>;
export type ProductForm = z.infer<typeof productSchema>;
export type TherapistForm = z.infer<typeof therapistSchema>;
export type AdminBookingForm = z.infer<typeof adminBookingSchema>;
export type SaleForm = z.infer<typeof saleSchema>;

// ─── Utilities ───

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function validateField<T extends z.ZodObject<any>>(
  schema: T,
  field: keyof z.infer<T>,
  value: string,
): string | null {
  const fieldSchema = schema.shape[field as string];
  if (!fieldSchema) return null;
  const result = fieldSchema.safeParse(value);
  if (result.success) return null;
  return result.error.errors[0]?.message || 'Invalid input';
}

/** Validate a full form object and return first error or null */
export function validateForm<T extends z.ZodSchema>(schema: T, data: unknown): string | null {
  const result = schema.safeParse(data);
  if (result.success) return null;
  return result.error.errors[0]?.message || 'Invalid input';
}
