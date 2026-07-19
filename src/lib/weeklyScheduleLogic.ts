// Pure logic for the recurring weekly-hours template (therapist_weekly_hours)
// — one row per shift block, multiple rows allowed per day_of_week. Distinct
// from src/lib/shiftLogic.ts's ShiftBlock, which is the per-DATE
// therapist_shifts table and can carry its own internal break per block.
// A WeeklyShiftBlock never has a break field: breaks here are always the gap
// between two consecutive blocks on the same day, computed by deriveBreaks()
// — never stored, never directly editable.

export interface WeeklyShiftBlock {
  id?: string; // undefined for a block not yet persisted (newly added in the editor)
  day_of_week: number; // 1=Mon..7=Sun
  start_minute: number;
  end_minute: number;
}

export type DayBlocksMap = Record<number, WeeklyShiftBlock[]>;

export interface DerivedBreak {
  start_minute: number; // = previous block's end_minute
  end_minute: number;   // = next block's start_minute
}

export const MIN_BLOCK_STEP_MINUTES = 15;
export const DAY_END_MINUTE = 24 * 60; // 1440, exclusive upper bound for a block's end_minute
export const LAST_VALID_START_MINUTE = DAY_END_MINUTE - MIN_BLOCK_STEP_MINUTES; // 1425 (23:45)

/** Ascending by start_minute. */
export function sortBlocks<T extends { start_minute: number }>(blocks: T[]): T[] {
  return [...blocks].sort((a, b) => a.start_minute - b.start_minute);
}

// Half-open interval overlap, touching boundaries OK (one block ending at
// 12:00, the next starting at 12:00 is not an overlap).
export function blocksOverlap(a: { start_minute: number; end_minute: number }, b: { start_minute: number; end_minute: number }): boolean {
  return a.start_minute < b.end_minute && a.end_minute > b.start_minute;
}

/** First existing block that overlaps `candidate`, excluding `excludeId` (for in-place edits), or null. */
export function findBlockConflict(
  candidate: { start_minute: number; end_minute: number },
  existing: WeeklyShiftBlock[],
  excludeId?: string,
): WeeklyShiftBlock | null {
  return existing.find(b => (excludeId === undefined || b.id !== excludeId) && blocksOverlap(candidate, b)) ?? null;
}

/** Gaps between consecutive blocks once sorted — these ARE the displayed
 * "breaks." Adjacent/touching blocks (end === next start) produce no gap. */
export function deriveBreaks(blocks: { start_minute: number; end_minute: number }[]): DerivedBreak[] {
  const sorted = sortBlocks(blocks);
  const breaks: DerivedBreak[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = sorted[i].end_minute;
    const gapEnd = sorted[i + 1].start_minute;
    if (gapEnd > gapStart) breaks.push({ start_minute: gapStart, end_minute: gapEnd });
  }
  return breaks;
}

/** Does [startMins, endMins) fit ENTIRELY within any single one of `blocks`?
 * Replaces the old "startMins < dayHours.start_minute ... break check"
 * single-range-plus-break pattern — a candidate spanning the gap between
 * two blocks does NOT fit, even though it might fit "start to end" overall. */
export function fitsInAnyBlock(startMins: number, endMins: number, blocks: { start_minute: number; end_minute: number }[]): boolean {
  return blocks.some(b => startMins >= b.start_minute && endMins <= b.end_minute);
}

export interface DaySummary {
  shiftCount: number;
  totalMinutes: number; // sum of (end-start) across all blocks; gaps aren't in the array so breaks are naturally excluded
  breakMinutes: number; // sum of derived-break durations
}

/** "N shifts / Xh total / Yh break" summary line inputs. Zeroed for an empty/off day. */
export function summarizeDay(blocks: { start_minute: number; end_minute: number }[]): DaySummary {
  const totalMinutes = blocks.reduce((sum, b) => sum + (b.end_minute - b.start_minute), 0);
  const breakMinutes = deriveBreaks(blocks).reduce((sum, b) => sum + (b.end_minute - b.start_minute), 0);
  return { shiftCount: blocks.length, totalMinutes, breakMinutes };
}

/** Snap an arbitrary minute value to the nearest step, clamped to [0, 1440]. */
export function snapToStep(mins: number, step: number = MIN_BLOCK_STEP_MINUTES): number {
  const clamped = Math.max(0, Math.min(DAY_END_MINUTE, mins));
  return Math.round(clamped / step) * step;
}

/** Default start/end for a newly-added block: starts right after the day's
 * current last block ends (or 09:00 if this is the day's first block),
 * defaults to a 4-hour span, clamped so end_minute never exceeds 1440. */
export function defaultNewBlock(existingBlocksForDay: { start_minute: number; end_minute: number }[]): { start_minute: number; end_minute: number } {
  const sorted = sortBlocks(existingBlocksForDay);
  const prevEnd = sorted.length > 0 ? sorted[sorted.length - 1].end_minute : 9 * 60;
  const start = Math.min(prevEnd, LAST_VALID_START_MINUTE);
  const end = Math.min(start + 4 * 60, DAY_END_MINUTE);
  return { start_minute: start, end_minute: Math.max(end, start + MIN_BLOCK_STEP_MINUTES) };
}

/** If `candidate` overlaps a block in `otherBlocksForDay`, nudge its start
 * forward to that block's end_minute (auto-nudge, not a blocking error),
 * preserving duration and clamping end to DAY_END_MINUTE. Unchanged if no conflict. */
export function nudgeBlockStart(
  candidate: { start_minute: number; end_minute: number },
  otherBlocksForDay: { start_minute: number; end_minute: number; id?: string }[],
  excludeId?: string,
): { start_minute: number; end_minute: number } {
  const conflict = findBlockConflict(candidate, otherBlocksForDay as WeeklyShiftBlock[], excludeId);
  if (!conflict) return candidate;
  const duration = candidate.end_minute - candidate.start_minute;
  const newStart = conflict.end_minute;
  const newEnd = Math.min(newStart + duration, DAY_END_MINUTE);
  return { start_minute: newStart, end_minute: newEnd };
}

/** Repeatedly applies nudgeBlockStart until no conflict remains or the
 * block has been pushed past DAY_END_MINUTE. Bounded to blocks.length+1
 * iterations to guarantee termination. A result with end_minute <=
 * start_minute means "no room left today" — callers should reject the add. */
export function resolveOverlapsForDay(
  candidate: { start_minute: number; end_minute: number },
  otherBlocksForDay: { start_minute: number; end_minute: number; id?: string }[],
  excludeId?: string,
): { start_minute: number; end_minute: number } {
  let result = candidate;
  for (let i = 0; i < otherBlocksForDay.length + 1; i++) {
    const next = nudgeBlockStart(result, otherBlocksForDay, excludeId);
    if (next.start_minute === result.start_minute && next.end_minute === result.end_minute) return next;
    result = next;
  }
  return result;
}

export function isValidBlock(b: { start_minute: number; end_minute: number }): boolean {
  return (
    Number.isInteger(b.start_minute) && Number.isInteger(b.end_minute) &&
    b.start_minute >= 0 && b.end_minute <= DAY_END_MINUTE &&
    b.end_minute > b.start_minute &&
    b.start_minute % MIN_BLOCK_STEP_MINUTES === 0 &&
    b.end_minute % MIN_BLOCK_STEP_MINUTES === 0
  );
}

/** Group a flat array of rows (as returned by Supabase's
 * `therapist_weekly_hours(*)` embed) into a DayBlocksMap, always with all
 * 7 keys present (empty array for days with no rows). */
export function groupBlocksByDay(rows: WeeklyShiftBlock[]): DayBlocksMap {
  const byDay: DayBlocksMap = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
  for (const row of rows) {
    (byDay[row.day_of_week] ||= []).push(row);
  }
  for (const day of Object.keys(byDay)) {
    byDay[Number(day)] = sortBlocks(byDay[Number(day)]);
  }
  return byDay;
}

/** Flatten a DayBlocksMap back into the flat array shape the DB expects for
 * a full-replace insert. Stamps is_working=true on every row — see the
 * migration's comment: is_working is always true for a persisted block. */
export function flattenBlocksByDay(byDay: DayBlocksMap): Array<{ day_of_week: number; is_working: true; start_minute: number; end_minute: number }> {
  const out: Array<{ day_of_week: number; is_working: true; start_minute: number; end_minute: number }> = [];
  for (const dayStr of Object.keys(byDay)) {
    const day = Number(dayStr);
    for (const b of byDay[day]) {
      out.push({ day_of_week: day, is_working: true, start_minute: b.start_minute, end_minute: b.end_minute });
    }
  }
  return out;
}
