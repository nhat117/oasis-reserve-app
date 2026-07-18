import { describe, it, expect } from 'vitest';
import { addMinutes, format } from 'date-fns';

// Pure logic extracted from Booking.tsx for testing

interface WeeklyHour {
  day_of_week: number;
  is_working: boolean;
  start_minute: number;
  end_minute: number;
  break_start_minute: number | null;
  break_end_minute: number | null;
}

interface Therapist {
  id: string;
  name: string;
  therapist_weekly_hours: WeeklyHour[];
}

interface ExistingBooking {
  therapist_id: string;
  start_time: string;
  end_time: string;
  status: string;
}

const BUFFER_MINUTES = 15;

function getDayHours(therapist: Therapist, dayOfWeek: number): WeeklyHour | undefined {
  return therapist.therapist_weekly_hours.find(r => r.day_of_week === dayOfWeek);
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
    const dayHours = getDayHours(t, dayOfWeek);
    if (!dayHours || !dayHours.is_working) return false;

    const slotStartMin = parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1]);
    const slotEndMin = parseInt(endStr.split(':')[0]) * 60 + parseInt(endStr.split(':')[1]);
    if (slotStartMin < dayHours.start_minute || slotEndMin > dayHours.end_minute) return false;

    // Break time check
    if (dayHours.break_start_minute != null && dayHours.break_end_minute != null) {
      if (slotStartMin < dayHours.break_end_minute && slotEndMin > dayHours.break_start_minute) return false;
    }

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

const makeWeeklyHours = (workingDays: number[], startHour: number, endHour: number, breakStartHour: number | null, breakEndHour: number | null): WeeklyHour[] =>
  [1, 2, 3, 4, 5, 6, 7].map(day => ({
    day_of_week: day,
    is_working: workingDays.includes(day),
    start_minute: startHour * 60,
    end_minute: endHour * 60,
    break_start_minute: breakStartHour != null ? breakStartHour * 60 : null,
    break_end_minute: breakEndHour != null ? breakEndHour * 60 : null,
  }));

const therapistA: Therapist = {
  id: 'a', name: 'A', therapist_weekly_hours: makeWeeklyHours([1, 2, 3, 4, 5, 6], 9, 18, 12, 13),
};
const therapistB: Therapist = {
  id: 'b', name: 'B', therapist_weekly_hours: makeWeeklyHours([1, 2, 3, 4, 5], 10, 17, null, null),
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
    // 11:30 + 30min = 12:00 — just fits before A's break starts at 12:00
    // But break check: slotStart(11:30=690) < breakEnd(13:00=780) && slotEnd(12:00=720) > breakStart(12:00=720) => 720 > 720 is false
    // So A should be available
    const result = getAvailableTherapists('11:30', 30, [therapistA, therapistB], monday, [], bookings);
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
    // Minute-precision comparison correctly excludes A (previously a bug when
    // this only compared whole hours, since parseInt("18:30") === 18 === end_hour).
    const result = getAvailableTherapists('17:00', 90, [therapistA, therapistB], monday, [], []);
    expect(result).toEqual([]);
  });

  it('all therapists available at valid midday slot', () => {
    const result = getAvailableTherapists('14:00', 60, [therapistA, therapistB], monday, [], []);
    expect(result.map(t => t.id)).toContain('a');
    expect(result.map(t => t.id)).toContain('b');
  });
});
