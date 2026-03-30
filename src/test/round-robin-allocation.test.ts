import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure logic extracted from Booking.tsx — round-robin therapist allocation
// ---------------------------------------------------------------------------

interface Therapist {
  id: string;
  name: string;
}

interface ExistingBooking {
  therapist_id: string;
  status: string;
}

/**
 * Picks the available therapist with the fewest confirmed bookings today.
 * Tie-break: alphabetical by id (deterministic).
 */
function pickRoundRobin(
  available: Therapist[],
  existingBookings: ExistingBooking[],
): Therapist | undefined {
  const bookingCounts: Record<string, number> = {};
  existingBookings.forEach(b => {
    if (b.status !== 'cancelled') {
      bookingCounts[b.therapist_id] = (bookingCounts[b.therapist_id] || 0) + 1;
    }
  });

  const sorted = [...available].sort((a, b) => {
    const countDiff = (bookingCounts[a.id] || 0) - (bookingCounts[b.id] || 0);
    if (countDiff !== 0) return countDiff;
    return a.id.localeCompare(b.id);
  });

  return sorted[0];
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const alice: Therapist = { id: 'alice', name: 'Alice' };
const bob: Therapist   = { id: 'bob', name: 'Bob' };
const carol: Therapist = { id: 'carol', name: 'Carol' };

describe('Round-robin therapist allocation', () => {
  it('picks the therapist with zero bookings when others have some', () => {
    const bookings: ExistingBooking[] = [
      { therapist_id: 'alice', status: 'confirmed' },
      { therapist_id: 'bob', status: 'confirmed' },
    ];
    const picked = pickRoundRobin([alice, bob, carol], bookings);
    expect(picked?.id).toBe('carol');
  });

  it('picks the therapist with fewest bookings', () => {
    const bookings: ExistingBooking[] = [
      { therapist_id: 'alice', status: 'confirmed' },
      { therapist_id: 'alice', status: 'confirmed' },
      { therapist_id: 'bob', status: 'confirmed' },
    ];
    const picked = pickRoundRobin([alice, bob, carol], bookings);
    expect(picked?.id).toBe('carol'); // 0 bookings
  });

  it('ignores cancelled bookings in count', () => {
    const bookings: ExistingBooking[] = [
      { therapist_id: 'alice', status: 'cancelled' },
      { therapist_id: 'bob', status: 'confirmed' },
    ];
    // Alice has 0 counted (cancelled ignored), Bob has 1
    const picked = pickRoundRobin([alice, bob], bookings);
    expect(picked?.id).toBe('alice');
  });

  it('uses alphabetical tie-break when counts are equal', () => {
    const picked = pickRoundRobin([carol, bob, alice], []);
    expect(picked?.id).toBe('alice'); // alphabetically first
  });

  it('returns undefined when no therapists available', () => {
    expect(pickRoundRobin([], [])).toBeUndefined();
  });

  it('distributes evenly across multiple rounds', () => {
    // Simulate 3 sequential allocations
    const bookings: ExistingBooking[] = [];

    const first = pickRoundRobin([alice, bob, carol], bookings)!;
    expect(first.id).toBe('alice'); // all at 0, alphabetical
    bookings.push({ therapist_id: first.id, status: 'confirmed' });

    const second = pickRoundRobin([alice, bob, carol], bookings)!;
    expect(second.id).toBe('bob'); // bob=0, carol=0, alice=1 → bob alphabetical
    bookings.push({ therapist_id: second.id, status: 'confirmed' });

    const third = pickRoundRobin([alice, bob, carol], bookings)!;
    expect(third.id).toBe('carol'); // carol=0, others=1
    bookings.push({ therapist_id: third.id, status: 'confirmed' });

    // 4th round — all at 1, back to alphabetical
    const fourth = pickRoundRobin([alice, bob, carol], bookings)!;
    expect(fourth.id).toBe('alice');
  });

  it('handles single therapist', () => {
    const bookings: ExistingBooking[] = [
      { therapist_id: 'alice', status: 'confirmed' },
      { therapist_id: 'alice', status: 'confirmed' },
    ];
    const picked = pickRoundRobin([alice], bookings);
    expect(picked?.id).toBe('alice');
  });
});
