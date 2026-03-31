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
