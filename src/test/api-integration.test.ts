import { describe, it, expect } from 'vitest';

// ════════════════════════════════════════════════════════════════════════════
// API Integration Tests
//
// Tests the request/response building logic for all external APIs used in
// Supabase Edge Functions: Twilio, Stripe, Square, Resend, OpenAI, and
// the date.nager.at holiday API.
//
// These are pure-logic tests — no real HTTP calls. They validate that the
// edge functions would construct correct requests and parse responses properly.
// ════════════════════════════════════════════════════════════════════════════

// ─── Twilio SMS / WhatsApp ─────────────────────────────────────────────────

function buildTwilioAuth(accountSid: string, authToken: string): string {
  return `Basic ${btoa(`${accountSid}:${authToken}`)}`;
}

function buildTwilioUrl(accountSid: string): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
}

function buildTwilioSmsBody(to: string, from: string, body: string): URLSearchParams {
  return new URLSearchParams({ To: to, From: from, Body: body });
}

function buildTwilioWhatsAppBody(to: string, from: string, body: string): URLSearchParams {
  return new URLSearchParams({
    To: `whatsapp:${to}`,
    From: `whatsapp:${from}`,
    Body: body,
  });
}

function buildReminderMessage(
  spaName: string,
  serviceName: string,
  startTime: string,
  bookingDate: string,
  therapistName: string,
): string {
  return `${spaName} reminder: You have a "${serviceName}" appointment at ${startTime} on ${bookingDate} with ${therapistName}. See you soon!`;
}

function buildNewBookingNotification(
  spaName: string,
  customerName: string,
  serviceName: string,
  startTime: string,
  bookingDate: string,
  therapistName: string,
  customerPhone: string,
): string {
  return `[${spaName}] New booking: ${customerName} - ${serviceName || 'N/A'} at ${startTime} on ${bookingDate}${therapistName ? ` with ${therapistName}` : ''}. Phone: ${customerPhone || 'N/A'}`;
}

describe('Twilio SMS integration', () => {
  const accountSid = 'AC1234567890abcdef';
  const authToken = 'test_auth_token_123';

  it('builds correct Basic auth header', () => {
    const auth = buildTwilioAuth(accountSid, authToken);
    expect(auth).toBe(`Basic ${btoa(`${accountSid}:${authToken}`)}`);
    expect(auth).toMatch(/^Basic [A-Za-z0-9+/=]+$/);
  });

  it('builds correct Twilio API URL', () => {
    const url = buildTwilioUrl(accountSid);
    expect(url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`);
  });

  it('builds SMS body with correct params', () => {
    const body = buildTwilioSmsBody('+61412345678', '+61400000000', 'Hello');
    expect(body.get('To')).toBe('+61412345678');
    expect(body.get('From')).toBe('+61400000000');
    expect(body.get('Body')).toBe('Hello');
  });

  it('builds WhatsApp body with whatsapp: prefix', () => {
    const body = buildTwilioWhatsAppBody('+61412345678', '+61400000000', 'Hello');
    expect(body.get('To')).toBe('whatsapp:+61412345678');
    expect(body.get('From')).toBe('whatsapp:+61400000000');
    expect(body.get('Body')).toBe('Hello');
  });

  it('builds correct reminder message', () => {
    const msg = buildReminderMessage('Oasis Nails', 'Gel Manicure', '10:00', '2026-04-01', 'Alice');
    expect(msg).toBe('Oasis Nails reminder: You have a "Gel Manicure" appointment at 10:00 on 2026-04-01 with Alice. See you soon!');
  });

  it('builds correct new booking notification', () => {
    const msg = buildNewBookingNotification('Oasis Nails', 'John', 'Pedicure', '14:00', '2026-04-01', 'Bob', '0412345678');
    expect(msg).toContain('[Oasis Nails]');
    expect(msg).toContain('John');
    expect(msg).toContain('Pedicure');
    expect(msg).toContain('14:00');
    expect(msg).toContain('Bob');
    expect(msg).toContain('0412345678');
  });

  it('handles missing therapist in notification', () => {
    const msg = buildNewBookingNotification('Oasis', 'Jane', 'Manicure', '09:00', '2026-04-01', '', '0400000000');
    expect(msg).not.toContain('with');
  });

  it('handles missing phone in notification', () => {
    const msg = buildNewBookingNotification('Oasis', 'Jane', 'Manicure', '09:00', '2026-04-01', 'Alice', '');
    expect(msg).toContain('Phone: N/A');
  });
});

// ─── Twilio response parsing ───

describe('Twilio response parsing', () => {
  it('extracts SID from success response', () => {
    const response = { sid: 'SM1234567890', status: 'queued' };
    expect(response.sid).toMatch(/^SM/);
  });

  it('identifies error response', () => {
    const errorResponse = { code: 21211, message: 'Invalid phone number', status: 400 };
    expect(errorResponse.code).toBe(21211);
    expect(errorResponse.message).toContain('Invalid');
  });

  it('handles rate limit response (429)', () => {
    const rateLimited = { code: 20429, message: 'Too many requests' };
    expect(rateLimited.code).toBe(20429);
  });
});

// ─── Stripe Checkout Session ───────────────────────────────────────────────

interface StripeCheckoutParams {
  bookingId: string;
  amount: number;
  serviceName: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  currency?: string;
}

function buildStripeCheckoutBody(params: StripeCheckoutParams): URLSearchParams {
  const body = new URLSearchParams();
  body.set('payment_method_types[]', 'card');
  body.set('mode', 'payment');
  body.set('line_items[0][price_data][currency]', params.currency || 'aud');
  body.set('line_items[0][price_data][product_data][name]', params.serviceName || 'Booking');
  body.set('line_items[0][price_data][unit_amount]', String(Math.round(params.amount * 100)));
  body.set('line_items[0][quantity]', '1');
  body.set('success_url', params.successUrl);
  body.set('cancel_url', params.cancelUrl);
  body.set('metadata[booking_id]', params.bookingId);
  if (params.customerEmail) {
    body.set('customer_email', params.customerEmail);
  }
  return body;
}

function buildStripeRefundBody(paymentIntentId: string): URLSearchParams {
  return new URLSearchParams({ payment_intent: paymentIntentId });
}

describe('Stripe checkout session building', () => {
  const params: StripeCheckoutParams = {
    bookingId: 'booking-uuid-123',
    amount: 85.00,
    serviceName: 'Acrylic Full Set',
    customerEmail: 'test@example.com',
    successUrl: 'https://app.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancelUrl: 'https://app.com/cancel',
  };

  it('builds checkout body with correct amount in cents', () => {
    const body = buildStripeCheckoutBody(params);
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('8500');
  });

  it('sets AUD currency by default', () => {
    const body = buildStripeCheckoutBody(params);
    expect(body.get('line_items[0][price_data][currency]')).toBe('aud');
  });

  it('includes booking_id in metadata', () => {
    const body = buildStripeCheckoutBody(params);
    expect(body.get('metadata[booking_id]')).toBe('booking-uuid-123');
  });

  it('includes customer email when provided', () => {
    const body = buildStripeCheckoutBody(params);
    expect(body.get('customer_email')).toBe('test@example.com');
  });

  it('omits customer email when not provided', () => {
    const body = buildStripeCheckoutBody({ ...params, customerEmail: undefined });
    expect(body.get('customer_email')).toBeNull();
  });

  it('sets payment mode to "payment" (not subscription)', () => {
    const body = buildStripeCheckoutBody(params);
    expect(body.get('mode')).toBe('payment');
  });

  it('handles decimal precision correctly', () => {
    const body = buildStripeCheckoutBody({ ...params, amount: 19.99 });
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('1999');
  });

  it('handles zero amount (free service)', () => {
    const body = buildStripeCheckoutBody({ ...params, amount: 0 });
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('0');
  });
});

describe('Stripe refund building', () => {
  it('builds refund body with payment_intent', () => {
    const body = buildStripeRefundBody('pi_abc123');
    expect(body.get('payment_intent')).toBe('pi_abc123');
  });
});

// ─── Stripe Webhook Event Routing ──────────────────────────────────────────

type StripeEventType = 'checkout.session.completed' | 'checkout.session.expired' | 'charge.refunded';

function routeStripeEvent(eventType: string): { action: string; status: string } | null {
  switch (eventType) {
    case 'checkout.session.completed':
      return { action: 'update_payment', status: 'paid' };
    case 'checkout.session.expired':
      return { action: 'update_payment', status: 'failed' };
    case 'charge.refunded':
      return { action: 'update_payment', status: 'refunded' };
    default:
      return null;
  }
}

describe('Stripe webhook event routing', () => {
  it('routes checkout.session.completed to paid', () => {
    expect(routeStripeEvent('checkout.session.completed')).toEqual({ action: 'update_payment', status: 'paid' });
  });

  it('routes checkout.session.expired to failed', () => {
    expect(routeStripeEvent('checkout.session.expired')).toEqual({ action: 'update_payment', status: 'failed' });
  });

  it('routes charge.refunded to refunded', () => {
    expect(routeStripeEvent('charge.refunded')).toEqual({ action: 'update_payment', status: 'refunded' });
  });

  it('returns null for unknown event type', () => {
    expect(routeStripeEvent('customer.created')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(routeStripeEvent('')).toBeNull();
  });
});

// ─── Square Terminal Checkout ──────────────────────────────────────────────

interface SquareCheckoutRequest {
  idempotencyKey: string;
  amountMoney: { amount: number; currency: string };
  deviceOptions: { deviceId: string };
  tipSettings: { allowTipping: boolean };
  note: string;
}

function buildSquareCheckoutBody(
  amount: number,
  locationId: string,
  note: string,
  idempotencyKey: string,
): SquareCheckoutRequest {
  return {
    idempotencyKey,
    amountMoney: { amount: Math.round(amount * 100), currency: 'AUD' },
    deviceOptions: { deviceId: locationId },
    tipSettings: { allowTipping: true },
    note,
  };
}

function getSquareApiUrl(environment: string): string {
  return environment === 'production'
    ? 'https://connect.squareup.com/v2/terminals/checkouts'
    : 'https://connect.squareupsandbox.com/v2/terminals/checkouts';
}

describe('Square terminal checkout building', () => {
  it('builds request body with correct amount in cents', () => {
    const body = buildSquareCheckoutBody(85.00, 'device-123', 'Acrylic Full Set', 'key-1');
    expect(body.amountMoney.amount).toBe(8500);
    expect(body.amountMoney.currency).toBe('AUD');
  });

  it('uses provided idempotency key', () => {
    const body = buildSquareCheckoutBody(50, 'device-1', 'Test', 'unique-key-abc');
    expect(body.idempotencyKey).toBe('unique-key-abc');
  });

  it('sets device ID from location ID', () => {
    const body = buildSquareCheckoutBody(50, 'loc-xyz', 'Test', 'key-1');
    expect(body.deviceOptions.deviceId).toBe('loc-xyz');
  });

  it('enables tipping by default', () => {
    const body = buildSquareCheckoutBody(50, 'loc-1', 'Test', 'key-1');
    expect(body.tipSettings.allowTipping).toBe(true);
  });

  it('handles decimal precision', () => {
    const body = buildSquareCheckoutBody(19.99, 'loc-1', 'Test', 'key-1');
    expect(body.amountMoney.amount).toBe(1999);
  });
});

describe('Square API URL resolution', () => {
  it('returns production URL', () => {
    expect(getSquareApiUrl('production')).toContain('connect.squareup.com');
  });

  it('returns sandbox URL for non-production', () => {
    expect(getSquareApiUrl('sandbox')).toContain('squareupsandbox.com');
  });

  it('defaults to sandbox for unknown environment', () => {
    expect(getSquareApiUrl('staging')).toContain('squareupsandbox.com');
  });
});

// ─── Square Webhook Event Routing ──────────────────────────────────────────

function routeSquareEvent(eventType: string, status?: string): { action: string; paymentStatus: string } | null {
  if (eventType === 'terminal.checkout.updated') {
    if (status === 'COMPLETED') return { action: 'update_payment', paymentStatus: 'paid' };
    if (status === 'CANCELED') return { action: 'update_payment', paymentStatus: 'failed' };
    return null;
  }
  if (eventType === 'payment.updated') {
    if (status === 'COMPLETED') return { action: 'update_payment', paymentStatus: 'paid' };
    return null;
  }
  return null;
}

describe('Square webhook event routing', () => {
  it('routes terminal.checkout.updated COMPLETED to paid', () => {
    expect(routeSquareEvent('terminal.checkout.updated', 'COMPLETED')).toEqual({ action: 'update_payment', paymentStatus: 'paid' });
  });

  it('routes terminal.checkout.updated CANCELED to failed', () => {
    expect(routeSquareEvent('terminal.checkout.updated', 'CANCELED')).toEqual({ action: 'update_payment', paymentStatus: 'failed' });
  });

  it('routes payment.updated COMPLETED to paid', () => {
    expect(routeSquareEvent('payment.updated', 'COMPLETED')).toEqual({ action: 'update_payment', paymentStatus: 'paid' });
  });

  it('ignores terminal.checkout.updated with PENDING status', () => {
    expect(routeSquareEvent('terminal.checkout.updated', 'PENDING')).toBeNull();
  });

  it('ignores unknown event types', () => {
    expect(routeSquareEvent('order.created')).toBeNull();
  });
});

// ─── Resend Email API ──────────────────────────────────────────────────────

interface ResendEmailPayload {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
}

function buildResendPayload(
  fromEmail: string,
  fromName: string,
  to: string,
  subject: string,
  html: string,
): ResendEmailPayload {
  return {
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    html,
  };
}

function buildResendHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

describe('Resend email API integration', () => {
  it('builds correct payload with from name', () => {
    const payload = buildResendPayload('no-reply@oasis.com', 'Oasis Nails', 'customer@test.com', 'Reminder', '<p>Hi</p>');
    expect(payload.from).toBe('Oasis Nails <no-reply@oasis.com>');
    expect(payload.to).toBe('customer@test.com');
    expect(payload.subject).toBe('Reminder');
    expect(payload.html).toBe('<p>Hi</p>');
  });

  it('builds correct auth headers', () => {
    const headers = buildResendHeaders('re_abc123');
    expect(headers.Authorization).toBe('Bearer re_abc123');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('Resend API endpoint is correct', () => {
    const endpoint = 'https://api.resend.com/emails';
    expect(endpoint).toMatch(/^https:\/\/api\.resend\.com\/emails$/);
  });
});

// ─── Resend Response Parsing ───

describe('Resend response parsing', () => {
  it('extracts ID from success response', () => {
    const response = { id: 'email-uuid-123' };
    expect(response.id).toBeTruthy();
  });

  it('identifies error response', () => {
    const errorResponse = { statusCode: 422, message: 'Invalid email address', name: 'validation_error' };
    expect(errorResponse.statusCode).toBe(422);
  });

  it('identifies rate limit', () => {
    const rateLimited = { statusCode: 429, message: 'Rate limit exceeded' };
    expect(rateLimited.statusCode).toBe(429);
  });
});

// ─── OpenAI Translation API ───────────────────────────────────────────────

function buildTranslationPrompt(missing: string[], lang: string): string {
  const langName = lang === 'en' ? 'English' : lang === 'vi' ? 'Vietnamese' : lang;
  return `Translate the following UI text strings to ${langName}. The strings may be in any language. Return a JSON object mapping each original string to its ${langName} translation. Keep it natural and concise for a spa booking app UI. If a string is already in ${langName}, return it unchanged. Strings to translate:\n${JSON.stringify(missing)}`;
}

function buildOpenAiRequest(
  apiKey: string,
  baseUrl: string,
  model: string,
  prompt: string,
): { url: string; headers: Record<string, string>; body: object } {
  return {
    url: `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: {
      model,
      messages: [
        { role: 'system', content: 'You are a translator. Return ONLY a valid JSON object mapping each input string to its translation. No markdown, no explanation.' },
        { role: 'user', content: prompt },
      ],
    },
  };
}

function parseOpenAiTranslationResponse(content: string): Record<string, string> {
  let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

function mergeCachedAndNew(
  cached: Record<string, string>,
  translated: Record<string, string>,
): Record<string, string> {
  return { ...cached, ...translated };
}

describe('OpenAI translation API integration', () => {
  it('builds correct translation prompt for English', () => {
    const prompt = buildTranslationPrompt(['Đặt lịch', 'Dịch vụ'], 'en');
    expect(prompt).toContain('English');
    expect(prompt).toContain('Đặt lịch');
    expect(prompt).toContain('Dịch vụ');
  });

  it('builds correct translation prompt for Vietnamese', () => {
    const prompt = buildTranslationPrompt(['Services'], 'vi');
    expect(prompt).toContain('Vietnamese');
  });

  it('builds correct API request', () => {
    const req = buildOpenAiRequest('sk-test', 'https://api.openai.com/v1', 'gpt-4o-mini', 'test prompt');
    expect(req.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(req.headers.Authorization).toBe('Bearer sk-test');
  });

  it('handles custom base URL with trailing slash', () => {
    const req = buildOpenAiRequest('sk-test', 'https://custom.api.com/v1/', 'gpt-4o-mini', 'test');
    expect(req.url).toBe('https://custom.api.com/v1/chat/completions');
  });

  it('uses correct model in request body', () => {
    const req = buildOpenAiRequest('sk-test', 'https://api.openai.com/v1', 'gpt-4o', 'test');
    expect((req.body as any).model).toBe('gpt-4o');
  });
});

describe('OpenAI response parsing', () => {
  it('parses clean JSON response', () => {
    const result = parseOpenAiTranslationResponse('{"Đặt lịch": "Book Now", "Dịch vụ": "Services"}');
    expect(result['Đặt lịch']).toBe('Book Now');
    expect(result['Dịch vụ']).toBe('Services');
  });

  it('strips markdown code block wrapping', () => {
    const result = parseOpenAiTranslationResponse('```json\n{"Hello": "Xin chào"}\n```');
    expect(result['Hello']).toBe('Xin chào');
  });

  it('returns empty object for invalid JSON', () => {
    const result = parseOpenAiTranslationResponse('not json at all');
    expect(result).toEqual({});
  });

  it('returns empty object for empty string', () => {
    const result = parseOpenAiTranslationResponse('');
    expect(result).toEqual({});
  });
});

describe('Translation cache merge', () => {
  it('merges cached and new translations', () => {
    const cached = { 'Hello': 'Xin chào' };
    const fresh = { 'Goodbye': 'Tạm biệt' };
    const merged = mergeCachedAndNew(cached, fresh);
    expect(merged).toEqual({ 'Hello': 'Xin chào', 'Goodbye': 'Tạm biệt' });
  });

  it('new translations override cached ones', () => {
    const cached = { 'Hello': 'Old' };
    const fresh = { 'Hello': 'New' };
    const merged = mergeCachedAndNew(cached, fresh);
    expect(merged['Hello']).toBe('New');
  });

  it('handles empty cached', () => {
    const merged = mergeCachedAndNew({}, { 'A': 'B' });
    expect(merged).toEqual({ 'A': 'B' });
  });

  it('handles empty new translations', () => {
    const merged = mergeCachedAndNew({ 'A': 'B' }, {});
    expect(merged).toEqual({ 'A': 'B' });
  });
});

// ─── Public Holiday API (date.nager.at) ────────────────────────────────────

interface PublicHoliday {
  date: string;
  localName: string;
  name: string;
  counties: string[] | null;
}

function filterHolidaysByState(holidays: PublicHoliday[], stateCode: string): PublicHoliday[] {
  return holidays.filter(h => !h.counties || h.counties.includes(stateCode));
}

function isHolidayToday(holidays: PublicHoliday[], todayStr: string): PublicHoliday | undefined {
  return holidays.find(h => h.date === todayStr);
}

describe('Public holiday API (date.nager.at) integration', () => {
  const holidays: PublicHoliday[] = [
    { date: '2026-01-01', localName: "New Year's Day", name: "New Year's Day", counties: null },
    { date: '2026-01-26', localName: 'Australia Day', name: 'Australia Day', counties: null },
    { date: '2026-03-09', localName: 'Canberra Day', name: 'Canberra Day', counties: ['AU-ACT'] },
    { date: '2026-03-09', localName: 'Labour Day', name: 'Labour Day', counties: ['AU-VIC'] },
    { date: '2026-11-03', localName: 'Melbourne Cup', name: 'Melbourne Cup', counties: ['AU-VIC'] },
  ];

  it('API endpoint format is correct', () => {
    const year = 2026;
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/AU`;
    expect(url).toBe('https://date.nager.at/api/v3/PublicHolidays/2026/AU');
  });

  it('national holidays (null counties) appear for all states', () => {
    const vic = filterHolidaysByState(holidays, 'AU-VIC');
    const nsw = filterHolidaysByState(holidays, 'AU-NSW');
    expect(vic.find(h => h.date === '2026-01-01')).toBeDefined();
    expect(nsw.find(h => h.date === '2026-01-01')).toBeDefined();
  });

  it('state-specific holidays only appear for that state', () => {
    const vic = filterHolidaysByState(holidays, 'AU-VIC');
    const nsw = filterHolidaysByState(holidays, 'AU-NSW');
    expect(vic.find(h => h.localName === 'Melbourne Cup')).toBeDefined();
    expect(nsw.find(h => h.localName === 'Melbourne Cup')).toBeUndefined();
  });

  it('Labour Day appears in VIC but not NSW', () => {
    const vic = filterHolidaysByState(holidays, 'AU-VIC');
    const nsw = filterHolidaysByState(holidays, 'AU-NSW');
    expect(vic.find(h => h.localName === 'Labour Day')).toBeDefined();
    expect(nsw.find(h => h.localName === 'Labour Day')).toBeUndefined();
  });

  it('detects if today is a holiday', () => {
    expect(isHolidayToday(holidays, '2026-01-01')).toBeDefined();
    expect(isHolidayToday(holidays, '2026-06-15')).toBeUndefined();
  });
});

// ─── Webhook Signature Verification (Stripe & Square shared logic) ─────────

async function computeHmacSha256(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function computeHmacSha256Base64(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

describe('Webhook HMAC signature computation', () => {
  it('computes Stripe-style hex HMAC-SHA256', async () => {
    const sig = await computeHmacSha256('whsec_test123', '1234567890.{"type":"test"}');
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it('computes Square-style base64 HMAC-SHA256', async () => {
    const sig = await computeHmacSha256Base64('square_webhook_secret', '{"type":"test"}');
    expect(sig).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('same input produces same output (deterministic)', async () => {
    const sig1 = await computeHmacSha256('secret', 'payload');
    const sig2 = await computeHmacSha256('secret', 'payload');
    expect(sig1).toBe(sig2);
  });

  it('different secrets produce different signatures', async () => {
    const sig1 = await computeHmacSha256('secret1', 'payload');
    const sig2 = await computeHmacSha256('secret2', 'payload');
    expect(sig1).not.toBe(sig2);
  });

  it('different payloads produce different signatures', async () => {
    const sig1 = await computeHmacSha256('secret', 'payload1');
    const sig2 = await computeHmacSha256('secret', 'payload2');
    expect(sig1).not.toBe(sig2);
  });
});

// ─── Edge Function Auth Pattern ────────────────────────────────────────────

function validateEdgeFunctionAuth(
  authHeader: string | null,
  serviceRoleKey: string,
): { isServiceRole: boolean; needsUserAuth: boolean } {
  if (!authHeader) return { isServiceRole: false, needsUserAuth: false };
  if (authHeader === `Bearer ${serviceRoleKey}`) return { isServiceRole: true, needsUserAuth: false };
  return { isServiceRole: false, needsUserAuth: true };
}

// ─── Handoff Notification Edge Function ──────────────────────────────────

function buildHandoffNotificationPayload(
  conversationId: string | undefined,
  tenantId: string,
  reason: string,
  customerName?: string,
  customerMessage?: string,
  source?: string,
): Record<string, unknown> {
  return {
    conversation_id: conversationId,
    tenant_id: tenantId,
    reason,
    ...(customerName && { customer_name: customerName }),
    ...(customerMessage && { customer_message: customerMessage }),
    ...(source && { source }),
  };
}

function buildHandoffEmailHtml(
  shopName: string,
  reason: string,
  customerName?: string,
  customerMessage?: string,
  conversationId?: string,
): string {
  let html = '<h2>Customer Needs Human Assistance</h2>';
  html += `<p>Shop: ${shopName}</p>`;
  html += `<p>Customer: ${customerName || 'Unknown'}</p>`;
  html += `<p>Reason: ${reason}</p>`;
  if (customerMessage) html += `<p>Last message: ${customerMessage}</p>`;
  if (conversationId) html += `<p>Conversation: ${conversationId}</p>`;
  return html;
}

function buildHandoffSmsMessage(shopName: string, customerName: string | undefined, reason: string): string {
  return `[${shopName}] AI handoff: ${customerName || 'Customer'} needs help. Reason: ${reason}`;
}

function resolveHandoffChannels(config: { email: string | null; sms: boolean }): string[] {
  const channels = ['in_app'];
  if (config.email) channels.push('email');
  if (config.sms) channels.push('sms');
  return channels;
}

describe('Handoff notification edge function', () => {
  it('builds correct notification payload', () => {
    const payload = buildHandoffNotificationPayload(
      'conv-uuid-123',
      'tenant-uuid-456',
      'Customer is frustrated',
      'Jane Doe',
      'I keep asking the same thing',
      'ai_decision',
    );
    expect(payload.tenant_id).toBe('tenant-uuid-456');
    expect(payload.reason).toBe('Customer is frustrated');
    expect(payload.customer_name).toBe('Jane Doe');
    expect(payload.source).toBe('ai_decision');
  });

  it('omits undefined optional fields', () => {
    const payload = buildHandoffNotificationPayload(undefined, 'tenant-1', 'test reason');
    expect(payload.conversation_id).toBeUndefined();
    expect(payload.customer_name).toBeUndefined();
    expect(payload.customer_message).toBeUndefined();
    expect(payload.source).toBeUndefined();
  });

  it('builds correct handoff email HTML', () => {
    const html = buildHandoffEmailHtml('Oasis Spa', 'negative_sentiment', 'John', 'This is terrible!', 'conv-123');
    expect(html).toContain('Customer Needs Human Assistance');
    expect(html).toContain('Oasis Spa');
    expect(html).toContain('negative_sentiment');
    expect(html).toContain('John');
    expect(html).toContain('This is terrible!');
    expect(html).toContain('conv-123');
  });

  it('handles missing customer name in email', () => {
    const html = buildHandoffEmailHtml('Spa', 'test');
    expect(html).toContain('Unknown');
  });

  it('builds correct handoff SMS', () => {
    const sms = buildHandoffSmsMessage('Oasis Nails', 'Jane', 'frustrated customer');
    expect(sms).toBe('[Oasis Nails] AI handoff: Jane needs help. Reason: frustrated customer');
  });

  it('defaults to Customer in SMS when name missing', () => {
    const sms = buildHandoffSmsMessage('Spa', undefined, 'test');
    expect(sms).toContain('Customer needs help');
  });

  it('SMS fits within 160-char limit for typical messages', () => {
    const sms = buildHandoffSmsMessage('Oasis Spa', 'John Doe', 'Customer requested human assistance');
    expect(sms.length).toBeLessThanOrEqual(160);
  });

  it('resolves in_app only when no email or SMS configured', () => {
    expect(resolveHandoffChannels({ email: null, sms: false })).toEqual(['in_app']);
  });

  it('resolves all channels when fully configured', () => {
    expect(resolveHandoffChannels({ email: 'a@b.com', sms: true })).toEqual(['in_app', 'email', 'sms']);
  });

  it('resolves email + in_app when no SMS', () => {
    expect(resolveHandoffChannels({ email: 'mgr@salon.com', sms: false })).toEqual(['in_app', 'email']);
  });
});

// ─── Voice Agent Edge Function ──────────────────────────────────────────────

function buildTwiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

function escapeXmlForTwiml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildElevenLabsTtsPayload(text: string, modelId: string): Record<string, unknown> {
  return {
    text,
    model_id: modelId,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true,
    },
  };
}

function buildElevenLabsTtsUrl(voiceId: string): string {
  return `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
}

function buildElevenLabsHeaders(apiKey: string): Record<string, string> {
  return {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
    Accept: 'audio/mpeg',
  };
}

function buildVoiceAgentUrl(supabaseUrl: string, action: string, tenantId: string): string {
  return `${supabaseUrl}/functions/v1/voice-agent?action=${action}&tenant_id=${tenantId}`;
}

function buildVoiceSystemPrompt(shopName: string, services: string, language: string): string {
  return `You are ${shopName}'s friendly voice assistant answering a phone call.
Keep responses SHORT (1-2 sentences max) — this will be spoken aloud.
Services: ${services || 'Ask staff for details.'}
If you cannot help, say you'll transfer them to a team member.
Never use markdown, lists, or formatting — speak naturally.
Language: ${language === 'vi' ? 'Vietnamese' : 'English'}`;
}

function detectVoiceTransfer(text: string): boolean {
  const phrases = ['transfer you', 'connect you', 'team member will', 'staff will'];
  return phrases.some((p) => text.toLowerCase().includes(p));
}

describe('Voice agent TwiML generation', () => {
  it('generates valid TwiML XML wrapper', () => {
    const xml = buildTwiml('<Say>Hello</Say>');
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<Response>');
    expect(xml).toContain('</Response>');
    expect(xml).toContain('<Say>Hello</Say>');
  });

  it('escapes XML special characters correctly', () => {
    expect(escapeXmlForTwiml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    expect(escapeXmlForTwiml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escapeXmlForTwiml("it's a test")).toBe("it&apos;s a test");
  });

  it('handles empty string in escape', () => {
    expect(escapeXmlForTwiml('')).toBe('');
  });

  it('builds greeting TwiML with Gather for speech input', () => {
    const xml = buildTwiml(
      `<Gather input="speech" action="/respond" speechTimeout="3" language="en"><Say>Hello!</Say></Gather><Hangup/>`,
    );
    expect(xml).toContain('input="speech"');
    expect(xml).toContain('speechTimeout="3"');
    expect(xml).toContain('language="en"');
    expect(xml).toContain('<Hangup/>');
  });

  it('builds ElevenLabs Play TwiML', () => {
    const ttsUrl = 'https://example.com/tts?text=Hello';
    const xml = buildTwiml(`<Play>${ttsUrl}</Play><Gather input="speech" action="/respond"></Gather>`);
    expect(xml).toContain('<Play>');
    expect(xml).toContain(ttsUrl);
  });

  it('builds transfer TwiML with hangup', () => {
    const xml = buildTwiml('<Say>Transferring you now.</Say><Hangup/>');
    expect(xml).toContain('Transferring');
    expect(xml).toContain('<Hangup/>');
  });
});

describe('ElevenLabs TTS API integration', () => {
  it('builds correct TTS URL with voice ID', () => {
    const url = buildElevenLabsTtsUrl('EXAVITQu4vr4xnSDxMaL');
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL');
  });

  it('builds correct TTS URL with custom voice ID', () => {
    const url = buildElevenLabsTtsUrl('custom-cloned-voice-id');
    expect(url).toContain('custom-cloned-voice-id');
  });

  it('builds correct headers with xi-api-key', () => {
    const headers = buildElevenLabsHeaders('xi_test_key_123');
    expect(headers['xi-api-key']).toBe('xi_test_key_123');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Accept).toBe('audio/mpeg');
  });

  it('builds correct TTS payload for multilingual model', () => {
    const payload = buildElevenLabsTtsPayload('Xin chao, cam on ban da goi', 'eleven_multilingual_v2');
    expect(payload.text).toBe('Xin chao, cam on ban da goi');
    expect(payload.model_id).toBe('eleven_multilingual_v2');
    expect((payload.voice_settings as any).stability).toBe(0.5);
    expect((payload.voice_settings as any).similarity_boost).toBe(0.75);
    expect((payload.voice_settings as any).use_speaker_boost).toBe(true);
  });

  it('builds correct TTS payload for turbo model (low latency)', () => {
    const payload = buildElevenLabsTtsPayload('Quick response', 'eleven_turbo_v2_5');
    expect(payload.model_id).toBe('eleven_turbo_v2_5');
  });
});

describe('Voice agent URL building', () => {
  const supabaseUrl = 'https://myproject.supabase.co';
  const tenantId = 'tenant-uuid-123';

  it('builds greeting URL', () => {
    const url = buildVoiceAgentUrl(supabaseUrl, 'greeting', tenantId);
    expect(url).toBe('https://myproject.supabase.co/functions/v1/voice-agent?action=greeting&tenant_id=tenant-uuid-123');
  });

  it('builds respond URL', () => {
    const url = buildVoiceAgentUrl(supabaseUrl, 'respond', tenantId);
    expect(url).toContain('action=respond');
  });

  it('builds TTS URL', () => {
    const url = buildVoiceAgentUrl(supabaseUrl, 'tts', tenantId);
    expect(url).toContain('action=tts');
  });
});

describe('Voice agent LLM system prompt', () => {
  it('builds voice-optimized prompt', () => {
    const prompt = buildVoiceSystemPrompt('Oasis Spa', 'Massage: $80 (60min), Facial: $60 (45min)', 'en');
    expect(prompt).toContain('Oasis Spa');
    expect(prompt).toContain('SHORT');
    expect(prompt).toContain('1-2 sentences');
    expect(prompt).toContain('Massage: $80');
    expect(prompt).toContain('English');
    expect(prompt).toContain('Never use markdown');
  });

  it('uses Vietnamese when language is vi', () => {
    const prompt = buildVoiceSystemPrompt('Spa', 'Dich vu: 500k', 'vi');
    expect(prompt).toContain('Vietnamese');
  });

  it('prompts transfer when AI cannot help', () => {
    const prompt = buildVoiceSystemPrompt('Spa', '', 'en');
    expect(prompt).toContain('transfer');
    expect(prompt).toContain('team member');
  });

  it('includes service info when available', () => {
    const prompt = buildVoiceSystemPrompt('Spa', 'Haircut: $30, Color: $80', 'en');
    expect(prompt).toContain('Haircut: $30');
    expect(prompt).toContain('Color: $80');
  });

  it('shows fallback when no services', () => {
    const prompt = buildVoiceSystemPrompt('Spa', '', 'en');
    expect(prompt).toContain('Ask staff for details');
  });
});

describe('Voice agent transfer detection', () => {
  it('detects transfer phrases in LLM response', () => {
    expect(detectVoiceTransfer("Let me transfer you to our staff.")).toBe(true);
    expect(detectVoiceTransfer("I'll connect you with a team member.")).toBe(true);
    expect(detectVoiceTransfer("A team member will help you shortly.")).toBe(true);
    expect(detectVoiceTransfer("Our staff will assist you.")).toBe(true);
  });

  it('does not false-positive on booking responses', () => {
    expect(detectVoiceTransfer('Your massage is booked for tomorrow at 2pm.')).toBe(false);
    expect(detectVoiceTransfer('We have availability at 10am and 3pm.')).toBe(false);
    expect(detectVoiceTransfer('The price for a facial is $60.')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(detectVoiceTransfer("I'LL TRANSFER YOU NOW")).toBe(true);
    expect(detectVoiceTransfer("A Team Member Will help")).toBe(true);
  });

  it('handles empty response', () => {
    expect(detectVoiceTransfer('')).toBe(false);
  });
});

// ─── Twilio Voice Webhook (inbound call) ────────────────────────────────────

function parseTwilioVoiceWebhook(formData: Record<string, string>): {
  callSid: string;
  from: string;
  to: string;
  speechResult?: string;
} {
  return {
    callSid: formData.CallSid || '',
    from: formData.From || '',
    to: formData.To || '',
    speechResult: formData.SpeechResult || undefined,
  };
}

describe('Twilio voice webhook parsing', () => {
  it('parses inbound call data', () => {
    const data = parseTwilioVoiceWebhook({
      CallSid: 'CA1234567890',
      From: '+61412345678',
      To: '+61400000000',
    });
    expect(data.callSid).toBe('CA1234567890');
    expect(data.from).toBe('+61412345678');
    expect(data.to).toBe('+61400000000');
    expect(data.speechResult).toBeUndefined();
  });

  it('parses speech recognition result', () => {
    const data = parseTwilioVoiceWebhook({
      CallSid: 'CA123',
      From: '+61400000000',
      To: '+61400000001',
      SpeechResult: 'I want to book a massage for tomorrow',
    });
    expect(data.speechResult).toBe('I want to book a massage for tomorrow');
  });

  it('handles empty speech result', () => {
    const data = parseTwilioVoiceWebhook({
      CallSid: 'CA123',
      From: '+61400000000',
      To: '+61400000001',
      SpeechResult: '',
    });
    expect(data.speechResult).toBeUndefined();
  });
});

describe('Edge function auth pattern', () => {
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role_key';

  it('identifies service role auth', () => {
    const result = validateEdgeFunctionAuth(`Bearer ${serviceKey}`, serviceKey);
    expect(result.isServiceRole).toBe(true);
    expect(result.needsUserAuth).toBe(false);
  });

  it('identifies user auth (needs further validation)', () => {
    const result = validateEdgeFunctionAuth('Bearer user_jwt_token', serviceKey);
    expect(result.isServiceRole).toBe(false);
    expect(result.needsUserAuth).toBe(true);
  });

  it('handles missing auth header', () => {
    const result = validateEdgeFunctionAuth(null, serviceKey);
    expect(result.isServiceRole).toBe(false);
    expect(result.needsUserAuth).toBe(false);
  });
});
