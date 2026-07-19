import { describe, it, expect } from 'vitest';
import {
  sortBlocks, blocksOverlap, findBlockConflict, deriveBreaks, fitsInAnyBlock,
  summarizeDay, snapToStep, defaultNewBlock, nudgeBlockStart, resolveOverlapsForDay,
  isValidBlock, groupBlocksByDay, flattenBlocksByDay,
  DAY_END_MINUTE, LAST_VALID_START_MINUTE,
} from '@/lib/weeklyScheduleLogic';

describe('sortBlocks', () => {
  it('sorts ascending by start_minute', () => {
    const blocks = [{ start_minute: 960 }, { start_minute: 540 }, { start_minute: 780 }];
    expect(sortBlocks(blocks).map(b => b.start_minute)).toEqual([540, 780, 960]);
  });

  it('is stable for equal start_minute values', () => {
    const a = { start_minute: 540, tag: 'a' };
    const b = { start_minute: 540, tag: 'b' };
    expect(sortBlocks([a, b]).map(x => x.tag)).toEqual(['a', 'b']);
  });

  it('returns an empty array unchanged', () => {
    expect(sortBlocks([])).toEqual([]);
  });
});

describe('blocksOverlap', () => {
  it('detects an exact overlap', () => {
    expect(blocksOverlap({ start_minute: 540, end_minute: 720 }, { start_minute: 540, end_minute: 720 })).toBe(true);
  });

  it('detects a nested overlap', () => {
    expect(blocksOverlap({ start_minute: 540, end_minute: 1020 }, { start_minute: 690, end_minute: 840 })).toBe(true);
  });

  it('detects a partial overlap from the left', () => {
    expect(blocksOverlap({ start_minute: 540, end_minute: 720 }, { start_minute: 690, end_minute: 840 })).toBe(true);
  });

  it('detects a partial overlap from the right', () => {
    expect(blocksOverlap({ start_minute: 690, end_minute: 840 }, { start_minute: 540, end_minute: 720 })).toBe(true);
  });

  it('allows touching boundaries', () => {
    // 09:00-12:00 and 12:00-14:00
    expect(blocksOverlap({ start_minute: 540, end_minute: 720 }, { start_minute: 720, end_minute: 840 })).toBe(false);
  });

  it('allows two separate blocks with a gap', () => {
    // 09:00-12:00 and 16:00-20:00
    expect(blocksOverlap({ start_minute: 540, end_minute: 720 }, { start_minute: 960, end_minute: 1200 })).toBe(false);
  });
});

describe('findBlockConflict', () => {
  it('returns null when there is no conflict among several blocks', () => {
    const existing = [
      { day_of_week: 1, id: '1', start_minute: 540, end_minute: 720 },
      { day_of_week: 1, id: '2', start_minute: 960, end_minute: 1200 },
    ];
    const candidate = { start_minute: 720, end_minute: 900 }; // touches #1, gap before #2
    expect(findBlockConflict(candidate, existing)).toBeNull();
  });

  it('finds the first conflicting block among several', () => {
    const existing = [
      { day_of_week: 1, id: '1', start_minute: 540, end_minute: 720 },
      { day_of_week: 1, id: '2', start_minute: 780, end_minute: 900 },
    ];
    const candidate = { start_minute: 690, end_minute: 840 }; // overlaps #1 and #2
    expect(findBlockConflict(candidate, existing)?.id).toBe('1');
  });

  it('excludes the block being edited via excludeId', () => {
    const existing = [{ day_of_week: 1, id: 'self', start_minute: 540, end_minute: 720 }];
    const candidate = { start_minute: 600, end_minute: 780 };
    expect(findBlockConflict(candidate, existing, 'self')).toBeNull();
  });
});

describe('deriveBreaks', () => {
  it('returns one break for two blocks with a gap', () => {
    const blocks = [{ start_minute: 630, end_minute: 810 }, { start_minute: 1020, end_minute: 1290 }];
    expect(deriveBreaks(blocks)).toEqual([{ start_minute: 810, end_minute: 1020 }]);
  });

  it('returns no break for two touching blocks', () => {
    const blocks = [{ start_minute: 540, end_minute: 720 }, { start_minute: 720, end_minute: 900 }];
    expect(deriveBreaks(blocks)).toEqual([]);
  });

  it('returns a break between each pair of three blocks', () => {
    const blocks = [
      { start_minute: 540, end_minute: 660 },
      { start_minute: 720, end_minute: 840 },
      { start_minute: 900, end_minute: 1020 },
    ];
    expect(deriveBreaks(blocks)).toEqual([
      { start_minute: 660, end_minute: 720 },
      { start_minute: 840, end_minute: 900 },
    ]);
  });

  it('returns no breaks for a single block', () => {
    expect(deriveBreaks([{ start_minute: 540, end_minute: 720 }])).toEqual([]);
  });

  it('returns no breaks for an empty day', () => {
    expect(deriveBreaks([])).toEqual([]);
  });

  it('sorts internally before computing gaps', () => {
    const blocks = [{ start_minute: 1020, end_minute: 1290 }, { start_minute: 630, end_minute: 810 }];
    expect(deriveBreaks(blocks)).toEqual([{ start_minute: 810, end_minute: 1020 }]);
  });
});

describe('fitsInAnyBlock', () => {
  const blocks = [{ start_minute: 630, end_minute: 810 }, { start_minute: 1020, end_minute: 1290 }]; // 10:30-13:30, 17:00-21:30

  it('accepts a candidate fully inside one block', () => {
    expect(fitsInAnyBlock(660, 780, blocks)).toBe(true); // 11:00-13:00
  });

  it('rejects a candidate spanning the gap between two blocks', () => {
    expect(fitsInAnyBlock(750, 1050, blocks)).toBe(false); // 12:30-17:30, crosses the break
  });

  it('accepts a candidate exactly matching a block boundary', () => {
    expect(fitsInAnyBlock(630, 810, blocks)).toBe(true);
  });

  it('rejects everything when there are no blocks', () => {
    expect(fitsInAnyBlock(600, 700, [])).toBe(false);
  });
});

describe('summarizeDay', () => {
  it('summarizes a single block with no break', () => {
    expect(summarizeDay([{ start_minute: 540, end_minute: 720 }])).toEqual({ shiftCount: 1, totalMinutes: 180, breakMinutes: 0 });
  });

  it('summarizes two blocks with a gap', () => {
    const blocks = [{ start_minute: 630, end_minute: 810 }, { start_minute: 1020, end_minute: 1290 }];
    expect(summarizeDay(blocks)).toEqual({ shiftCount: 2, totalMinutes: 180 + 270, breakMinutes: 210 });
  });

  it('returns zeros for an empty day', () => {
    expect(summarizeDay([])).toEqual({ shiftCount: 0, totalMinutes: 0, breakMinutes: 0 });
  });
});

describe('snapToStep', () => {
  it('rounds down toward the nearest 15-minute step', () => {
    expect(snapToStep(547)).toBe(540);
  });

  it('rounds up toward the nearest 15-minute step', () => {
    expect(snapToStep(553)).toBe(555);
  });

  it('clamps below 0', () => {
    expect(snapToStep(-100)).toBe(0);
  });

  it('clamps above 1440', () => {
    expect(snapToStep(2000)).toBe(DAY_END_MINUTE);
  });
});

describe('defaultNewBlock', () => {
  it('defaults to 09:00-13:00 for an empty day', () => {
    expect(defaultNewBlock([])).toEqual({ start_minute: 9 * 60, end_minute: 13 * 60 });
  });

  it('starts right after the last existing block ends', () => {
    const existing = [{ start_minute: 540, end_minute: 720 }]; // 09:00-12:00
    expect(defaultNewBlock(existing)).toEqual({ start_minute: 720, end_minute: 720 + 4 * 60 });
  });

  it('clamps end_minute to 1440 when the default span would overflow', () => {
    const existing = [{ start_minute: 540, end_minute: 1320 }]; // ends 22:00
    expect(defaultNewBlock(existing)).toEqual({ start_minute: 1320, end_minute: DAY_END_MINUTE });
  });

  it('clamps start to 23:45 when the previous block ends past that', () => {
    const existing = [{ start_minute: 540, end_minute: 1430 }]; // ends 23:50
    const result = defaultNewBlock(existing);
    expect(result.start_minute).toBe(LAST_VALID_START_MINUTE);
    expect(result.end_minute).toBe(DAY_END_MINUTE);
  });
});

describe('nudgeBlockStart', () => {
  it('leaves the candidate unchanged when there is no conflict', () => {
    const candidate = { start_minute: 540, end_minute: 720 };
    expect(nudgeBlockStart(candidate, [{ start_minute: 900, end_minute: 1000 }])).toEqual(candidate);
  });

  it('nudges start to the conflicting block end, preserving duration', () => {
    const candidate = { start_minute: 600, end_minute: 780 }; // 3h duration
    const others = [{ start_minute: 540, end_minute: 660 }]; // 09:00-11:00
    expect(nudgeBlockStart(candidate, others)).toEqual({ start_minute: 660, end_minute: 660 + 180 });
  });

  it('clamps end to 1440 when the nudge would overflow the day', () => {
    const candidate = { start_minute: 1300, end_minute: 1400 }; // 100min duration
    const others = [{ start_minute: 1250, end_minute: 1350 }];
    expect(nudgeBlockStart(candidate, others)).toEqual({ start_minute: 1350, end_minute: DAY_END_MINUTE });
  });
});

describe('resolveOverlapsForDay', () => {
  it('resolves a candidate conflicting with two sequential blocks in a row', () => {
    const candidate = { start_minute: 540, end_minute: 660 }; // 09:00-11:00
    const others = [
      { start_minute: 600, end_minute: 720 }, // 10:00-12:00
      { start_minute: 720, end_minute: 840 }, // 12:00-14:00
    ];
    expect(resolveOverlapsForDay(candidate, others)).toEqual({ start_minute: 840, end_minute: 960 });
  });

  it('terminates with a degenerate result when the day is fully packed', () => {
    const candidate = { start_minute: 0, end_minute: 60 };
    const others = [{ start_minute: 0, end_minute: DAY_END_MINUTE }];
    const result = resolveOverlapsForDay(candidate, others);
    expect(result.end_minute).toBeLessThanOrEqual(result.start_minute);
  });
});

describe('isValidBlock', () => {
  it('accepts a valid 15-minute-aligned block', () => {
    expect(isValidBlock({ start_minute: 630, end_minute: 810 })).toBe(true);
  });

  it('rejects a non-15-minute-aligned start', () => {
    expect(isValidBlock({ start_minute: 631, end_minute: 810 })).toBe(false);
  });

  it('rejects end <= start', () => {
    expect(isValidBlock({ start_minute: 720, end_minute: 720 })).toBe(false);
  });

  it('rejects end past 1440', () => {
    expect(isValidBlock({ start_minute: 1425, end_minute: 1500 })).toBe(false);
  });
});

describe('groupBlocksByDay / flattenBlocksByDay', () => {
  it('groups a flat list into all 7 days, empty for days with no rows', () => {
    const rows = [
      { day_of_week: 1, start_minute: 540, end_minute: 720 },
      { day_of_week: 1, start_minute: 780, end_minute: 900 },
      { day_of_week: 3, start_minute: 540, end_minute: 1080 },
    ];
    const grouped = groupBlocksByDay(rows);
    expect(Object.keys(grouped).map(Number).sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(grouped[1]).toHaveLength(2);
    expect(grouped[2]).toEqual([]);
    expect(grouped[3]).toHaveLength(1);
  });

  it('round-trips group -> flatten back to the same blocks', () => {
    const rows = [
      { day_of_week: 1, start_minute: 540, end_minute: 720 },
      { day_of_week: 3, start_minute: 540, end_minute: 1080 },
    ];
    const grouped = groupBlocksByDay(rows);
    const flat = flattenBlocksByDay(grouped);
    const toSet = (arr: typeof flat) => new Set(arr.map(r => `${r.day_of_week}:${r.start_minute}:${r.end_minute}`));
    expect(toSet(flat)).toEqual(new Set(rows.map(r => `${r.day_of_week}:${r.start_minute}:${r.end_minute}`)));
    expect(flat.every(r => r.is_working === true)).toBe(true);
  });

  it('groupBlocksByDay on an empty input returns all 7 empty keys', () => {
    const grouped = groupBlocksByDay([]);
    expect(Object.values(grouped).every(v => v.length === 0)).toBe(true);
  });
});
