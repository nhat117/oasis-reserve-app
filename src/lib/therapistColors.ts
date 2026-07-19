// Shared accent palette so a staff member's color stays consistent across the
// schedule grid, the days-off calendar, and any other view that colors by therapist.
export const THERAPIST_COLORS = [
  '#3b82f6', '#f43f5e', '#10b981', '#f59e0b',
  '#8b5cf6', '#06b6d4', '#ec4899', '#f97316',
];

export const therapistColorFor = (therapistId: string, therapists: { id: string }[]) =>
  THERAPIST_COLORS[Math.max(0, therapists.findIndex(th => th.id === therapistId)) % THERAPIST_COLORS.length];
