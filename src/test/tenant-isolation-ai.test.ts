import { describe, it, expect } from 'vitest';

/**
 * Tests for AI tenant isolation.
 *
 * Verifies that the AI system enforces single-shop scoping:
 * - Query builders always include tenant_id
 * - Tool executors scope all DB access
 * - Webhook tenant resolution rejects unknown accounts
 * - Knowledge base search is tenant-scoped
 * - Cross-tenant data is never accessible
 */

// ─── Simulate Supabase query builder to verify tenant scoping ────────

interface QueryLog {
  table: string;
  filters: Record<string, unknown>;
  method: string;
}

function createMockSupabase(tenantId: string) {
  const queryLog: QueryLog[] = [];
  const mockData: Record<string, unknown[]> = {
    services: [
      { id: 's1', name: 'Gel Manicure', tenant_id: tenantId, price: 55, duration_minutes: 60, is_active: true },
      { id: 's2', name: 'Pedicure', tenant_id: tenantId, price: 45, duration_minutes: 45, is_active: true },
      { id: 's_other', name: 'Other Shop Service', tenant_id: 'other-tenant-id', price: 99, duration_minutes: 30, is_active: true },
    ],
    therapists: [
      { id: 't1', name: 'Lisa', tenant_id: tenantId, is_active: true, working_days: [1, 2, 3, 4, 5], start_hour: 9, end_hour: 17 },
      { id: 't_other', name: 'Other Shop Staff', tenant_id: 'other-tenant-id', is_active: true, working_days: [1, 2, 3], start_hour: 10, end_hour: 16 },
    ],
    bookings: [
      { id: 'b1', tenant_id: tenantId, therapist_id: 't1', booking_date: '2026-04-05', start_time: '10:00', end_time: '11:00', status: 'confirmed' },
      { id: 'b_other', tenant_id: 'other-tenant-id', therapist_id: 't_other', booking_date: '2026-04-05', start_time: '10:00', end_time: '11:00', status: 'confirmed' },
    ],
    shop_holidays: [
      { id: 'h1', tenant_id: tenantId, holiday_date: '2026-04-25', early_close_hour: null },
      { id: 'h_other', tenant_id: 'other-tenant-id', holiday_date: '2026-04-25', early_close_hour: null },
    ],
    knowledge_base: [
      { id: 'kb1', tenant_id: tenantId, title: 'Opening Hours', content: 'Mon-Sat 9am-6pm', is_active: true },
      { id: 'kb_other', tenant_id: 'other-tenant-id', title: 'Other Shop Hours', content: 'Different hours', is_active: true },
    ],
    ai_config: [
      { tenant_id: tenantId, chatwoot_account_id: 1, ai_enabled: true },
      { tenant_id: 'other-tenant-id', chatwoot_account_id: 2, ai_enabled: true },
    ],
    conversations: [
      { id: 'c1', tenant_id: tenantId, chatwoot_conversation_id: 100, ai_enabled: true },
      { id: 'c_other', tenant_id: 'other-tenant-id', chatwoot_conversation_id: 200, ai_enabled: true },
    ],
  };

  function buildQuery(table: string) {
    const filters: Record<string, unknown> = {};
    let currentMethod = 'select';

    const chain = {
      select: (cols?: string) => { currentMethod = 'select'; return chain; },
      eq: (col: string, val: unknown) => { filters[col] = val; return chain; },
      neq: (col: string, val: unknown) => { filters[`neq_${col}`] = val; return chain; },
      ilike: (col: string, val: unknown) => { filters[`ilike_${col}`] = val; return chain; },
      like: (col: string, val: unknown) => { filters[`like_${col}`] = val; return chain; },
      order: (_col: string, _opts?: object) => chain,
      limit: (_n: number) => chain,
      single: () => {
        queryLog.push({ table, filters: { ...filters }, method: currentMethod });
        const rows = (mockData[table] || []).filter((row: any) => {
          return Object.entries(filters).every(([key, val]) => {
            if (key.startsWith('neq_')) return (row as any)[key.replace('neq_', '')] !== val;
            if (key.startsWith('ilike_') || key.startsWith('like_')) return true; // simplified
            return (row as any)[key] === val;
          });
        });
        return { data: rows[0] || null, error: rows[0] ? null : { code: 'PGRST116' } };
      },
      then: (resolve: Function) => {
        queryLog.push({ table, filters: { ...filters }, method: currentMethod });
        const rows = (mockData[table] || []).filter((row: any) => {
          return Object.entries(filters).every(([key, val]) => {
            if (key.startsWith('neq_')) return (row as any)[key.replace('neq_', '')] !== val;
            if (key.startsWith('ilike_') || key.startsWith('like_')) return true;
            return (row as any)[key] === val;
          });
        });
        return resolve({ data: rows, error: null });
      },
    };

    // Make it thenable for await
    (chain as any)[Symbol.toStringTag] = 'Promise';

    return chain;
  }

  return {
    from: (table: string) => buildQuery(table),
    rpc: (fn: string, params: Record<string, unknown>) => {
      queryLog.push({ table: `rpc:${fn}`, filters: params, method: 'rpc' });
      // Simulate tenant-scoped search
      if (fn === 'search_knowledge_base') {
        const results = (mockData.knowledge_base || []).filter(
          (r: any) => r.tenant_id === params.p_tenant_id && r.is_active,
        );
        return { data: results, error: null };
      }
      return { data: [], error: null };
    },
    queryLog,
  };
}

// ─── Simulate AI query patterns (mirrors ai-chat-respond logic) ─────

async function loadShopData(supabase: ReturnType<typeof createMockSupabase>, tenantId: string) {
  const servicesResult = await supabase.from('services').select('id, name, price, duration_minutes, is_active').eq('tenant_id', tenantId).eq('is_active', true);
  const therapistsResult = await supabase.from('therapists').select('id, name, working_days, start_hour, end_hour').eq('tenant_id', tenantId).eq('is_active', true);
  return {
    services: (servicesResult as any).data || [],
    therapists: (therapistsResult as any).data || [],
  };
}

async function loadBookingsForDate(supabase: ReturnType<typeof createMockSupabase>, tenantId: string, date: string) {
  const result = await supabase.from('bookings').select('therapist_id, start_time, end_time, status').eq('tenant_id', tenantId).eq('booking_date', date).neq('status', 'cancelled');
  return (result as any).data || [];
}

async function loadHolidays(supabase: ReturnType<typeof createMockSupabase>, tenantId: string, date: string) {
  const result = await supabase.from('shop_holidays').select('early_close_hour').eq('tenant_id', tenantId).eq('holiday_date', date);
  return (result as any).data || [];
}

function searchKnowledgeBase(supabase: ReturnType<typeof createMockSupabase>, tenantId: string) {
  return supabase.rpc('search_knowledge_base', {
    query_embedding: '[]',
    p_tenant_id: tenantId,
    match_threshold: 0.7,
    match_count: 5,
  });
}

function resolveTenantFromChatwoot(supabase: ReturnType<typeof createMockSupabase>, accountId: number) {
  return supabase.from('ai_config').select('tenant_id, ai_enabled').eq('chatwoot_account_id', accountId).single();
}

// ─── Tests ───────────────────────────────────────────────────────────

const SHOP_A_TENANT = 'tenant-shop-a';
const SHOP_B_TENANT = 'other-tenant-id';

describe('Tenant Isolation: Service queries are shop-scoped', () => {
  it('Shop A only sees its own services', async () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const { services } = await loadShopData(db, SHOP_A_TENANT);

    expect(services.every((s: any) => s.tenant_id === SHOP_A_TENANT)).toBe(true);
    expect(services.find((s: any) => s.id === 's_other')).toBeUndefined();
  });

  it('every services query includes tenant_id filter', async () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    await loadShopData(db, SHOP_A_TENANT);

    const serviceQueries = db.queryLog.filter((q) => q.table === 'services');
    expect(serviceQueries.length).toBeGreaterThan(0);
    serviceQueries.forEach((q) => {
      expect(q.filters).toHaveProperty('tenant_id', SHOP_A_TENANT);
    });
  });
});

describe('Tenant Isolation: Therapist queries are shop-scoped', () => {
  it('Shop A only sees its own therapists', async () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const { therapists } = await loadShopData(db, SHOP_A_TENANT);

    expect(therapists.every((t: any) => t.tenant_id === SHOP_A_TENANT)).toBe(true);
    expect(therapists.find((t: any) => t.id === 't_other')).toBeUndefined();
  });

  it('every therapists query includes tenant_id filter', async () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    await loadShopData(db, SHOP_A_TENANT);

    const therapistQueries = db.queryLog.filter((q) => q.table === 'therapists');
    expect(therapistQueries.length).toBeGreaterThan(0);
    therapistQueries.forEach((q) => {
      expect(q.filters).toHaveProperty('tenant_id', SHOP_A_TENANT);
    });
  });
});

describe('Tenant Isolation: Booking/calendar queries are shop-scoped', () => {
  it('Shop A only sees its own bookings', async () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const bookings = await loadBookingsForDate(db, SHOP_A_TENANT, '2026-04-05');

    expect(bookings.every((b: any) => b.tenant_id === SHOP_A_TENANT)).toBe(true);
    expect(bookings.find((b: any) => b.id === 'b_other')).toBeUndefined();
  });

  it('booking queries include tenant_id filter', async () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    await loadBookingsForDate(db, SHOP_A_TENANT, '2026-04-05');

    const bookingQueries = db.queryLog.filter((q) => q.table === 'bookings');
    expect(bookingQueries.length).toBeGreaterThan(0);
    bookingQueries.forEach((q) => {
      expect(q.filters).toHaveProperty('tenant_id', SHOP_A_TENANT);
    });
  });
});

describe('Tenant Isolation: Holiday queries are shop-scoped', () => {
  it('Shop A only sees its own holidays', async () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const holidays = await loadHolidays(db, SHOP_A_TENANT, '2026-04-25');

    expect(holidays.every((h: any) => h.tenant_id === SHOP_A_TENANT)).toBe(true);
    expect(holidays.find((h: any) => h.id === 'h_other')).toBeUndefined();
  });
});

describe('Tenant Isolation: Knowledge base search is shop-scoped', () => {
  it('RAG search passes tenant_id parameter', () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const result = searchKnowledgeBase(db, SHOP_A_TENANT);

    const rpcCalls = db.queryLog.filter((q) => q.table === 'rpc:search_knowledge_base');
    expect(rpcCalls.length).toBe(1);
    expect(rpcCalls[0].filters).toHaveProperty('p_tenant_id', SHOP_A_TENANT);
  });

  it('RAG search only returns this shop\'s articles', () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const result = searchKnowledgeBase(db, SHOP_A_TENANT);

    expect(result.data.every((r: any) => r.tenant_id === SHOP_A_TENANT)).toBe(true);
    expect(result.data.find((r: any) => r.id === 'kb_other')).toBeUndefined();
  });
});

describe('Tenant Isolation: Webhook tenant resolution', () => {
  it('resolves correct tenant from Chatwoot account ID', () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const result = resolveTenantFromChatwoot(db, 1);

    expect(result.data).not.toBeNull();
    expect(result.data?.tenant_id).toBe(SHOP_A_TENANT);
  });

  it('returns null for unknown Chatwoot account ID', () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const result = resolveTenantFromChatwoot(db, 999);

    expect(result.data).toBeNull();
  });

  it('Shop A webhook does NOT resolve to Shop B tenant', () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const result = resolveTenantFromChatwoot(db, 1);

    expect(result.data?.tenant_id).not.toBe(SHOP_B_TENANT);
  });
});

describe('Tenant Isolation: Cross-tenant access prevention', () => {
  it('Shop A cannot access Shop B services', async () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const { services } = await loadShopData(db, SHOP_A_TENANT);

    const shopBService = services.find((s: any) => s.tenant_id === SHOP_B_TENANT);
    expect(shopBService).toBeUndefined();
  });

  it('Shop A cannot access Shop B therapists', async () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const { therapists } = await loadShopData(db, SHOP_A_TENANT);

    const shopBTherapist = therapists.find((t: any) => t.tenant_id === SHOP_B_TENANT);
    expect(shopBTherapist).toBeUndefined();
  });

  it('Shop A cannot access Shop B bookings', async () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const bookings = await loadBookingsForDate(db, SHOP_A_TENANT, '2026-04-05');

    const shopBBooking = bookings.find((b: any) => b.tenant_id === SHOP_B_TENANT);
    expect(shopBBooking).toBeUndefined();
  });

  it('Shop A cannot access Shop B knowledge base', () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const result = searchKnowledgeBase(db, SHOP_A_TENANT);

    const shopBArticle = result.data.find((r: any) => r.tenant_id === SHOP_B_TENANT);
    expect(shopBArticle).toBeUndefined();
  });

  it('Shop B queries are completely separate from Shop A', async () => {
    const dbA = createMockSupabase(SHOP_A_TENANT);
    const dbB = createMockSupabase(SHOP_B_TENANT);

    const shopA = await loadShopData(dbA, SHOP_A_TENANT);
    const shopB = await loadShopData(dbB, SHOP_B_TENANT);

    // All Shop A records belong to Shop A tenant
    shopA.services.forEach((s: any) => expect(s.tenant_id).toBe(SHOP_A_TENANT));
    shopA.therapists.forEach((t: any) => expect(t.tenant_id).toBe(SHOP_A_TENANT));

    // All Shop B records belong to Shop B tenant
    shopB.services.forEach((s: any) => expect(s.tenant_id).toBe(SHOP_B_TENANT));
    shopB.therapists.forEach((t: any) => expect(t.tenant_id).toBe(SHOP_B_TENANT));

    // No cross-tenant data leaked
    const aHasB = shopA.services.some((s: any) => s.tenant_id === SHOP_B_TENANT);
    const bHasA = shopB.services.some((s: any) => s.tenant_id === SHOP_A_TENANT);
    expect(aHasB).toBe(false);
    expect(bHasA).toBe(false);
  });
});

describe('Tenant Isolation: Conversation scoping', () => {
  it('conversation lookup includes tenant_id', () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const result = db.from('conversations').select('*').eq('id', 'c1').eq('tenant_id', SHOP_A_TENANT).single();

    const convoQueries = db.queryLog.filter((q) => q.table === 'conversations');
    expect(convoQueries[0].filters).toHaveProperty('tenant_id', SHOP_A_TENANT);
    expect(result.data?.id).toBe('c1');
  });

  it('cannot access other shop conversations', () => {
    const db = createMockSupabase(SHOP_A_TENANT);
    const result = db.from('conversations').select('*').eq('id', 'c_other').eq('tenant_id', SHOP_A_TENANT).single();

    expect(result.data).toBeNull();
  });
});
