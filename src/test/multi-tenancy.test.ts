import { describe, it, expect } from 'vitest';
import { edgeFnNotifyBookingSchema } from '@/lib/validation';

/**
 * Unit tests for multi-tenancy enforcement.
 *
 * Scope:
 *   - Client header: every supabase request carries `x-tenant-id` when VITE_TENANT_ID is set.
 *   - Booking insert payload: tenant_id is attached when writing bookings.
 *   - Validation: edge fn schemas that require tenant_id reject missing / malformed values.
 *   - RLS simulation: policies scoped by tenant never leak cross-tenant rows.
 */

// ──────────────────────────────────────────────────────────────────────
// 1. Supabase client `x-tenant-id` header
// ──────────────────────────────────────────────────────────────────────

describe('supabase client — x-tenant-id header', () => {
  // The client module reads import.meta.env at load time, so we replicate
  // its header-building logic here to test both branches deterministically.
  function buildHeaders(tenantId: string | undefined) {
    return {
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    };
  }

  it('includes x-tenant-id when VITE_TENANT_ID is set', () => {
    const headers = buildHeaders('11111111-1111-1111-1111-111111111111');
    expect(headers).toHaveProperty('x-tenant-id', '11111111-1111-1111-1111-111111111111');
  });

  it('omits x-tenant-id when VITE_TENANT_ID is empty', () => {
    const headers = buildHeaders('');
    expect(headers).not.toHaveProperty('x-tenant-id');
  });

  it('omits x-tenant-id when VITE_TENANT_ID is undefined', () => {
    const headers = buildHeaders(undefined);
    expect(headers).not.toHaveProperty('x-tenant-id');
  });
});

// ──────────────────────────────────────────────────────────────────────
// 2. Booking insert payload — tenant_id attachment
// ──────────────────────────────────────────────────────────────────────

describe('booking insert — tenant_id attachment', () => {
  function buildBookingPayload<T extends Record<string, unknown>>(
    base: T,
    tenantId: string,
  ) {
    return {
      ...base,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    };
  }

  const base = {
    service_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    therapist_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    customer_name: 'Jane Doe',
    customer_phone: '0412345678',
    customer_email: 'jane@example.com',
    booking_date: '2026-05-01',
    start_time: '10:00',
    end_time: '11:00',
    status: 'confirmed',
  };

  it('attaches tenant_id when TENANT_ID is present', () => {
    const payload = buildBookingPayload(base, 'cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(payload).toHaveProperty('tenant_id', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
  });

  it('omits tenant_id when TENANT_ID is empty (header-only mode)', () => {
    const payload = buildBookingPayload(base, '');
    expect(payload).not.toHaveProperty('tenant_id');
  });

  it('preserves the rest of the booking fields', () => {
    const payload = buildBookingPayload(base, 'cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(payload.customer_name).toBe('Jane Doe');
    expect(payload.service_id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(payload.status).toBe('confirmed');
  });
});

// ──────────────────────────────────────────────────────────────────────
// 3. Validation — edgeFnNotifyBookingSchema enforces tenant_id
// ──────────────────────────────────────────────────────────────────────

describe('edgeFnNotifyBookingSchema — tenant_id validation', () => {
  const valid = {
    id: '11111111-1111-1111-1111-111111111111',
    customer_name: 'Jane',
    customer_phone: '0400000000',
    booking_date: '2026-05-01',
    start_time: '10:00',
    service_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    therapist_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    tenant_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  };

  it('accepts a valid tenant_id UUID', () => {
    const result = edgeFnNotifyBookingSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects a missing tenant_id', () => {
    const { tenant_id: _, ...noTenant } = valid;
    const result = edgeFnNotifyBookingSchema.safeParse(noTenant);
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID tenant_id', () => {
    const result = edgeFnNotifyBookingSchema.safeParse({ ...valid, tenant_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty tenant_id', () => {
    const result = edgeFnNotifyBookingSchema.safeParse({ ...valid, tenant_id: '' });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 4. RLS simulation — tenant-scoped queries never return cross-tenant rows
// ──────────────────────────────────────────────────────────────────────

type Row = { id: string; tenant_id: string; is_active?: boolean; key?: string };

/**
 * Simulates the RLS pattern used in 20260330210000_add_multi_tenancy.sql:
 *   USING (tenant_id = public.request_tenant_id())
 * A query from the `anon` role matches only rows whose tenant_id matches the
 * header value; an empty / null header yields zero rows.
 */
function rlsSelect(rows: Row[], headerTenantId: string | null, extra?: (r: Row) => boolean) {
  if (!headerTenantId) return [];
  return rows.filter(r => r.tenant_id === headerTenantId && (extra?.(r) ?? true));
}

describe('RLS simulation — tenant isolation', () => {
  const TENANT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const TENANT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const services: Row[] = [
    { id: 's1', tenant_id: TENANT_A, is_active: true },
    { id: 's2', tenant_id: TENANT_A, is_active: false },
    { id: 's3', tenant_id: TENANT_B, is_active: true },
  ];

  it('returns only tenant A services when x-tenant-id = A', () => {
    // anon policy: tenant_id = request_tenant_id() AND is_active = true
    const rows = rlsSelect(services, TENANT_A, r => r.is_active === true);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('s1');
  });

  it('returns only tenant B services when x-tenant-id = B', () => {
    const rows = rlsSelect(services, TENANT_B, r => r.is_active === true);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('s3');
  });

  it('returns zero rows when x-tenant-id is missing (anon policy fails closed)', () => {
    const rows = rlsSelect(services, null, r => r.is_active === true);
    expect(rows).toEqual([]);
  });

  it('never leaks rows from another tenant', () => {
    const rows = rlsSelect(services, TENANT_A);
    expect(rows.every(r => r.tenant_id === TENANT_A)).toBe(true);
    expect(rows.some(r => r.tenant_id === TENANT_B)).toBe(false);
  });

  it('app_settings — anon cannot read secret keys even within tenant', () => {
    const SECRET_KEYS = new Set([
      'resend_api_key',
      'stripe_secret_key',
      'twilio_auth_token',
      'twilio_account_sid',
    ]);
    const settings: Row[] = [
      { id: '1', tenant_id: TENANT_A, key: 'salon_name' },
      { id: '2', tenant_id: TENANT_A, key: 'stripe_secret_key' },
      { id: '3', tenant_id: TENANT_A, key: 'theme_color' },
    ];
    const rows = rlsSelect(settings, TENANT_A, r => !SECRET_KEYS.has(r.key!));
    expect(rows.map(r => r.key).sort()).toEqual(['salon_name', 'theme_color']);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 5. Cross-tenant write prevention
// ──────────────────────────────────────────────────────────────────────

/**
 * Simulates the WITH CHECK clause on anon insert policies:
 *   WITH CHECK (tenant_id = public.request_tenant_id())
 * An insert whose payload tenant_id does not match the header is rejected.
 */
function rlsInsert(headerTenantId: string | null, payloadTenantId: string | null) {
  if (!headerTenantId) return { ok: false, reason: 'missing_header' as const };
  if (payloadTenantId !== headerTenantId) return { ok: false, reason: 'tenant_mismatch' as const };
  return { ok: true as const };
}

describe('RLS simulation — cross-tenant write prevention', () => {
  const TENANT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const TENANT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  it('accepts insert whose tenant_id matches the x-tenant-id header', () => {
    const result = rlsInsert(TENANT_A, TENANT_A);
    expect(result.ok).toBe(true);
  });

  it('rejects insert whose tenant_id differs from the header', () => {
    const result = rlsInsert(TENANT_A, TENANT_B);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('tenant_mismatch');
  });

  it('rejects insert when no x-tenant-id header is set', () => {
    const result = rlsInsert(null, TENANT_A);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_header');
  });

  it('rejects insert with null tenant_id payload', () => {
    const result = rlsInsert(TENANT_A, null);
    expect(result.ok).toBe(false);
  });
});
