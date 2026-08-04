// Single source of truth for the order staff are listed in — the customer
// booking picker and the admin staff list must agree, otherwise dragging a
// name to the top in admin doesn't visibly do anything to customers.
//
// Only 'manual' exists today: admins drag rows in Staff management, which
// writes therapists.display_order. The strategy indirection is here so the
// planned alternatives (round-robin rotation, least-booked-first,
// most-available-first) can be added by extending ORDER_COLUMNS — or, for
// strategies that need booking counts, by branching here — without every call
// site having to learn about it.
export type StaffOrderStrategy = 'manual';

export const DEFAULT_STAFF_ORDER_STRATEGY: StaffOrderStrategy = 'manual';

// created_at is the tiebreaker so staff sharing a display_order (any row the
// backfill skipped, or a newly created one still sitting at the 0 default)
// keep the stable order they had before this feature existed.
const ORDER_COLUMNS: Record<StaffOrderStrategy, readonly string[]> = {
  manual: ['display_order', 'created_at'],
};

/** Structural shape of the part of a Supabase query builder we need. */
interface OrderableQuery {
  order(column: string, options?: { ascending?: boolean }): OrderableQuery;
}

/** Applies the strategy's ORDER BY clauses to a `therapists` query. */
export function applyStaffDisplayOrder<Q extends OrderableQuery>(
  query: Q,
  strategy: StaffOrderStrategy = DEFAULT_STAFF_ORDER_STRATEGY,
): Q {
  return ORDER_COLUMNS[strategy].reduce<OrderableQuery>(
    (q, column) => q.order(column, { ascending: true }),
    query,
  ) as Q;
}
