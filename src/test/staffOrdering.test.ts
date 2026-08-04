import { describe, it, expect } from 'vitest';
import { applyStaffDisplayOrder, DEFAULT_STAFF_ORDER_STRATEGY } from '@/lib/staffOrdering';

// Stands in for a Supabase query builder, recording the .order() chain.
function fakeQuery() {
  const calls: Array<{ column: string; options?: { ascending?: boolean } }> = [];
  const query: any = {
    calls,
    order(column: string, options?: { ascending?: boolean }) {
      calls.push({ column, options });
      return query;
    },
  };
  return query;
}

describe('applyStaffDisplayOrder', () => {
  it('orders by display_order, then created_at as a tiebreaker', () => {
    const query = fakeQuery();
    applyStaffDisplayOrder(query);
    expect(query.calls).toEqual([
      { column: 'display_order', options: { ascending: true } },
      { column: 'created_at', options: { ascending: true } },
    ]);
  });

  it('returns the query builder so callers can keep chaining/awaiting', () => {
    const query = fakeQuery();
    expect(applyStaffDisplayOrder(query)).toBe(query);
  });

  it('defaults to the manual (admin drag-and-drop) strategy', () => {
    expect(DEFAULT_STAFF_ORDER_STRATEGY).toBe('manual');
    const explicit = fakeQuery();
    const implicit = fakeQuery();
    applyStaffDisplayOrder(explicit, 'manual');
    applyStaffDisplayOrder(implicit);
    expect(implicit.calls).toEqual(explicit.calls);
  });
});
