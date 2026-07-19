import { describe, it, expect } from 'vitest';
import { shiftsOverlap, findShiftConflict, sumShiftMinutes, aggregateShiftHours } from '@/lib/shiftLogic';

describe('shiftsOverlap', () => {
  it('detects an exact overlap', () => {
    expect(shiftsOverlap({ start_minute: 540, end_minute: 720 }, { start_minute: 540, end_minute: 720 })).toBe(true);
  });

  it('detects a nested overlap', () => {
    // 09:00-17:00 vs 11:30-14:00 nested inside
    expect(shiftsOverlap({ start_minute: 540, end_minute: 1020 }, { start_minute: 690, end_minute: 840 })).toBe(true);
  });

  it('detects a partial overlap from the left', () => {
    // 09:00-12:00 vs 11:30-14:00
    expect(shiftsOverlap({ start_minute: 540, end_minute: 720 }, { start_minute: 690, end_minute: 840 })).toBe(true);
  });

  it('detects a partial overlap from the right', () => {
    // 11:30-14:00 vs 09:00-12:00 (order swapped)
    expect(shiftsOverlap({ start_minute: 690, end_minute: 840 }, { start_minute: 540, end_minute: 720 })).toBe(true);
  });

  it('allows touching boundaries — one shift ending exactly when the next starts', () => {
    // 09:00-12:00 and 12:00-14:00
    expect(shiftsOverlap({ start_minute: 540, end_minute: 720 }, { start_minute: 720, end_minute: 840 })).toBe(false);
  });

  it('allows two genuinely separate blocks with a gap', () => {
    // 09:00-12:00 and 16:00-20:00
    expect(shiftsOverlap({ start_minute: 540, end_minute: 720 }, { start_minute: 960, end_minute: 1200 })).toBe(false);
  });

  it('a block\'s own internal break does not affect overlap detection against another block', () => {
    // 09:00-13:00 (with an internal break) vs 16:00-20:00 — still no overlap
    const a = { start_minute: 9 * 60, end_minute: 13 * 60, break_start_minute: 11 * 60, break_end_minute: 11 * 60 + 30 };
    const b = { start_minute: 16 * 60, end_minute: 20 * 60 };
    expect(shiftsOverlap(a, b)).toBe(false);
  });
});

describe('findShiftConflict', () => {
  it('returns null when there is no conflict among multiple existing blocks', () => {
    const existing = [
      { id: '1', start_minute: 540, end_minute: 720 }, // 09:00-12:00
      { id: '2', start_minute: 960, end_minute: 1200 }, // 16:00-20:00
    ];
    const candidate = { start_minute: 720, end_minute: 900 }; // 12:00-15:00, touches #1, gap before #2
    expect(findShiftConflict(candidate, existing)).toBeNull();
  });

  it('finds the conflicting block among several', () => {
    const existing = [
      { id: '1', start_minute: 540, end_minute: 720 }, // 09:00-12:00
      { id: '2', start_minute: 780, end_minute: 900 }, // 13:00-15:00
      { id: '3', start_minute: 960, end_minute: 1200 }, // 16:00-20:00
    ];
    const candidate = { start_minute: 690, end_minute: 840 }; // 11:30-14:00, overlaps #1 and #2
    const conflict = findShiftConflict(candidate, existing);
    expect(conflict?.id).toBe('1');
  });

  it('excludes the shift being edited via excludeId', () => {
    const existing = [{ id: 'self', start_minute: 540, end_minute: 720 }];
    const candidate = { start_minute: 600, end_minute: 780 }; // overlaps 'self', but editing 'self' itself
    expect(findShiftConflict(candidate, existing, 'self')).toBeNull();
  });
});

describe('sumShiftMinutes', () => {
  it('sums independent shift blocks, not last-end minus first-start', () => {
    // 09:00-12:00 (3h) + 16:00-20:00 (4h) = 7h = 420 minutes, NOT (20:00-09:00)=11h
    const shifts = [
      { start_minute: 9 * 60, end_minute: 12 * 60 },
      { start_minute: 16 * 60, end_minute: 20 * 60 },
    ];
    expect(sumShiftMinutes(shifts)).toBe(7 * 60);
  });

  it('returns 0 for an empty list', () => {
    expect(sumShiftMinutes([])).toBe(0);
  });

  it('subtracts a block\'s own internal break from its worked minutes', () => {
    // 09:00-13:00 (4h) with an 11:00-11:30 break (30min) = 3.5h = 210 minutes
    const shifts = [
      { start_minute: 9 * 60, end_minute: 13 * 60, break_start_minute: 11 * 60, break_end_minute: 11 * 60 + 30 },
    ];
    expect(sumShiftMinutes(shifts)).toBe(3.5 * 60);
  });

  it('subtracts breaks independently across multiple blocks in a split shift', () => {
    // 09:00-13:00 with a 30min break = 3.5h, + 16:00-20:00 with a 15min break = 3.75h
    const shifts = [
      { start_minute: 9 * 60, end_minute: 13 * 60, break_start_minute: 11 * 60, break_end_minute: 11 * 60 + 30 },
      { start_minute: 16 * 60, end_minute: 20 * 60, break_start_minute: 18 * 60, break_end_minute: 18 * 60 + 15 },
    ];
    expect(sumShiftMinutes(shifts)).toBe(3.5 * 60 + 3.75 * 60);
  });

  it('ignores a null break (no break set)', () => {
    const shifts = [
      { start_minute: 9 * 60, end_minute: 13 * 60, break_start_minute: null, break_end_minute: null },
    ];
    expect(sumShiftMinutes(shifts)).toBe(4 * 60);
  });
});

describe('aggregateShiftHours', () => {
  it('sums multiple shifts on the same date', () => {
    const shifts = [
      { shift_date: '2026-07-20', start_minute: 9 * 60, end_minute: 12 * 60 },
      { shift_date: '2026-07-20', start_minute: 16 * 60, end_minute: 20 * 60 },
    ];
    expect(aggregateShiftHours(shifts)).toEqual({ '2026-07-20': 7 * 60 });
  });

  it('keeps different dates independent', () => {
    const shifts = [
      { shift_date: '2026-07-20', start_minute: 9 * 60, end_minute: 12 * 60 },
      { shift_date: '2026-07-21', start_minute: 10 * 60, end_minute: 18 * 60 },
    ];
    expect(aggregateShiftHours(shifts)).toEqual({
      '2026-07-20': 3 * 60,
      '2026-07-21': 8 * 60,
    });
  });

  it('returns an empty map for an empty list', () => {
    expect(aggregateShiftHours([])).toEqual({});
  });

  it('subtracts each block\'s break when rolling up by date', () => {
    const shifts = [
      { shift_date: '2026-07-20', start_minute: 9 * 60, end_minute: 13 * 60, break_start_minute: 11 * 60, break_end_minute: 11 * 60 + 30 },
      { shift_date: '2026-07-20', start_minute: 16 * 60, end_minute: 20 * 60 },
    ];
    // (4h - 30min) + 4h = 7.5h = 450 minutes
    expect(aggregateShiftHours(shifts)).toEqual({ '2026-07-20': 7.5 * 60 });
  });
});
