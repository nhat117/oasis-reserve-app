import { z } from 'npm:zod@3';

export const checkoutSchema = z.object({
  booking_id: z.string().uuid('Invalid booking ID'),
  total_amount: z.number().positive('Amount must be positive'),
  success_url: z.string().url('Invalid success URL'),
  cancel_url: z.string().url('Invalid cancel URL'),
  service_name: z.string().max(200).optional(),
  customer_email: z.string().email().optional().or(z.literal('')),
  customer_name: z.string().max(100).optional(),
});

export const refundSchema = z.object({
  booking_id: z.string().uuid('Invalid booking ID'),
});

export const emailSchema = z.object({
  to: z.string().email('Invalid recipient email'),
  subject: z.string().min(1, 'Subject required').max(500, 'Subject too long'),
  html: z.string().min(1, 'HTML body required').max(100000, 'Email body too large'),
  from_name: z.string().max(100).optional(),
  from_email: z.string().email().optional(),
});

export const translateSchema = z.object({
  keys: z.array(z.string().max(500)).min(1).max(100),
  lang: z.string().min(2).max(10),
});

export const notifyBookingSchema = z.object({
  id: z.string().uuid(),
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(30).optional(),
  booking_date: z.string().min(1),
  start_time: z.string().min(1),
  service_id: z.string().uuid().optional().nullable(),
  therapist_id: z.string().uuid().optional().nullable(),
  tenant_id: z.string().uuid(),
});

export const deleteAllSchema = z.object({
  password: z.string().min(1, 'Password required'),
});

export const createAdminSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'employee']).optional(),
});

// --- Messaging + AI schemas ---

export const sinchWebhookSchema = z.object({
  app_id: z.string(),
  message: z.object({
    id: z.string(),
    contact_message: z.object({}).passthrough(),
    channel_identity: z.object({
      channel: z.string(),
      identity: z.string(),
    }).passthrough(),
    conversation_id: z.string(),
    contact_id: z.string(),
  }).passthrough(),
}).passthrough();

export const aiChatRespondSchema = z.object({
  conversation_id: z.string().uuid(),
  message_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
});

export const aiEmbedTextSchema = z.object({
  text: z.string().min(1).max(50000),
  knowledge_base_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
});

export const sinchSendMessageSchema = z.object({
  external_conversation_id: z.string().min(1),
  content: z.string().min(1).max(10000),
  tenant_id: z.string().uuid(),
});

export const notifyHandoffSchema = z.object({
  conversation_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  reason: z.string().min(1).max(1000),
  customer_name: z.string().max(200).optional(),
  customer_message: z.string().max(5000).optional(),
  source: z.string().max(50).optional(),
});

/** Parse body with schema, return { data, error, response } */
export function parseBody<T extends z.ZodSchema>(
  schema: T,
  body: unknown,
  corsHeaders: Record<string, string>,
): { data: z.infer<T>; error?: never; response?: never } | { data?: never; error: string; response: Response } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { data: result.data };
  }
  const msg = result.error.errors.map(e => e.message).join(', ');
  return {
    error: msg,
    response: new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    ),
  };
}
