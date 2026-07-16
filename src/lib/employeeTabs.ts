export const EMPLOYEE_TABS = [
  'stats',
  'bookings',
  'customers',
  'sales',
  'payment_history',
  'services',
  'products',
  'therapists',
  'inbox',
] as const;

export type EmployeeTab = typeof EMPLOYEE_TABS[number];

export function isTabVisible(value: string, isAdmin: boolean, employeeVisibleTabs: EmployeeTab[]): boolean {
  return isAdmin || employeeVisibleTabs.includes(value as EmployeeTab);
}

export function filterVisibleTabs<T extends { value: string }>(
  tabs: T[],
  isAdmin: boolean,
  employeeVisibleTabs: EmployeeTab[],
  alwaysVisible: string[] = [],
): T[] {
  return tabs.filter(tab => alwaysVisible.includes(tab.value) || isTabVisible(tab.value, isAdmin, employeeVisibleTabs));
}

export function resolveActiveTab(
  activeTab: string,
  isAdmin: boolean,
  employeeVisibleTabs: EmployeeTab[],
  fallback: string = 'bookings',
): string {
  if (isAdmin) return activeTab;
  const isGatedTab = (EMPLOYEE_TABS as readonly string[]).includes(activeTab);
  if (isGatedTab && !employeeVisibleTabs.includes(activeTab as EmployeeTab)) {
    return employeeVisibleTabs[0] ?? fallback;
  }
  return activeTab;
}
