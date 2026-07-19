import { describe, it, expect } from 'vitest';
import { addMinutes, format } from 'date-fns';
import { fitsInAnyBlock, WeeklyShiftBlock } from '@/lib/weeklyScheduleLogic';

// Pure logic extracted from Booking.tsx for testing — mirrors
// getAvailableTherapists' actual filter chain, now against the multi-block
// weekly-hours model (a day is zero or more independent shift blocks;
// breaks are just the gap between two blocks, never a stored field).

interface Therapist {
  id: string;
  name: string;
  therapist_weekly_hours: WeeklyShiftBlock[];
}

interface ExistingBooking {
  therapist_id: string;
  start_time: string;
  end_time: string;
  status: string;
}

const BUFFER_MINUTES = 15;

function getDayBlocks(therapist: Therapist, dayOfWeek: number): WeeklyShiftBlock[] {
  return therapist.therapist_weekly_hours.filter(r => r.day_of_week === dayOfWeek);
}

function getAvailableTherapists(
  timeStr: string,
  duration: number,
  therapists: Therapist[],
  selectedDate: Date,
  unavailableIds: string[],
  existingBookings: ExistingBooking[]
): Therapist[] {
  const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
  const endStr = format(addMinutes(new Date(`2000-01-01T${timeStr}`), duration), 'HH:mm');

  return therapists.filter(t => {
    if (unavailableIds.includes(t.id)) return false;
    const dayBlocks = getDayBlocks(t, dayOfWeek);
    if (dayBlocks.length === 0) return false;

    const slotStartMin = parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1]);
    const slotEndMin = parseInt(endStr.split(':')[0]) * 60 + parseInt(endStr.split(':')[1]);
    if (!fitsInAnyBlock(slotStartMin, slotEndMin, dayBlocks)) return false;

    // Existing booking overlap check with buffer
    const isBooked = existingBookings.some(b => {
      if (b.therapist_id !== t.id) return false;
      const bStartParts = b.start_time.split(':');
      const bEndParts = b.end_time.split(':');
      const bStartMin = parseInt(bStartParts[0]) * 60 + parseInt(bStartParts[1]);
      const bEndMin = parseInt(bEndParts[0]) * 60 + parseInt(bEndParts[1]);
      return slotStartMin < (bEndMin + BUFFER_MINUTES) && slotEndMin > (bStartMin - BUFFER_MINUTES);
    });
    return !isBooked;
  });
}

// A has a split shift on working days (09:00-12:00 + 13:00-18:00, i.e. a
// 12:00-13:00 lunch break) — represented as two blocks per working day,
// not one row with a break window. B works a single unbroken block.
const makeWeeklyHours = (workingDays: number[], blocks: { start: number; end: number }[]): WeeklyShiftBlock[] =>
  workingDays.flatMap(day => blocks.map(b => ({ day_of_week: day, start_minute: b.start * 60, end_minute: b.end * 60 })));

const therapistA: Therapist = {
  id: 'a', name: 'A',
  therapist_weekly_hours: makeWeeklyHours([1, 2, 3, 4, 5, 6], [{ start: 9, end: 12 }, { start: 13, end: 18 }]),
};
const therapistB: Therapist = {
  id: 'b', name: 'B',
  therapist_weekly_hours: makeWeeklyHours([1, 2, 3, 4, 5], [{ start: 10, end: 17 }]),
};

// Monday
const monday = new Date('2026-03-30');

describe('Booking Availability', () => {
  it('returns therapists within operating hours', () => {
    const result = getAvailableTherapists('09:00', 60, [therapistA, therapistB], monday, [], []);
    expect(result.map(t => t.id)).toEqual(['a']); // B starts at 10
  });

  it('excludes therapist outside working hours', () => {
    const result = getAvailableTherapists('17:00', 60, [therapistA, therapistB], monday, [], []);
    expect(result.map(t => t.id)).toEqual(['a']); // B ends at 17, so 17-18 is out
  });

  it('excludes therapist on unavailable list', () => {
    const result = getAvailableTherapists('10:00', 60, [therapistA, therapistB], monday, ['a'], []);
    expect(result.map(t => t.id)).toEqual(['b']);
  });

  it('excludes therapist during the gap between two shift blocks', () => {
    const result = getAvailableTherapists('12:00', 60, [therapistA, therapistB], monday, [], []);
    // A's blocks are 09:00-12:00 and 13:00-18:00, so 12:00-13:00 fits in neither; B has one unbroken block
    expect(result.map(t => t.id)).toEqual(['b']);
  });

  it('rejects a candidate spanning the gap between two blocks even though it fits start-to-end', () => {
    // 11:30-12:30 (60min) starts inside A's first block but ends inside the
    // gap — must be rejected, not accepted just because 11:30 >= 9:00 and
    // 12:30 <= 18:00 (the old single-range bug this replaces).
    const result = getAvailableTherapists('11:30', 60, [therapistA], monday, [], []);
    expect(result).toEqual([]);
  });

  it('excludes therapist with overlapping booking', () => {
    const bookings: ExistingBooking[] = [
      { therapist_id: 'a', start_time: '10:00:00', end_time: '11:00:00', status: 'confirmed' },
    ];
    const result = getAvailableTherapists('10:00', 60, [therapistA, therapistB], monday, [], bookings);
    expect(result.map(t => t.id)).toEqual(['b']);
  });

  it('respects 15-min buffer between bookings', () => {
    const bookings: ExistingBooking[] = [
      { therapist_id: 'a', start_time: '10:00:00', end_time: '11:00:00', status: 'confirmed' },
    ];
    // 11:00 slot should still be blocked due to 15min buffer (11:00 < 11:00+15=11:15)
    const result = getAvailableTherapists('11:00', 60, [therapistA, therapistB], monday, [], bookings);
    expect(result.map(t => t.id)).toEqual(['b']);
  });

  it('allows booking after buffer period, within the second shift block', () => {
    const bookings: ExistingBooking[] = [
      { therapist_id: 'a', start_time: '10:00:00', end_time: '11:00:00', status: 'confirmed' },
    ];
    // 13:00-13:30 falls entirely within A's second block (13:00-18:00)
    const result = getAvailableTherapists('13:00', 30, [therapistA, therapistB], monday, [], bookings);
    expect(result.map(t => t.id)).toContain('a');
  });

  it('excludes therapist not working on Sunday', () => {
    const sunday = new Date('2026-03-29'); // Sunday
    const result = getAvailableTherapists('10:00', 60, [therapistA, therapistB], sunday, [], []);
    // A works [1-6] (Mon-Sat), B works [1-5] (Mon-Fri) — neither works Sunday (7)
    expect(result).toEqual([]);
  });

  it('excludes slot that ends after operating hours', () => {
    // 90 min service starting at 17:00 ends at 18:30, past A's 18:00 end_minute.
    const result = getAvailableTherapists('17:00', 90, [therapistA, therapistB], monday, [], []);
    expect(result).toEqual([]);
  });

  it('all therapists available at valid midday slot', () => {
    const result = getAvailableTherapists('14:00', 60, [therapistA, therapistB], monday, [], []);
    expect(result.map(t => t.id)).toContain('a');
    expect(result.map(t => t.id)).toContain('b');
  });
});
