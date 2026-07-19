-- One-time data fix: existing tenants' open_days settings were saved as
-- [1,2,3,4,5,6] because the app's fallback default (before this fix)
-- excluded Sunday (day 7), causing Sunday to be hidden from both the
-- customer booking calendar and the admin appointments calendar. Add
-- Sunday to any tenant whose saved value is missing it, without touching
-- tenants that have already deliberately excluded Sunday for a different
-- reason (e.g. a shop that's genuinely closed Sundays) beyond this exact
-- known-buggy default.
UPDATE public.app_settings
SET value = '[1,2,3,4,5,6,7]'
WHERE key = 'open_days' AND value = '[1,2,3,4,5,6]';
