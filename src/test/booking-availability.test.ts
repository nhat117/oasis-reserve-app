import { describe, it, expect } from 'vitest';
import { addMinutes, format } from 'date-fns';

// Pure logic extracted from Booking.tsx for testing

interface Therapist {
  id: string;
  name: string;
  start_hour: number;
  end_hour: number;
  working_days: number[];
  break_start: number | null;
  break_end: number | null;
}

interface ExistingBooking {
  therapist_id: string;
  start_time: string;
  end_time: string;
  status: string;
}

const BUFFER_MINUTES = 15;

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
    if (!t.working_days.includes(dayOfWeek)) return false;

    const slotHour = parseInt(timeStr);
    const endHour = parseInt(endStr);
    if (slotHour < t.start_hour || endHour > t.end_hour) return false;

    // Break time check
    if (t.break_start != null && t.break_end != null) {
      const breakStartMin = t.break_start * 60;
      const breakEndMin = t.break_end * 60;
      const slotStartMin = parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1]);
      const slotEndMin = parseInt(endStr.split(':')[0]) * 60 + parseInt(endStr.split(':')[1]);
      if (slotStartMin < breakEndMin && slotEndMin > breakStartMin) return false;
    }

    // Existing booking overlap check with buffer
    const slotStartMin = parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1]);
    const slotEndMin = parseInt(endStr.split(':')[0]) * 60 + parseInt(endStr.split(':')[1]);
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

const therapistA: Therapist = {
  id: 'a', name: 'A', start_hour: 9, end_hour: 18,
  working_days: [1, 2, 3, 4, 5, 6], break_start: 12, break_end: 13,
};
const therapistB: Therapist = {
  id: 'b', name: 'B', start_hour: 10, end_hour: 17,
  working_days: [1, 2, 3, 4, 5], break_start: null, break_end: null,
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

  it('excludes therapist during break time', () => {
    const result = getAvailableTherapists('12:00', 60, [therapistA, therapistB], monday, [], []);
    // A has break 12-13, so excluded; B has no break
    expect(result.map(t => t.id)).toEqual(['b']);
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

  it('allows booking after buffer period', () => {
    const bookings: ExistingBooking[] = [
      { therapist_id: 'a', start_time: '10:00:00', end_time: '11:00:00', status: 'confirmed' },
    ];
    // Buffer means 11:00-11:15 is blocked. 11:30 start but end 12:30 overlaps A's break (12-13)
    // So A is blocked by break, not buffer. B is available.
    const result = getAvailableTherapists('11:30', 45, [therapistA, therapistB], monday, [], bookings);
    expect(result.map(t => t.id)).toContain('a');
  });

  it('excludes therapist not working on Sunday', () => {
    const sunday = new Date('2026-03-29'); // Sunday
    const result = getAvailableTherapists('10:00', 60, [therapistA, therapistB], sunday, [], []);
    // A works [1-6] (Mon-Sat), B works [1-5] (Mon-Fri) — neither works Sunday (7)
    expect(result).toEqual([]);
  });

  it('excludes slot that ends after operating hours', () => {
    // 90 min service starting at 17:00 would end at 18:30 — too late for A (18) and B (17)
    const result = getAvailableTherapists('17:00', 90, [therapistA, therapistB], monday, [], []);
    expect(result).toEqual([]);
  });

  it('all therapists available at valid midday slot', () => {
    const result = getAvailableTherapists('14:00', 60, [therapistA, therapistB], monday, [], []);
    expect(result.map(t => t.id)).toContain('a');
    expect(result.map(t => t.id)).toContain('b');
  });
});
