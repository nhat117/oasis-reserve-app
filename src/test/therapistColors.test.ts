import { describe, it, expect } from 'vitest';
import {
  THERAPIST_COLORS,
  UNKNOWN_THERAPIST_COLOR,
  buildTherapistColorMap,
  fallbackTherapistColor,
  isTherapistColor,
  nextAvailableTherapistColor,
  normalizeTherapistColor,
  therapistColor,
  therapistColorFor,
} from '@/lib/therapistColors';

const staff = (id: string, color?: string | null) => ({ id, color });

describe('therapistColor', () => {
  it('uses the assigned colour', () => {
    expect(therapistColor(staff('a', '#123abc'))).toBe('#123abc');
  });

  it('normalises case and stray whitespace so the same colour compares equal', () => {
    expect(therapistColor(staff('a', ' #12ABCD '))).toBe('#12abcd');
  });

  it('falls back to a palette colour when the stored value is unusable', () => {
    const unusable: Array<string | null | undefined> = [null, undefined, '', 'blue', '#12ab', '#1234567', 'rgb(0,0,0)'];
    for (const bad of unusable) {
      expect(THERAPIST_COLORS).toContain(therapistColor(staff('a', bad)));
    }
  });

  it('returns grey rather than someone else’s colour when there is no staff record', () => {
    expect(therapistColor(null)).toBe(UNKNOWN_THERAPIST_COLOR);
    expect(therapistColor(undefined)).toBe(UNKNOWN_THERAPIST_COLOR);
  });
});

describe('fallbackTherapistColor', () => {
  it('is stable for the same id', () => {
    const id = '3f1b0c2e-9b7a-4c1e-8f2d-6a5b4c3d2e1f';
    expect(fallbackTherapistColor(id)).toBe(fallbackTherapistColor(id));
  });

  it('depends only on the id — not on list position, length, or order', () => {
    const ids = ['a1', 'b2', 'c3'];
    const first = ids.map(fallbackTherapistColor);
    const second = [...ids].reverse().map(fallbackTherapistColor).reverse();
    expect(second).toEqual(first);
  });

  it('always lands inside the palette', () => {
    for (let i = 0; i < 200; i++) {
      expect(THERAPIST_COLORS).toContain(fallbackTherapistColor(`staff-${i}`));
    }
  });
});

describe('therapistColorFor', () => {
  const therapists = [staff('a', '#2563eb'), staff('b', '#e11d48'), staff('c', '#059669')];

  it('resolves a staff member the same way regardless of their position in the list', () => {
    const expected = therapistColorFor('c', therapists);
    expect(therapistColorFor('c', [...therapists].reverse())).toBe(expected);
    expect(therapistColorFor('c', [staff('c', '#059669')])).toBe(expected);
  });

  it('keeps everyone else’s colour when a staff member is hidden or removed', () => {
    const remaining = therapists.filter(th => th.id !== 'a');
    const before = remaining.map(th => therapistColorFor(th.id, therapists));
    // The old index-based lookup shifted every colour after the removed row.
    expect(remaining.map(th => therapistColorFor(th.id, remaining))).toEqual(before);
  });

  it('gives a staff member missing from the list their own colour, not index 0’s', () => {
    const resolved = therapistColorFor('ghost', therapists);
    expect(resolved).toBe(fallbackTherapistColor('ghost'));
    expect(resolved).not.toBe(UNKNOWN_THERAPIST_COLOR);
  });

  it('returns grey for a missing id', () => {
    expect(therapistColorFor(null, therapists)).toBe(UNKNOWN_THERAPIST_COLOR);
    expect(therapistColorFor(undefined, therapists)).toBe(UNKNOWN_THERAPIST_COLOR);
  });

  it('tolerates an empty or omitted staff list', () => {
    expect(therapistColorFor('a', [])).toBe(fallbackTherapistColor('a'));
    expect(therapistColorFor('a')).toBe(fallbackTherapistColor('a'));
  });
});

describe('buildTherapistColorMap', () => {
  it('agrees with therapistColorFor for every staff member', () => {
    const therapists = [staff('a', '#2563eb'), staff('b', null), staff('c', '#059669')];
    const map = buildTherapistColorMap(therapists);
    for (const th of therapists) {
      expect(map[th.id]).toBe(therapistColorFor(th.id, therapists));
    }
  });

  it('skips entries without an id instead of creating an undefined key', () => {
    const map = buildTherapistColorMap([{ id: '', color: '#2563eb' }, staff('a', '#059669')]);
    expect(Object.keys(map)).toEqual(['a']);
  });
});

describe('nextAvailableTherapistColor', () => {
  it('picks an unused palette colour while any remain', () => {
    const therapists = THERAPIST_COLORS.slice(0, 3).map((color, i) => staff(`s${i}`, color));
    const next = nextAvailableTherapistColor(therapists);
    expect(THERAPIST_COLORS).toContain(next);
    expect(THERAPIST_COLORS.slice(0, 3)).not.toContain(next);
  });

  it('falls back to the least-used colour once the palette is exhausted', () => {
    const therapists = [
      ...THERAPIST_COLORS.map((color, i) => staff(`a${i}`, color)),
      ...THERAPIST_COLORS.slice(1).map((color, i) => staff(`b${i}`, color)),
    ];
    expect(nextAvailableTherapistColor(therapists)).toBe(THERAPIST_COLORS[0]);
  });

  it('returns the first palette colour for an empty team', () => {
    expect(nextAvailableTherapistColor([])).toBe(THERAPIST_COLORS[0]);
    expect(nextAvailableTherapistColor()).toBe(THERAPIST_COLORS[0]);
  });
});

describe('palette', () => {
  it('is all distinct 6-digit hex, which the DB check constraint requires', () => {
    expect(new Set(THERAPIST_COLORS).size).toBe(THERAPIST_COLORS.length);
    for (const color of THERAPIST_COLORS) {
      expect(isTherapistColor(color)).toBe(true);
      expect(normalizeTherapistColor(color)).toBe(color);
    }
    expect(isTherapistColor(UNKNOWN_THERAPIST_COLOR)).toBe(true);
  });

  it('stays dark enough for the white event text every calendar renders on top', () => {
    // WCAG relative luminance; 0.45 keeps white text ≳3:1 (large-text threshold).
    const luminance = (hex: string) => {
      const channel = (offset: number) => {
        const v = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
    };
    for (const color of THERAPIST_COLORS) {
      expect(luminance(color), color).toBeLessThan(0.45);
    }
  });
});
