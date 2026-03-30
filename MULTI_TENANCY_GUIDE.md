# Multi-Tenancy Guide

This app supports multiple nail salons sharing the same Supabase backend.
Each salon is a **tenant** with fully isolated data.

## Architecture

```
Frontend A (royal-head-spa)   ──┐
Frontend B (glamour-nails)    ──┤──▶  One Supabase Project
Frontend C (zen-nails)        ──┘       ├─ tenants table
                                         ├─ bookings (tenant_id scoped)
                                         ├─ services (tenant_id scoped)
                                         ├─ ... all tables scoped
                                         └─ RLS enforces isolation
```

- Each frontend deployment has `VITE_TENANT_ID=<uuid>` in its `.env`
- The Supabase client sends `x-tenant-id` header with every request
- RLS policies filter all data by tenant
- Cron jobs (reminders) loop over all active tenants automatically

## Initial Setup (Your Existing Salon)

### Step 1: Run the migration

In **Supabase Dashboard > SQL Editor**, run:
```
supabase/migrations/20260330210000_add_multi_tenancy.sql
```

This adds the `tenants` table and `tenant_id` column to all tables.

### Step 2: Backfill your existing data

In **Supabase Dashboard > SQL Editor**, run:
```
scripts/backfill-default-tenant.sql
```

Edit the salon name, slug, and owner email in the script first.
It will output your `VITE_TENANT_ID` — copy it.

### Step 3: Add tenant ID to your frontend

In your `.env` file, add:
```
VITE_TENANT_ID=<the-uuid-from-step-2>
```

### Step 4: Deploy updated edge functions

```bash
npx supabase functions deploy send-booking-reminders --project-ref <your-ref>
npx supabase functions deploy send-sms-reminder --project-ref <your-ref>
npx supabase functions deploy send-email-resend --project-ref <your-ref>
npx supabase functions deploy create-admin --project-ref <your-ref>
```

## Adding a New Salon

### Option A: Interactive script

```bash
npx tsx scripts/setup-tenant.ts
```

Prompts for:
- Salon name (e.g., "Glamour Nails")
- Slug (e.g., "glamour-nails")
- Owner email
- First admin email + password

Outputs the `VITE_TENANT_ID` to add to the new frontend's `.env`.

### Option B: SQL (manual)

```sql
-- 1. Create tenant
INSERT INTO tenants (slug, name, owner_email)
VALUES ('glamour-nails', 'Glamour Nails', 'owner@glamour.com')
RETURNING id;

-- 2. Create admin user (via Supabase Auth or create-admin edge function)

-- 3. Link admin to tenant
INSERT INTO user_roles (user_id, role, tenant_id)
VALUES ('<user-uuid>', 'admin', '<tenant-uuid>');

-- 4. Seed default settings
INSERT INTO app_settings (key, value, tenant_id) VALUES
  ('spa_name', 'Glamour Nails', '<tenant-uuid>'),
  ('shop_state', 'VIC', '<tenant-uuid>'),
  ('shop_timezone', 'Australia/Melbourne', '<tenant-uuid>'),
  ('open_days', '1,2,3,4,5,6', '<tenant-uuid>');
```

### Option C: Deploy a new frontend

```bash
# Clone or fork the repo
git clone <repo-url> glamour-nails-app
cd glamour-nails-app

# Set env vars
cp .env.example .env
# Edit .env:
#   VITE_TENANT_ID=<uuid-from-setup>
#   VITE_SUPABASE_URL=https://afibwdjbpnuxwpshsdyg.supabase.co
#   VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>

# Deploy (e.g., to Vercel, Netlify, etc.)
npm run build && npm run deploy
```

## How Isolation Works

| Layer | Mechanism |
|-------|-----------|
| **Frontend** | `VITE_TENANT_ID` env var, sent as `x-tenant-id` header |
| **Database** | `tenant_id` column on every table |
| **RLS (anon)** | Reads `x-tenant-id` from request header via `request_tenant_id()` |
| **RLS (auth)** | Looks up tenant from `user_roles` via `get_my_tenant_id()` |
| **Edge functions** | Cron jobs loop over all tenants; user-triggered functions use caller's tenant |
| **Settings** | Each tenant has its own `app_settings` rows (Resend key, Twilio, etc.) |

## Per-Tenant Configuration

Each salon configures these independently via the Admin Dashboard:

- Salon name, state, timezone
- Services, therapists, business hours
- Resend API key (email)
- Twilio credentials (SMS/WhatsApp)
- Stripe keys (payments)
- Reminder intervals
- Membership tiers, discount codes

## FAQ

**Q: Can one person admin multiple salons?**
A: Not yet with one login. Each admin account is linked to one tenant. Use separate accounts per salon.

**Q: What if I don't set VITE_TENANT_ID?**
A: The app works in "legacy mode" — no tenant filtering. Set it to enable multi-tenancy.

**Q: How do cron jobs know which tenants to process?**
A: The `send-booking-reminders` and `send-sms-reminder` functions query all active tenants and process each one with its own settings.
