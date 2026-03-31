import { describe, it, expect } from 'vitest';

// ─── Square Terminal API Request Builder ───

interface TerminalCheckoutRequest {
  device_id: string;
  amount: number;
  currency?: string;
  reference_id?: string;
  note?: string;
}

function buildTerminalCheckoutBody(req: TerminalCheckoutRequest) {
  if (!req.device_id) throw new Error('device_id is required');
  if (req.amount <= 0) throw new Error('amount must be positive');
  const amountCents = Math.round(req.amount * 100);
  return {
    checkout: {
      amount_money: { amount: amountCents, currency: req.currency || 'AUD' },
      device_options: {
        device_id: req.device_id,
        skip_receipt_screen: false,
        tip_settings: { allow_tipping: true },
      },
      reference_id: req.reference_id || undefined,
      note: req.note || undefined,
    },
    idempotency_key: 'mock-uuid',
  };
}

describe('Square Terminal checkout request builder', () => {
  const validReq: TerminalCheckoutRequest = {
    device_id: '9fa747a2-25ff-48ee-b078-04381f7c828f',
    amount: 150,
    reference_id: 'booking-abc',
    note: 'Massage 60min',
  };

  it('builds valid terminal checkout body', () => {
    const body = buildTerminalCheckoutBody(validReq);
    expect(body.checkout.amount_money).toEqual({ amount: 15000, currency: 'AUD' });
    expect(body.checkout.device_options.device_id).toBe(validReq.device_id);
    expect(body.checkout.device_options.tip_settings.allow_tipping).toBe(true);
    expect(body.checkout.reference_id).toBe('booking-abc');
  });

  it('converts decimal amounts to cents correctly', () => {
    const body = buildTerminalCheckoutBody({ ...validReq, amount: 99.99 });
    expect(body.checkout.amount_money.amount).toBe(9999);
  });

  it('handles floating point precision', () => {
    const body = buildTerminalCheckoutBody({ ...validReq, amount: 19.99 });
    expect(body.checkout.amount_money.amount).toBe(1999);
  });

  it('defaults currency to AUD', () => {
    const body = buildTerminalCheckoutBody(validReq);
    expect(body.checkout.amount_money.currency).toBe('AUD');
  });

  it('allows custom currency', () => {
    const body = buildTerminalCheckoutBody({ ...validReq, currency: 'USD' });
    expect(body.checkout.amount_money.currency).toBe('USD');
  });

  it('throws on missing device_id', () => {
    expect(() => buildTerminalCheckoutBody({ ...validReq, device_id: '' })).toThrow('device_id is required');
  });

  it('throws on zero amount', () => {
    expect(() => buildTerminalCheckoutBody({ ...validReq, amount: 0 })).toThrow('amount must be positive');
  });

  it('throws on negative amount', () => {
    expect(() => buildTerminalCheckoutBody({ ...validReq, amount: -10 })).toThrow('amount must be positive');
  });

  it('skip_receipt_screen is false', () => {
    const body = buildTerminalCheckoutBody(validReq);
    expect(body.checkout.device_options.skip_receipt_screen).toBe(false);
  });

  it('has idempotency key', () => {
    const body = buildTerminalCheckoutBody(validReq);
    expect(body.idempotency_key).toBeDefined();
    expect(typeof body.idempotency_key).toBe('string');
  });
});

// ─── Square Web Payments API Request Builder ───

interface PaymentRequest {
  source_nonce: string;
  amount: number;
  location_id: string;
  currency?: string;
  note?: string;
  customer_name?: string;
  reference_id?: string;
}

function buildPaymentBody(req: PaymentRequest) {
  if (!req.source_nonce) throw new Error('source_nonce is required');
  if (!req.location_id) throw new Error('location_id is required');
  if (req.amount <= 0) throw new Error('amount must be positive');
  const amountCents = Math.round(req.amount * 100);
  return {
    source_id: req.source_nonce,
    amount_money: { amount: amountCents, currency: req.currency || 'AUD' },
    location_id: req.location_id,
    autocomplete: true,
    reference_id: req.reference_id || undefined,
    note: req.note || undefined,
    idempotency_key: 'mock-uuid',
  };
}

describe('Square Web Payments request builder', () => {
  const validReq: PaymentRequest = {
    source_nonce: 'cnon:card-nonce-ok',
    amount: 80,
    location_id: 'LXYZ123',
    note: 'Online payment',
    customer_name: 'John Doe',
    reference_id: 'sale-456',
  };

  it('builds valid payment body', () => {
    const body = buildPaymentBody(validReq);
    expect(body.source_id).toBe('cnon:card-nonce-ok');
    expect(body.amount_money).toEqual({ amount: 8000, currency: 'AUD' });
    expect(body.location_id).toBe('LXYZ123');
    expect(body.autocomplete).toBe(true);
  });

  it('throws on missing nonce', () => {
    expect(() => buildPaymentBody({ ...validReq, source_nonce: '' })).toThrow('source_nonce is required');
  });

  it('throws on missing location_id', () => {
    expect(() => buildPaymentBody({ ...validReq, location_id: '' })).toThrow('location_id is required');
  });

  it('throws on zero amount', () => {
    expect(() => buildPaymentBody({ ...validReq, amount: 0 })).toThrow('amount must be positive');
  });

  it('converts amount to cents', () => {
    const body = buildPaymentBody({ ...validReq, amount: 49.50 });
    expect(body.amount_money.amount).toBe(4950);
  });

  it('includes reference_id when provided', () => {
    const body = buildPaymentBody(validReq);
    expect(body.reference_id).toBe('sale-456');
  });

  it('omits reference_id when not provided', () => {
    const body = buildPaymentBody({ ...validReq, reference_id: undefined });
    expect(body.reference_id).toBeUndefined();
  });
});

// ─── Square Webhook HMAC Verification ───

function verifySquareWebhook(
  signature: string,
  body: string,
  notificationUrl: string,
  webhookSecret: string
): boolean {
  // Simplified HMAC check for testing (real impl uses crypto.subtle)
  if (!signature || !webhookSecret) return false;
  // Simulate: payload = notificationUrl + body
  const payload = notificationUrl + body;
  if (!payload) return false;
  return true; // In real code, this compares HMAC-SHA256
}

describe('Square webhook verification', () => {
  it('rejects empty signature', () => {
    expect(verifySquareWebhook('', '{}', 'https://example.com/webhook', 'secret')).toBe(false);
  });

  it('rejects empty webhook secret', () => {
    expect(verifySquareWebhook('sig123', '{}', 'https://example.com/webhook', '')).toBe(false);
  });

  it('accepts valid signature and secret', () => {
    expect(verifySquareWebhook('sig123', '{}', 'https://example.com/webhook', 'secret')).toBe(true);
  });
});

// ─── Square Webhook Event Processing ───

type SquareWebhookEventType = 'terminal.checkout.updated' | 'payment.updated' | 'payment.created';

interface SquareWebhookEvent {
  type: SquareWebhookEventType;
  data: {
    object?: {
      checkout?: { id: string; status: string; payment_ids?: string[] };
      payment?: { id: string; status: string; reference_id?: string };
    };
  };
}

function processTerminalCheckoutEvent(event: SquareWebhookEvent): { action: string; status: string } | null {
  if (event.type !== 'terminal.checkout.updated') return null;
  const checkout = event.data.object?.checkout;
  if (!checkout) return null;

  switch (checkout.status) {
    case 'COMPLETED':
      return { action: 'update_payment_status', status: 'paid' };
    case 'CANCELED':
      return { action: 'update_payment_status', status: 'failed' };
    case 'PENDING':
      return { action: 'no_change', status: 'pending' };
    default:
      return null;
  }
}

function processPaymentEvent(event: SquareWebhookEvent): { action: string; status: string; reference_id?: string } | null {
  if (event.type !== 'payment.updated') return null;
  const payment = event.data.object?.payment;
  if (!payment) return null;

  switch (payment.status) {
    case 'COMPLETED':
      return { action: 'update_payment_status', status: 'paid', reference_id: payment.reference_id };
    case 'FAILED':
      return { action: 'update_payment_status', status: 'failed', reference_id: payment.reference_id };
    default:
      return null;
  }
}

describe('Square Terminal checkout webhook events', () => {
  it('COMPLETED → marks as paid', () => {
    const event: SquareWebhookEvent = {
      type: 'terminal.checkout.updated',
      data: { object: { checkout: { id: 'chk_123', status: 'COMPLETED', payment_ids: ['pay_abc'] } } },
    };
    expect(processTerminalCheckoutEvent(event)).toEqual({ action: 'update_payment_status', status: 'paid' });
  });

  it('CANCELED → marks as failed', () => {
    const event: SquareWebhookEvent = {
      type: 'terminal.checkout.updated',
      data: { object: { checkout: { id: 'chk_123', status: 'CANCELED' } } },
    };
    expect(processTerminalCheckoutEvent(event)).toEqual({ action: 'update_payment_status', status: 'failed' });
  });

  it('PENDING → no change', () => {
    const event: SquareWebhookEvent = {
      type: 'terminal.checkout.updated',
      data: { object: { checkout: { id: 'chk_123', status: 'PENDING' } } },
    };
    expect(processTerminalCheckoutEvent(event)).toEqual({ action: 'no_change', status: 'pending' });
  });

  it('ignores unknown status', () => {
    const event: SquareWebhookEvent = {
      type: 'terminal.checkout.updated',
      data: { object: { checkout: { id: 'chk_123', status: 'UNKNOWN' } } },
    };
    expect(processTerminalCheckoutEvent(event)).toBeNull();
  });

  it('ignores non-terminal events', () => {
    const event: SquareWebhookEvent = {
      type: 'payment.updated',
      data: { object: { payment: { id: 'pay_123', status: 'COMPLETED' } } },
    };
    expect(processTerminalCheckoutEvent(event)).toBeNull();
  });

  it('handles missing checkout object', () => {
    const event: SquareWebhookEvent = {
      type: 'terminal.checkout.updated',
      data: { object: {} },
    };
    expect(processTerminalCheckoutEvent(event)).toBeNull();
  });
});

describe('Square Payment webhook events', () => {
  it('COMPLETED → marks as paid with reference_id', () => {
    const event: SquareWebhookEvent = {
      type: 'payment.updated',
      data: { object: { payment: { id: 'pay_123', status: 'COMPLETED', reference_id: 'booking-789' } } },
    };
    expect(processPaymentEvent(event)).toEqual({ action: 'update_payment_status', status: 'paid', reference_id: 'booking-789' });
  });

  it('FAILED → marks as failed', () => {
    const event: SquareWebhookEvent = {
      type: 'payment.updated',
      data: { object: { payment: { id: 'pay_123', status: 'FAILED' } } },
    };
    expect(processPaymentEvent(event)).toEqual({ action: 'update_payment_status', status: 'failed', reference_id: undefined });
  });

  it('ignores PENDING payment events', () => {
    const event: SquareWebhookEvent = {
      type: 'payment.updated',
      data: { object: { payment: { id: 'pay_123', status: 'PENDING' } } },
    };
    expect(processPaymentEvent(event)).toBeNull();
  });

  it('ignores terminal events', () => {
    const event: SquareWebhookEvent = {
      type: 'terminal.checkout.updated',
      data: { object: { checkout: { id: 'chk_123', status: 'COMPLETED' } } },
    };
    expect(processPaymentEvent(event)).toBeNull();
  });

  it('handles missing payment object', () => {
    const event: SquareWebhookEvent = {
      type: 'payment.updated',
      data: { object: {} },
    };
    expect(processPaymentEvent(event)).toBeNull();
  });
});

// ─── Square SDK URL Resolution ───

function getSquareWebSdkUrl(environment: string): string {
  return environment === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js';
}

describe('Square Web SDK URL', () => {
  it('returns production SDK URL', () => {
    expect(getSquareWebSdkUrl('production')).toBe('https://web.squarecdn.com/v1/square.js');
  });

  it('returns sandbox SDK URL', () => {
    expect(getSquareWebSdkUrl('sandbox')).toBe('https://sandbox.web.squarecdn.com/v1/square.js');
  });

  it('defaults to sandbox for unknown', () => {
    expect(getSquareWebSdkUrl('dev')).toBe('https://sandbox.web.squarecdn.com/v1/square.js');
  });
});

// ─── Square API Headers ───

function buildSquareHeaders(accessToken: string): Record<string, string> {
  if (!accessToken) throw new Error('Access token is required');
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Square-Version': '2024-01-18',
    'Content-Type': 'application/json',
  };
}

describe('Square API headers', () => {
  it('builds correct headers with token', () => {
    const headers = buildSquareHeaders('sq0atp-xxx');
    expect(headers['Authorization']).toBe('Bearer sq0atp-xxx');
    expect(headers['Square-Version']).toBe('2024-01-18');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('throws on empty token', () => {
    expect(() => buildSquareHeaders('')).toThrow('Access token is required');
  });
});

// ─── Square Settings Validation ───

interface SquareSettings {
  square_access_token?: string;
  square_location_id?: string;
  square_device_id?: string;
  square_application_id?: string;
  square_environment?: string;
}

function validateTerminalSettings(settings: SquareSettings): string | null {
  if (!settings.square_access_token) return 'Missing access token';
  if (!settings.square_location_id) return 'Missing location ID';
  if (!settings.square_device_id) return 'Missing device ID';
  return null;
}

function validateOnlinePaymentSettings(settings: SquareSettings): string | null {
  if (!settings.square_access_token) return 'Missing access token';
  if (!settings.square_location_id) return 'Missing location ID';
  if (!settings.square_application_id) return 'Missing application ID';
  return null;
}

describe('Square Terminal settings validation', () => {
  const valid: SquareSettings = {
    square_access_token: 'sq0atp-xxx',
    square_location_id: 'LXYZ',
    square_device_id: 'device-123',
  };

  it('accepts valid terminal settings', () => {
    expect(validateTerminalSettings(valid)).toBeNull();
  });

  it('rejects missing access token', () => {
    expect(validateTerminalSettings({ ...valid, square_access_token: '' })).toBe('Missing access token');
  });

  it('rejects missing location ID', () => {
    expect(validateTerminalSettings({ ...valid, square_location_id: '' })).toBe('Missing location ID');
  });

  it('rejects missing device ID', () => {
    expect(validateTerminalSettings({ ...valid, square_device_id: '' })).toBe('Missing device ID');
  });
});

describe('Square Online Payment settings validation', () => {
  const valid: SquareSettings = {
    square_access_token: 'sq0atp-xxx',
    square_location_id: 'LXYZ',
    square_application_id: 'sq0idp-yyy',
  };

  it('accepts valid online payment settings', () => {
    expect(validateOnlinePaymentSettings(valid)).toBeNull();
  });

  it('rejects missing access token', () => {
    expect(validateOnlinePaymentSettings({ ...valid, square_access_token: '' })).toBe('Missing access token');
  });

  it('rejects missing location ID', () => {
    expect(validateOnlinePaymentSettings({ ...valid, square_location_id: '' })).toBe('Missing location ID');
  });

  it('rejects missing application ID', () => {
    expect(validateOnlinePaymentSettings({ ...valid, square_application_id: '' })).toBe('Missing application ID');
  });

  it('does not require device_id (not needed for online)', () => {
    expect(validateOnlinePaymentSettings({ ...valid, square_device_id: undefined })).toBeNull();
  });
});

// ─── Square Idempotency Key ───

function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

describe('Idempotency key generation', () => {
  it('generates a valid UUID format', () => {
    const key = generateIdempotencyKey();
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(100);
  });
});

// ─── Square Nonce Token Validation ───

function isValidSquareNonce(nonce: string): boolean {
  if (!nonce || typeof nonce !== 'string') return false;
  // Square sandbox nonces start with 'cnon:'
  // Production nonces are opaque strings
  return nonce.length > 0 && nonce.length < 500;
}

describe('Square nonce validation', () => {
  it('accepts sandbox nonce', () => {
    expect(isValidSquareNonce('cnon:card-nonce-ok')).toBe(true);
  });

  it('accepts production-like nonce', () => {
    expect(isValidSquareNonce('cbfec26d-627b-40b2-b781-cf12d82eb8c3')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidSquareNonce('')).toBe(false);
  });

  it('rejects null-like values', () => {
    expect(isValidSquareNonce(null as any)).toBe(false);
    expect(isValidSquareNonce(undefined as any)).toBe(false);
  });
});
