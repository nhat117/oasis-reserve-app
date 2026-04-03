import { describe, it, expect } from 'vitest';
import * as sinchFixtures from './fixtures/sinch-webhooks';
import * as freshaFixtures from './fixtures/fresha-webhooks';

/**
 * Tests for webhook payload processing logic.
 * These test the normalization and data extraction functions
 * without calling actual Supabase.
 */

// ─── Platform detection (from sinch-webhook) ──────────────────────

const SINCH_CHANNEL_MAP: Record<string, string> = {
  MESSENGER: 'facebook',
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
  VIBER: 'viber',
  VIBERBM: 'viber',
  RCS: 'rcs',
  INSTAGRAM: 'instagram',
  TELEGRAM: 'telegram',
};

function detectPlatform(sinchChannel: string): string {
  return SINCH_CHANNEL_MAP[sinchChannel] || 'web';
}

// ─── Fresha status mapping ──────────────────────────────────────────

function mapFreshaStatus(freshaStatus: string): string {
  const map: Record<string, string> = {
    confirmed: 'confirmed',
    pending: 'confirmed',
    completed: 'completed',
    cancelled: 'cancelled',
    no_show: 'no_show',
  };
  return map[freshaStatus?.toLowerCase()] || 'confirmed';
}

// ─── Sinch message normalization ────────────────────────────────────

function normalizeMessage(payload: typeof sinchFixtures.messageInboundInstagram) {
  const msg = payload.message;
  const text = msg.contact_message?.text_message?.text
    || (msg.contact_message as any)?.media_card_message?.caption
    || '';

  return {
    sinch_contact_id: msg.contact_id,
    sinch_conversation_id: msg.conversation_id,
    sinch_message_id: msg.id,
    direction: 'inbound',
    sender_type: 'customer',
    sender_name: msg.channel_identity.identity,
    content: text,
    content_type: 'text',
    platform: detectPlatform(msg.channel_identity.channel),
    channel_identity: msg.channel_identity.identity,
  };
}

// ─── Fresha appointment normalization ───────────────────────────────

function normalizeAppointment(data: typeof freshaFixtures.appointmentCreated.data) {
  return {
    fresha_id: String(data.id),
    customer_name: data.client?.first_name
      ? `${data.client.first_name} ${data.client.last_name || ''}`.trim()
      : 'Walk-in',
    customer_phone: data.client?.phone || '',
    customer_email: data.client?.email || '',
    service_name: data.service?.name || 'Unknown Service',
    staff_name: data.staff?.name || '',
    date: data.date,
    start_time: data.start_time,
    end_time: data.end_time,
    status: mapFreshaStatus(data.status),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('Sinch Webhook: Platform Detection', () => {
  it('detects Instagram', () => {
    expect(detectPlatform('INSTAGRAM')).toBe('instagram');
  });

  it('detects Facebook/Messenger', () => {
    expect(detectPlatform('MESSENGER')).toBe('facebook');
  });

  it('detects WhatsApp', () => {
    expect(detectPlatform('WHATSAPP')).toBe('whatsapp');
  });

  it('detects SMS', () => {
    expect(detectPlatform('SMS')).toBe('sms');
  });

  it('detects Viber', () => {
    expect(detectPlatform('VIBER')).toBe('viber');
    expect(detectPlatform('VIBERBM')).toBe('viber');
  });

  it('detects RCS', () => {
    expect(detectPlatform('RCS')).toBe('rcs');
  });

  it('detects Telegram', () => {
    expect(detectPlatform('TELEGRAM')).toBe('telegram');
  });

  it('defaults to web for unknown', () => {
    expect(detectPlatform('')).toBe('web');
    expect(detectPlatform('UNKNOWN')).toBe('web');
  });
});

describe('Sinch Webhook: Message Normalization', () => {
  it('normalizes incoming Instagram message', () => {
    const result = normalizeMessage(sinchFixtures.messageInboundInstagram);
    expect(result.direction).toBe('inbound');
    expect(result.sender_type).toBe('customer');
    expect(result.sender_name).toBe('jane_doe_ig');
    expect(result.content).toContain('book a massage');
    expect(result.platform).toBe('instagram');
    expect(result.sinch_contact_id).toBe('contact_001');
    expect(result.sinch_conversation_id).toBe('conv_001');
  });

  it('normalizes Messenger message', () => {
    const result = normalizeMessage(sinchFixtures.messageInboundMessenger);
    expect(result.platform).toBe('facebook');
    expect(result.sender_name).toBe('534183549153491');
    expect(result.content).toContain('services');
  });

  it('normalizes WhatsApp message', () => {
    const result = normalizeMessage(sinchFixtures.messageInboundWhatsApp);
    expect(result.platform).toBe('whatsapp');
    expect(result.content).toContain('appointment this Saturday');
  });

  it('normalizes SMS message', () => {
    const result = normalizeMessage(sinchFixtures.messageInboundSMS);
    expect(result.platform).toBe('sms');
    expect(result.content).toContain('Cancel my booking');
  });

  it('normalizes Viber message', () => {
    const result = normalizeMessage(sinchFixtures.messageInboundViber);
    expect(result.platform).toBe('viber');
    expect(result.content).toContain('availability on Monday');
  });

  it('returns empty content for media-only messages', () => {
    const result = normalizeMessage(sinchFixtures.messageInboundMediaOnly as any);
    expect(result.content).toBe('');
  });
});

describe('Fresha Webhook: Status Mapping', () => {
  it('maps confirmed', () => expect(mapFreshaStatus('confirmed')).toBe('confirmed'));
  it('maps pending to confirmed', () => expect(mapFreshaStatus('pending')).toBe('confirmed'));
  it('maps completed', () => expect(mapFreshaStatus('completed')).toBe('completed'));
  it('maps cancelled', () => expect(mapFreshaStatus('cancelled')).toBe('cancelled'));
  it('maps no_show', () => expect(mapFreshaStatus('no_show')).toBe('no_show'));
  it('defaults unknown to confirmed', () => expect(mapFreshaStatus('xyz')).toBe('confirmed'));
  it('handles case insensitivity', () => expect(mapFreshaStatus('CONFIRMED')).toBe('confirmed'));
});

describe('Fresha Webhook: Appointment Normalization', () => {
  it('normalizes a created appointment', () => {
    const result = normalizeAppointment(freshaFixtures.appointmentCreated.data);
    expect(result.fresha_id).toBe('apt_001');
    expect(result.customer_name).toBe('Alice Johnson');
    expect(result.customer_phone).toBe('+61400111222');
    expect(result.customer_email).toBe('alice@example.com');
    expect(result.service_name).toBe('Gel Manicure');
    expect(result.staff_name).toBe('Lisa');
    expect(result.date).toBe('2026-04-05');
    expect(result.start_time).toBe('10:00');
    expect(result.end_time).toBe('11:00');
    expect(result.status).toBe('confirmed');
  });

  it('normalizes updated appointment with time change', () => {
    const result = normalizeAppointment(freshaFixtures.appointmentUpdated.data);
    expect(result.start_time).toBe('14:00');
    expect(result.end_time).toBe('15:00');
  });

  it('handles missing client (walk-in)', () => {
    const data = {
      ...freshaFixtures.appointmentCreated.data,
      client: null as any,
    };
    const result = normalizeAppointment(data);
    expect(result.customer_name).toBe('Walk-in');
    expect(result.customer_phone).toBe('');
  });

  it('handles missing staff', () => {
    const data = {
      ...freshaFixtures.appointmentCreated.data,
      staff: null as any,
    };
    const result = normalizeAppointment(data);
    expect(result.staff_name).toBe('');
  });
});

describe('Fresha Webhook: Event routing', () => {
  it('identifies appointment.created event', () => {
    expect(freshaFixtures.appointmentCreated.event).toBe('appointment.created');
    expect(freshaFixtures.appointmentCreated.location_id).toBe('loc_123');
  });

  it('identifies appointment.cancelled event', () => {
    expect(freshaFixtures.appointmentCancelled.event).toBe('appointment.cancelled');
  });

  it('identifies client.created event', () => {
    expect(freshaFixtures.clientCreated.event).toBe('client.created');
    expect(freshaFixtures.clientCreated.data.phone).toBe('+61400222333');
  });
});
