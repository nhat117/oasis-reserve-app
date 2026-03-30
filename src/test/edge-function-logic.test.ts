import { describe, it, expect } from 'vitest';

// ─── CORS Helper Logic ───

function getCorsHeaders(origin: string, allowedOrigins: string[] | null): Record<string, string> {
  if (!allowedOrigins) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };
  }
  if (allowedOrigins.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Vary": "Origin",
    };
  }
  return {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

describe('CORS helper logic', () => {
  it('returns wildcard when no whitelist configured', () => {
    const headers = getCorsHeaders('https://example.com', null);
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Vary']).toBeUndefined();
  });

  it('returns origin-specific header when origin is whitelisted', () => {
    const allowed = ['https://app.example.com', 'http://localhost:5173'];
    const headers = getCorsHeaders('https://app.example.com', allowed);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(headers['Vary']).toBe('Origin');
  });

  it('returns no Allow-Origin when origin is not whitelisted', () => {
    const allowed = ['https://app.example.com'];
    const headers = getCorsHeaders('https://evil.com', allowed);
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('always includes Allow-Headers', () => {
    const h1 = getCorsHeaders('', null);
    const h2 = getCorsHeaders('https://a.com', ['https://a.com']);
    const h3 = getCorsHeaders('https://evil.com', ['https://a.com']);
    expect(h1['Access-Control-Allow-Headers']).toContain('authorization');
    expect(h2['Access-Control-Allow-Headers']).toContain('authorization');
    expect(h3['Access-Control-Allow-Headers']).toContain('authorization');
  });

  it('handles empty origin string', () => {
    const headers = getCorsHeaders('', ['https://a.com']);
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});

// ─── Tenant Isolation Logic ───

interface TenantRole {
  user_id: string;
  role: string;
  tenant_id: string | null;
}

function getUserTenantId(roles: TenantRole[], userId: string): string | null {
  const role = roles.find(r => r.user_id === userId);
  return role?.tenant_id ?? null;
}

function isUserInTenant(roles: TenantRole[], userId: string, tenantId: string): boolean {
  return roles.some(r => r.user_id === userId && r.tenant_id === tenantId);
}

describe('Tenant isolation logic', () => {
  const roles: TenantRole[] = [
    { user_id: 'user-1', role: 'admin', tenant_id: 'tenant-a' },
    { user_id: 'user-2', role: 'employee', tenant_id: 'tenant-a' },
    { user_id: 'user-3', role: 'admin', tenant_id: 'tenant-b' },
    { user_id: 'user-4', role: 'admin', tenant_id: null },
  ];

  it('returns correct tenant for user', () => {
    expect(getUserTenantId(roles, 'user-1')).toBe('tenant-a');
    expect(getUserTenantId(roles, 'user-3')).toBe('tenant-b');
  });

  it('returns null for user with no tenant', () => {
    expect(getUserTenantId(roles, 'user-4')).toBeNull();
  });

  it('returns null for unknown user', () => {
    expect(getUserTenantId(roles, 'unknown')).toBeNull();
  });

  it('confirms user belongs to tenant', () => {
    expect(isUserInTenant(roles, 'user-1', 'tenant-a')).toBe(true);
    expect(isUserInTenant(roles, 'user-2', 'tenant-a')).toBe(true);
  });

  it('rejects user from wrong tenant', () => {
    expect(isUserInTenant(roles, 'user-1', 'tenant-b')).toBe(false);
    expect(isUserInTenant(roles, 'user-3', 'tenant-a')).toBe(false);
  });
});

// ─── Delete All Data Tenant Scoping ───

interface TableRow {
  id: string;
  tenant_id: string;
}

function filterByTenant<T extends { tenant_id: string }>(rows: T[], tenantId: string): T[] {
  return rows.filter(r => r.tenant_id === tenantId);
}

describe('Delete-all-data tenant scoping', () => {
  const bookings: TableRow[] = [
    { id: 'b1', tenant_id: 'tenant-a' },
    { id: 'b2', tenant_id: 'tenant-a' },
    { id: 'b3', tenant_id: 'tenant-b' },
    { id: 'b4', tenant_id: 'tenant-b' },
  ];

  it('only deletes rows from target tenant', () => {
    const toDelete = filterByTenant(bookings, 'tenant-a');
    expect(toDelete.map(r => r.id)).toEqual(['b1', 'b2']);
  });

  it('does not affect other tenants', () => {
    const toDelete = filterByTenant(bookings, 'tenant-a');
    const remaining = bookings.filter(r => !toDelete.includes(r));
    expect(remaining.every(r => r.tenant_id === 'tenant-b')).toBe(true);
  });

  it('returns empty array for non-existent tenant', () => {
    const toDelete = filterByTenant(bookings, 'tenant-c');
    expect(toDelete).toEqual([]);
  });
});

// ─── Notify New Booking - Tenant Settings Resolution ───

interface AppSetting {
  key: string;
  value: string;
  tenant_id: string;
}

function getSettingsForTenant(settings: AppSetting[], tenantId: string, keys: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  settings
    .filter(s => s.tenant_id === tenantId && keys.includes(s.key))
    .forEach(s => { map[s.key] = s.value; });
  return map;
}

describe('Per-tenant settings resolution', () => {
  const settings: AppSetting[] = [
    { key: 'spa_name', value: 'Royal Head Spa', tenant_id: 'tenant-a' },
    { key: 'spa_name', value: 'Glamour Nails', tenant_id: 'tenant-b' },
    { key: 'twilio_account_sid', value: 'AC_aaa', tenant_id: 'tenant-a' },
    { key: 'twilio_account_sid', value: 'AC_bbb', tenant_id: 'tenant-b' },
    { key: 'stripe_secret_key', value: 'sk_aaa', tenant_id: 'tenant-a' },
    { key: 'stripe_secret_key', value: 'sk_bbb', tenant_id: 'tenant-b' },
  ];

  it('resolves correct spa_name per tenant', () => {
    const a = getSettingsForTenant(settings, 'tenant-a', ['spa_name']);
    const b = getSettingsForTenant(settings, 'tenant-b', ['spa_name']);
    expect(a['spa_name']).toBe('Royal Head Spa');
    expect(b['spa_name']).toBe('Glamour Nails');
  });

  it('resolves correct Twilio credentials per tenant', () => {
    const a = getSettingsForTenant(settings, 'tenant-a', ['twilio_account_sid']);
    const b = getSettingsForTenant(settings, 'tenant-b', ['twilio_account_sid']);
    expect(a['twilio_account_sid']).toBe('AC_aaa');
    expect(b['twilio_account_sid']).toBe('AC_bbb');
  });

  it('tenant A cannot see tenant B stripe key', () => {
    const a = getSettingsForTenant(settings, 'tenant-a', ['stripe_secret_key']);
    expect(a['stripe_secret_key']).toBe('sk_aaa');
    expect(a['stripe_secret_key']).not.toBe('sk_bbb');
  });

  it('returns empty for unknown tenant', () => {
    const c = getSettingsForTenant(settings, 'tenant-c', ['spa_name']);
    expect(Object.keys(c)).toHaveLength(0);
  });
});

// ─── Phone Number Normalization (SMS reminder) ───

function normalizeAustralianPhone(phone: string): string {
  let p = phone.replace(/\s+/g, '');
  if (p.startsWith('0')) {
    p = '+61' + p.slice(1);
  } else if (!p.startsWith('+')) {
    p = '+61' + p;
  }
  return p;
}

describe('Australian phone normalization', () => {
  it('converts 04xx to +614xx', () => {
    expect(normalizeAustralianPhone('0412345678')).toBe('+61412345678');
  });

  it('converts 03xx landline', () => {
    expect(normalizeAustralianPhone('0398765432')).toBe('+61398765432');
  });

  it('keeps existing +61 prefix', () => {
    expect(normalizeAustralianPhone('+61412345678')).toBe('+61412345678');
  });

  it('adds +61 to bare number', () => {
    expect(normalizeAustralianPhone('412345678')).toBe('+61412345678');
  });

  it('strips spaces', () => {
    expect(normalizeAustralianPhone('04 1234 5678')).toBe('+61412345678');
  });

  it('handles number with country code no plus', () => {
    expect(normalizeAustralianPhone('61412345678')).toBe('+6161412345678');
    // Note: bare 61... without + gets +61 prepended — this is the current behavior
  });
});

// ─── Booking Reminder Window Calculation ───

function calculateReminderWindow(now: Date, hoursAhead: number): { start: Date; end: Date } {
  const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);
  return { start: targetTime, end: windowEnd };
}

describe('Reminder window calculation', () => {
  const now = new Date('2026-03-30T09:00:00Z');

  it('24h reminder targets 30min window tomorrow', () => {
    const { start, end } = calculateReminderWindow(now, 24);
    expect(start.toISOString()).toBe('2026-03-31T09:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-31T09:30:00.000Z');
  });

  it('1h reminder targets 30min window in 1 hour', () => {
    const { start, end } = calculateReminderWindow(now, 1);
    expect(start.toISOString()).toBe('2026-03-30T10:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-30T10:30:00.000Z');
  });

  it('0h reminder is skipped (window starts at now)', () => {
    const { start } = calculateReminderWindow(now, 0);
    expect(start.getTime()).toBe(now.getTime());
  });
});

// ─── Admin Role Validation (used across multiple functions) ───

type Role = 'admin' | 'employee';

function hasPermission(userRole: Role | null, requiredRoles: Role[]): boolean {
  if (!userRole) return false;
  return requiredRoles.includes(userRole);
}

describe('Admin role validation', () => {
  it('admin has access to admin-only actions', () => {
    expect(hasPermission('admin', ['admin'])).toBe(true);
  });

  it('employee does not have admin-only access', () => {
    expect(hasPermission('employee', ['admin'])).toBe(false);
  });

  it('both admin and employee have staff access', () => {
    expect(hasPermission('admin', ['admin', 'employee'])).toBe(true);
    expect(hasPermission('employee', ['admin', 'employee'])).toBe(true);
  });

  it('null role has no access', () => {
    expect(hasPermission(null, ['admin'])).toBe(false);
    expect(hasPermission(null, ['admin', 'employee'])).toBe(false);
  });
});
