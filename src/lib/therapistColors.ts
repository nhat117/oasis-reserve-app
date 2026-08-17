// Single source of truth for "what colour is this staff member?".
//
// A staff member's colour lives on therapists.color (see
// 20260817000000_add_therapists_color.sql) so it is stable no matter which
// view resolves it, which subset of staff that view loaded, or how the list is
// ordered. Colour used to be derived from a row's *index* in whatever array a
// view happened to hold, which meant the same person showed up in different
// colours on the bookings calendar (indexed by order of appearance in the
// loaded bookings) and the shift calendar (indexed by display_order), and
// everyone shifted colour whenever a staff member was hidden or reordered.
//
// Every colour-by-staff surface must go through therapistColor() /
// buildTherapistColorMap() below — do not index into THERAPIST_COLORS directly.

// All entries are dark enough for white text to stay readable on top of them,
// since that is how FullCalendar events are rendered.
export const THERAPIST_COLORS = [
  '#2563eb', '#e11d48', '#059669', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#ea580c',
  '#4f46e5', '#0d9488', '#65a30d', '#9333ea',
];

// Staff with no colour on file and no id to hash (e.g. a booking whose staff
// row was hard-deleted) render neutral grey rather than borrowing someone
// else's colour.
export const UNKNOWN_THERAPIST_COLOR = '#6b7280';

export interface TherapistColorSource {
  id: string;
  color?: string | null;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const isTherapistColor = (value: unknown): value is string =>
  typeof value === 'string' && HEX_COLOR.test(value.trim());

export const normalizeTherapistColor = (value: unknown): string | null =>
  isTherapistColor(value) ? value.trim().toLowerCase() : null;

// FNV-1a over the staff id. Only a fallback for rows created before/around the
// colour migration: unlike an array index it depends on nothing but the id, so
// it never changes as staff are added, hidden, or reordered.
const paletteIndexForId = (id: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % THERAPIST_COLORS.length;
};

export const fallbackTherapistColor = (id: string | null | undefined) =>
  id ? THERAPIST_COLORS[paletteIndexForId(id)] : UNKNOWN_THERAPIST_COLOR;

/** Colour for one staff record — their assigned colour, else a stable per-id fallback. */
export const therapistColor = (therapist: TherapistColorSource | null | undefined) => {
  if (!therapist) return UNKNOWN_THERAPIST_COLOR;
  return normalizeTherapistColor(therapist.color) ?? fallbackTherapistColor(therapist.id);
};

/** Colour for a staff id, resolved against a staff list that may not contain them. */
export const therapistColorFor = (
  therapistId: string | null | undefined,
  therapists: TherapistColorSource[] = [],
) => {
  if (!therapistId) return UNKNOWN_THERAPIST_COLOR;
  const match = therapists.find(th => th?.id === therapistId);
  // Missing from the list (hidden, soft-deleted, or filtered out) still gets
  // that person's own colour — never index 0, which used to collide with
  // whoever happened to be first.
  return match ? therapistColor(match) : fallbackTherapistColor(therapistId);
};

/** id -> colour for a staff list, for views that resolve many ids per render. */
export const buildTherapistColorMap = (therapists: TherapistColorSource[] = []) => {
  const map: Record<string, string> = {};
  for (const th of therapists) {
    if (th?.id) map[th.id] = therapistColor(th);
  }
  return map;
};

/**
 * Colour to offer a newly created staff member: the palette entry used by the
 * fewest existing staff, so a small team gets all-distinct colours instead of
 * whatever the hash fallback happens to land on.
 */
export const nextAvailableTherapistColor = (therapists: TherapistColorSource[] = []) => {
  const used = new Map<string, number>(THERAPIST_COLORS.map(c => [c, 0]));
  for (const th of therapists) {
    const color = therapistColor(th);
    if (used.has(color)) used.set(color, (used.get(color) ?? 0) + 1);
  }
  let best = THERAPIST_COLORS[0];
  let bestCount = Infinity;
  for (const color of THERAPIST_COLORS) {
    const count = used.get(color) ?? 0;
    if (count < bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
};
