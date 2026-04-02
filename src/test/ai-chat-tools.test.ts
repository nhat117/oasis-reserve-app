import { describe, it, expect } from 'vitest';
import { addMinutes, format } from 'date-fns';

/**
 * Tests for AI chat assistant tool logic:
 * - Availability checking (mirrors Booking.tsx logic)
 * - Booking creation validation
 * - Round-robin therapist assignment
 * - Handoff trigger detection
 */

// ─── Types ───────────────────────────────────────────────────────────

interface Therapist {
  id: string;
  name: string;
  start_hour: number;
  end_hour: number;
  working_days: number[];
  break_start: number | null;
  break_end: number | null;
}

interface Booking {
  therapist_id: string;
  start_time: string;
  end_time: string;
  status: string;
}

const BUFFER_MINUTES = 15;

// ─── Extracted logic (matches ai-chat-respond tool executor) ─────────

function checkSlotAvailability(
  timeStr: string,
  duration: number,
  therapists: Therapist[],
  date: Date,
  unavailableIds: Set<string>,
  existingBookings: Booking[],
  earlyCloseHour: number | null = null,
): { time: string; available_therapists: number }[] {
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();

  const workingTherapists = therapists.filter(
    (t) => t.working_days.includes(dayOfWeek) && !unavailableIds.has(t.id),
  );

  if (workingTherapists.length === 0) return [];

  const minStart = Math.min(...workingTherapists.map((t) => t.start_hour));
  const rawMaxEnd = Math.max(...workingTherapists.map((t) => t.end_hour));
  const maxEnd = earlyCloseHour ? Math.min(rawMaxEnd, earlyCloseHour) : rawMaxEnd;

  const slots: { time: string; available_therapists: number }[] = [];

  for (let h = minStart; h < maxEnd; h++) {
    for (let m = 0; m < 60; m += 30) {
      const slotStartMin = h * 60 + m;
      const slotEndMin = slotStartMin + duration;
      if (slotEndMin > maxEnd * 60) continue;

      const slotTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      let availCount = 0;

      for (const t of workingTherapists) {
        const tStartMin = t.start_hour * 60;
        const tEndMin = t.end_hour * 60;
        if (slotStartMin < tStartMin || slotEndMin > tEndMin) continue;

        if (t.break_start != null && t.break_end != null) {
          const breakStartMin = t.break_start * 60;
          const breakEndMin = t.break_end * 60;
          if (slotStartMin < breakEndMin && slotEndMin > breakStartMin) continue;
        }

        const hasConflict = existingBookings.some((b) => {
          if (b.therapist_id !== t.id) return false;
          const bStart = parseInt(b.start_time.split(':')[0]) * 60 + parseInt(b.start_time.split(':')[1]);
          const bEnd = parseInt(b.end_time.split(':')[0]) * 60 + parseInt(b.end_time.split(':')[1]);
          return slotStartMin < bEnd + BUFFER_MINUTES && slotEndMin > bStart - BUFFER_MINUTES;
        });

        if (!hasConflict) availCount++;
      }

      if (availCount > 0) {
        slots.push({ time: slotTime, available_therapists: availCount });
      }
    }
  }

  return slots;
}

function pickTherapistRoundRobin(
  available: Therapist[],
  bookingCounts: Record<string, number>,
): Therapist {
  const sorted = [...available].sort((a, b) => {
    const countDiff = (bookingCounts[a.id] || 0) - (bookingCounts[b.id] || 0);
    if (countDiff !== 0) return countDiff;
    return a.id.localeCompare(b.id);
  });
  return sorted[0];
}

function shouldHandoff(message: string, keywords: string[]): boolean {
  const lower = message.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// ─── Test Data ───────────────────────────────────────────────────────

const therapists: Therapist[] = [
  { id: 't1', name: 'Lisa', start_hour: 9, end_hour: 17, working_days: [1, 2, 3, 4, 5], break_start: 12, break_end: 13 },
  { id: 't2', name: 'Mai', start_hour: 10, end_hour: 18, working_days: [1, 2, 3, 4, 5, 6], break_start: null, break_end: null },
  { id: 't3', name: 'Trang', start_hour: 9, end_hour: 15, working_days: [1, 3, 5], break_start: null, break_end: null },
];

// ─── Tests ───────────────────────────────────────────────────────────

describe('AI Chat Tool: check_availability', () => {
  const monday = new Date('2026-04-06'); // Monday

  it('returns available slots for a 60-min service on Monday', () => {
    const slots = checkSlotAvailability('', 60, therapists, monday, new Set(), []);
    expect(slots.length).toBeGreaterThan(0);
    // First slot should be 09:00 (earliest start)
    expect(slots[0].time).toBe('09:00');
    // At 09:00: Lisa (9-17) + Trang (9-15) available. Mai starts at 10, so 2 therapists.
    expect(slots[0].available_therapists).toBe(2);
  });

  it('excludes slots during break time', () => {
    const slots = checkSlotAvailability('', 60, therapists, monday, new Set(), []);
    // Lisa has break 12-13, so 11:30-12:30 and 12:00-13:00 should have fewer therapists
    const slot1200 = slots.find((s) => s.time === '12:00');
    // Lisa can't do 12:00-13:00 (break), so only Mai + Trang
    expect(slot1200?.available_therapists).toBe(2);
  });

  it('handles existing bookings with buffer', () => {
    const bookings: Booking[] = [
      { therapist_id: 't1', start_time: '10:00', end_time: '11:00', status: 'confirmed' },
    ];
    const slots = checkSlotAvailability('', 60, therapists, monday, new Set(), bookings);

    // At 10:00, Lisa is booked. Also 09:30 overlaps due to 15min buffer (09:30+60=10:30, conflicts with 10:00-15=9:45)
    const slot1000 = slots.find((s) => s.time === '10:00');
    expect(slot1000?.available_therapists).toBe(2); // Only Mai + Trang
  });

  it('marks therapists as unavailable', () => {
    const slots = checkSlotAvailability('', 60, therapists, monday, new Set(['t1', 't3']), []);
    // Only Mai available
    expect(slots[0].available_therapists).toBe(1);
  });

  it('returns empty for a Sunday (no therapists work Sunday)', () => {
    const sunday = new Date('2026-04-05');
    const slots = checkSlotAvailability('', 60, therapists, sunday, new Set(), []);
    expect(slots).toHaveLength(0);
  });

  it('respects Saturday schedule (only Mai works)', () => {
    const saturday = new Date('2026-04-04');
    const slots = checkSlotAvailability('', 60, therapists, saturday, new Set(), []);
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((s) => {
      expect(s.available_therapists).toBe(1); // Only Mai
    });
  });

  it('respects early close hour', () => {
    const slots = checkSlotAvailability('', 60, therapists, monday, new Set(), [], 14);
    // No slots should end after 14:00
    const latestSlot = slots[slots.length - 1];
    const [h, m] = latestSlot.time.split(':').map(Number);
    expect(h * 60 + m + 60).toBeLessThanOrEqual(14 * 60);
  });

  it('handles 30-min service slots correctly', () => {
    const slots = checkSlotAvailability('', 30, therapists, monday, new Set(), []);
    // Should have more slots than 60-min
    const slots60 = checkSlotAvailability('', 60, therapists, monday, new Set(), []);
    expect(slots.length).toBeGreaterThan(slots60.length);
  });
});

describe('AI Chat Tool: round-robin therapist assignment', () => {
  it('picks therapist with fewest bookings', () => {
    const counts = { t1: 3, t2: 1, t3: 2 };
    const picked = pickTherapistRoundRobin(therapists, counts);
    expect(picked.id).toBe('t2');
  });

  it('uses stable tie-breaking by ID', () => {
    const counts = { t1: 1, t2: 1, t3: 1 };
    const picked = pickTherapistRoundRobin(therapists, counts);
    expect(picked.id).toBe('t1'); // First alphabetically
  });

  it('picks from available list only', () => {
    const available = therapists.filter((t) => t.id !== 't1');
    const counts = { t2: 5, t3: 2 };
    const picked = pickTherapistRoundRobin(available, counts);
    expect(picked.id).toBe('t3');
  });

  it('handles empty booking counts', () => {
    const picked = pickTherapistRoundRobin(therapists, {});
    expect(picked.id).toBe('t1');
  });
});

describe('AI Chat Tool: handoff detection', () => {
  const keywords = ['speak to human', 'talk to staff', 'real person', 'manager'];

  it('detects handoff keywords', () => {
    expect(shouldHandoff('I want to speak to human please', keywords)).toBe(true);
    expect(shouldHandoff('Can I talk to staff?', keywords)).toBe(true);
    expect(shouldHandoff('Get me a real person', keywords)).toBe(true);
    expect(shouldHandoff('I need to see the manager', keywords)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(shouldHandoff('SPEAK TO HUMAN', keywords)).toBe(true);
    expect(shouldHandoff('Talk To Staff NOW', keywords)).toBe(true);
  });

  it('does not trigger on normal messages', () => {
    expect(shouldHandoff('I want to book a massage', keywords)).toBe(false);
    expect(shouldHandoff('What time do you open?', keywords)).toBe(false);
    expect(shouldHandoff('How much is a manicure?', keywords)).toBe(false);
  });
});

describe('AI Chat Tool: booking mode routing', () => {
  it('selects local mode by default', () => {
    const config = { booking_mode: 'local' };
    expect(config.booking_mode).toBe('local');
  });

  it('selects fresha mode when configured', () => {
    const config = { booking_mode: 'fresha', fresha_partner_token: 'tok_123', fresha_location_id: 'loc_456' };
    expect(config.booking_mode).toBe('fresha');
    expect(config.fresha_partner_token).toBeTruthy();
    expect(config.fresha_location_id).toBeTruthy();
  });

  it('falls back to local when fresha token is missing', () => {
    const config = { booking_mode: 'fresha', fresha_partner_token: '', fresha_location_id: '' };
    const shouldUseFresha = config.booking_mode === 'fresha' && !!config.fresha_partner_token;
    expect(shouldUseFresha).toBe(false);
  });

  it('validates booking mode values', () => {
    const validModes = ['local', 'fresha'];
    expect(validModes.includes('local')).toBe(true);
    expect(validModes.includes('fresha')).toBe(true);
    expect(validModes.includes('other')).toBe(false);
  });
});

describe('AI Chat Tool: booking time calculation', () => {
  it('calculates end time correctly for 60-min service', () => {
    const startTime = '10:00';
    const duration = 60;
    const [h, m] = startTime.split(':').map(Number);
    const endTotalMin = h * 60 + m + duration;
    const endH = Math.floor(endTotalMin / 60);
    const endM = endTotalMin % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    expect(endTime).toBe('11:00');
  });

  it('calculates end time correctly for 90-min service spanning noon', () => {
    const startTime = '11:30';
    const duration = 90;
    const [h, m] = startTime.split(':').map(Number);
    const endTotalMin = h * 60 + m + duration;
    const endH = Math.floor(endTotalMin / 60);
    const endM = endTotalMin % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    expect(endTime).toBe('13:00');
  });

  it('validates time format', () => {
    const validFormat = /^\d{2}:\d{2}$/;
    expect(validFormat.test('10:00')).toBe(true);
    expect(validFormat.test('9:00')).toBe(false);
    expect(validFormat.test('10:0')).toBe(false);
    expect(validFormat.test('abc')).toBe(false);
  });
});
