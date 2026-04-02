import { describe, it, expect } from 'vitest';
import * as chatwootFixtures from './fixtures/chatwoot-webhooks';
import * as freshaFixtures from './fixtures/fresha-webhooks';

/**
 * Tests for webhook payload processing logic.
 * These test the normalization and data extraction functions
 * without calling actual Supabase.
 */

// ─── Platform detection (from chatwoot-webhook) ─────────────────────

function detectPlatform(channelType: string): string {
  const lower = channelType?.toLowerCase() || 'web';
  if (lower.includes('instagram')) return 'instagram';
  if (lower.includes('facebook') || lower.includes('messenger')) return 'facebook';
  if (lower.includes('tiktok')) return 'tiktok';
  if (lower.includes('api')) return 'api';
  return 'web';
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

// ─── Chatwoot message normalization ─────────────────────────────────

function normalizeMessage(payload: typeof chatwootFixtures.messageCreatedIncoming) {
  return {
    chatwoot_message_id: payload.id,
    direction: payload.message_type === 'incoming' ? 'inbound' : 'outbound',
    sender_type: payload.message_type === 'incoming' ? 'customer' : 'staff',
    sender_name: payload.sender?.name || 'Unknown',
    content: payload.content || '',
    content_type: payload.content_type || 'text',
    platform: detectPlatform(payload.conversation?.channel || ''),
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

describe('Chatwoot Webhook: Platform Detection', () => {
  it('detects Instagram', () => {
    expect(detectPlatform('Instagram')).toBe('instagram');
    expect(detectPlatform('instagram_direct')).toBe('instagram');
  });

  it('detects Facebook/Messenger', () => {
    expect(detectPlatform('Facebook')).toBe('facebook');
    expect(detectPlatform('facebook_messenger')).toBe('facebook');
    expect(detectPlatform('Messenger')).toBe('facebook');
  });

  it('detects TikTok', () => {
    expect(detectPlatform('tiktok')).toBe('tiktok');
    expect(detectPlatform('TikTok')).toBe('tiktok');
  });

  it('detects API channel (for custom bridges)', () => {
    expect(detectPlatform('Api')).toBe('api');
    expect(detectPlatform('api_channel')).toBe('api');
  });

  it('defaults to web for unknown', () => {
    expect(detectPlatform('')).toBe('web');
    expect(detectPlatform('unknown')).toBe('web');
  });
});

describe('Chatwoot Webhook: Message Normalization', () => {
  it('normalizes incoming Instagram message', () => {
    const result = normalizeMessage(chatwootFixtures.messageCreatedIncoming);
    expect(result.direction).toBe('inbound');
    expect(result.sender_type).toBe('customer');
    expect(result.sender_name).toBe('Jane Doe');
    expect(result.content).toContain('book a massage');
    expect(result.platform).toBe('instagram');
    expect(result.chatwoot_message_id).toBe(12345);
  });

  it('normalizes outgoing message', () => {
    const result = normalizeMessage(chatwootFixtures.messageCreatedOutgoing as any);
    expect(result.direction).toBe('outbound');
    expect(result.sender_type).toBe('staff');
  });

  it('normalizes Facebook message', () => {
    const result = normalizeMessage(chatwootFixtures.messageCreatedFacebook);
    expect(result.platform).toBe('facebook');
    expect(result.sender_name).toBe('John Smith');
  });

  it('normalizes TikTok (API channel) message', () => {
    const result = normalizeMessage(chatwootFixtures.messageCreatedTikTok);
    expect(result.platform).toBe('api');
    expect(result.sender_name).toBe('TikTokUser123');
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
