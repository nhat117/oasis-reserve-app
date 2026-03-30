import { z } from 'zod';

const PHONE_REGEX = /^[\d\s\-+().]{7,20}$/;
const HTML_TAG_REGEX = /<[^>]*>/g;

const noHtmlTags = (val: string) => !HTML_TAG_REGEX.test(val);

export const bookingCustomerSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be under 100 characters')
    .refine(noHtmlTags, 'Name contains invalid characters'),
  customerPhone: z
    .string()
    .trim()
    .min(7, 'Phone number is too short')
    .regex(PHONE_REGEX, 'Please enter a valid phone number'),
  customerEmail: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

export type BookingCustomerForm = z.infer<typeof bookingCustomerSchema>;
export type LoginForm = z.infer<typeof loginSchema>;

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
