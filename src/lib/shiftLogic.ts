// Pure logic for per-date staff shifts — no Supabase/React imports, so this
// stays directly unit-testable and reusable across the shift dialog,
// mutation-time validation, and hours display without triplicating.

export interface ShiftBlock {
  id?: string;
  start_minute: number;
  end_minute: number;
  break_start_minute?: number | null;
  break_end_minute?: number | null;
}

// Half-open interval overlap, no buffer — touching boundaries (one shift
// ending at 12:00, the next starting at 12:00) are allowed, matching normal
// back-to-back shift scheduling. Same shape as the booking-conflict check in
// AdminDashboard.tsx minus its 15-minute buffer term, since shifts don't need one.
// A block's own internal break never counts as a conflict against itself or
// other blocks — it's just time excluded from that block's worked minutes.
export function shiftsOverlap(a: ShiftBlock, b: ShiftBlock): boolean {
  return a.start_minute < b.end_minute && a.end_minute > b.start_minute;
}

// First existing shift that conflicts with the candidate, or null. `excludeId`
// lets an in-place edit skip comparing the shift against itself.
export function findShiftConflict(candidate: ShiftBlock, existing: ShiftBlock[], excludeId?: string): ShiftBlock | null {
  return existing.find(s => s.id !== excludeId && shiftsOverlap(candidate, s)) ?? null;
}

// Sum of (end - start) per block, minus each block's own internal break (if
// set). Gaps *between* blocks are never in the array, so time off between
// separate blocks is naturally excluded too — no separate subtraction needed there.
export function sumShiftMinutes(shifts: ShiftBlock[]): number {
  return shifts.reduce((total, s) => {
    const breakMinutes = s.break_start_minute != null && s.break_end_minute != null
      ? Math.max(0, s.break_end_minute - s.break_start_minute)
      : 0;
    return total + (s.end_minute - s.start_minute) - breakMinutes;
  }, 0);
}

// Per-date minute totals, for weekly/monthly rollups. Excludes each block's
// own internal break, same as sumShiftMinutes.
export function aggregateShiftHours(shifts: { shift_date: string; start_minute: number; end_minute: number; break_start_minute?: number | null; break_end_minute?: number | null }[]): Record<string, number> {
  const byDate: Record<string, number> = {};
  for (const s of shifts) {
    const breakMinutes = s.break_start_minute != null && s.break_end_minute != null
      ? Math.max(0, s.break_end_minute - s.break_start_minute)
      : 0;
    byDate[s.shift_date] = (byDate[s.shift_date] || 0) + (s.end_minute - s.start_minute) - breakMinutes;
  }
  return byDate;
}

export const formatMinutesHHMM = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
