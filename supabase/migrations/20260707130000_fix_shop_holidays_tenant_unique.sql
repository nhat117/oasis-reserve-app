-- shop_holidays still had a global UNIQUE(holiday_date) from before
-- multi-tenancy was added, so two different tenants could never both
-- have a holiday on the same calendar date. Replace it with a
-- per-tenant unique constraint, matching the app_settings pattern.
ALTER TABLE public.shop_holidays DROP CONSTRAINT IF EXISTS shop_holidays_holiday_date_key;
ALTER TABLE public.shop_holidays ADD CONSTRAINT shop_holidays_tenant_date_key UNIQUE (tenant_id, holiday_date);
