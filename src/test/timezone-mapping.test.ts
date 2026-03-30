import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure logic extracted from AdminDashboard.tsx — state → timezone mapping
// ---------------------------------------------------------------------------

const STATE_TIMEZONE_MAP: Record<string, string> = {
  NSW: 'Australia/Sydney',
  VIC: 'Australia/Melbourne',
  QLD: 'Australia/Brisbane',
  SA: 'Australia/Adelaide',
  WA: 'Australia/Perth',
  TAS: 'Australia/Hobart',
  NT: 'Australia/Darwin',
  ACT: 'Australia/Sydney',
};

function getTimezoneForState(state: string): string {
  return STATE_TIMEZONE_MAP[state] || 'Australia/Melbourne';
}

describe('State → Timezone mapping', () => {
  it.each([
    ['NSW', 'Australia/Sydney'],
    ['VIC', 'Australia/Melbourne'],
    ['QLD', 'Australia/Brisbane'],
    ['SA', 'Australia/Adelaide'],
    ['WA', 'Australia/Perth'],
    ['TAS', 'Australia/Hobart'],
    ['NT', 'Australia/Darwin'],
    ['ACT', 'Australia/Sydney'],
  ])('maps %s to %s', (state, expected) => {
    expect(getTimezoneForState(state)).toBe(expected);
  });

  it('falls back to Australia/Melbourne for unknown state', () => {
    expect(getTimezoneForState('XX')).toBe('Australia/Melbourne');
  });

  it('falls back for empty string', () => {
    expect(getTimezoneForState('')).toBe('Australia/Melbourne');
  });

  it('covers all 8 Australian states/territories', () => {
    expect(Object.keys(STATE_TIMEZONE_MAP)).toHaveLength(8);
  });

  it('all mapped timezones are valid IANA identifiers', () => {
    for (const tz of Object.values(STATE_TIMEZONE_MAP)) {
      // Intl.DateTimeFormat will throw for invalid timezone
      expect(() => new Intl.DateTimeFormat('en', { timeZone: tz })).not.toThrow();
    }
  });

  it('ACT and NSW share the same timezone', () => {
    expect(getTimezoneForState('ACT')).toBe(getTimezoneForState('NSW'));
  });
});
