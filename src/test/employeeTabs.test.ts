import { describe, it, expect } from 'vitest';
import { EMPLOYEE_TABS, filterVisibleTabs, isTabVisible, resolveActiveTab, EmployeeTab } from '@/lib/employeeTabs';

describe('isTabVisible', () => {
  it('always shows tabs to admins regardless of the visible-tabs list', () => {
    expect(isTabVisible('stats', true, [])).toBe(true);
  });

  it('shows a tab to an employee only if it is in employeeVisibleTabs', () => {
    expect(isTabVisible('stats', false, ['bookings'])).toBe(false);
    expect(isTabVisible('stats', false, ['stats', 'bookings'])).toBe(true);
  });
});

describe('filterVisibleTabs', () => {
  const tabs = [
    { value: 'stats', label: 'Stats' },
    { value: 'bookings', label: 'Bookings' },
    { value: 'settings', label: 'Settings' },
  ];

  it('returns every tab for admins', () => {
    expect(filterVisibleTabs(tabs, true, [])).toEqual(tabs);
  });

  it('filters out tabs hidden from an employee', () => {
    const result = filterVisibleTabs(tabs, false, ['bookings']);
    expect(result.map(t => t.value)).toEqual(['bookings']);
  });

  it('keeps entries in alwaysVisible even if not in employeeVisibleTabs', () => {
    const result = filterVisibleTabs(tabs, false, ['bookings'], ['settings']);
    expect(result.map(t => t.value)).toEqual(['bookings', 'settings']);
  });

  it('matches the desktop sidebar and mobile bottom nav for the same employee settings', () => {
    const employeeVisibleTabs: EmployeeTab[] = ['bookings', 'customers'];
    const sidebarItems = [{ value: 'stats' }, { value: 'bookings' }, { value: 'customers' }, { value: 'services' }];
    const mobilePrimaryTabs = [{ value: 'stats' }, { value: 'bookings' }, { value: 'customers' }, { value: 'services' }];

    const sidebarResult = filterVisibleTabs(sidebarItems, false, employeeVisibleTabs).map(t => t.value);
    const mobileResult = filterVisibleTabs(mobilePrimaryTabs, false, employeeVisibleTabs).map(t => t.value);

    expect(sidebarResult).toEqual(mobileResult);
    expect(sidebarResult).toEqual(['bookings', 'customers']);
  });
});

describe('resolveActiveTab', () => {
  it('never redirects admins', () => {
    expect(resolveActiveTab('stats', true, [])).toBe('stats');
  });

  it('leaves the active tab alone when the employee can see it', () => {
    expect(resolveActiveTab('bookings', false, ['bookings', 'stats'])).toBe('bookings');
  });

  it('redirects an employee away from a hidden gated tab to their first visible tab', () => {
    expect(resolveActiveTab('stats', false, ['bookings', 'customers'])).toBe('bookings');
  });

  it('falls back to "bookings" when the employee has no visible tabs at all', () => {
    expect(resolveActiveTab('stats', false, [])).toBe('bookings');
  });

  it('does not touch tabs outside the gated EMPLOYEE_TABS set (e.g. settings, pricing)', () => {
    expect(resolveActiveTab('settings', false, ['bookings'])).toBe('settings');
    expect(resolveActiveTab('pricing', false, [])).toBe('pricing');
  });

  it('EMPLOYEE_TABS includes stats so the home dashboard is gated like any other tab', () => {
    expect(EMPLOYEE_TABS).toContain('stats');
  });
});
