# Deployment Guide

End-to-end guide for deploying Oasis Reserve — one Supabase backend serving multiple salon frontends on Vercel.

> **Architecture recap**: one shared Supabase project (DB + Auth + Storage + 29 Edge Functions) + one Vercel project per salon (each with its own `VITE_TENANT_ID`). RLS isolates data by tenant.

---

## 0. Prerequisites

| Tool | Install | Why |
|---|---|---|
| Node 20+ | [nodejs.org](https://nodejs.org) | Build & test |
| Supabase CLI | `brew install supabase/tap/supabase` | DB + functions deploy |
| Vercel CLI | `npm i -g vercel@latest` | Frontend deploy |
| `psql` (optional) | `brew install postgresql` | Manual SQL if needed |

Accounts needed: Supabase, Vercel, Stripe, Square, Resend, Twilio or Sinch (based on what you enable).

---

## 1. Supabase backend (one-time, shared across all tenants)

### 1.1 Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Copy the **Project ref** (e.g. `afibwdjbpnuxwpshsdyg`), **URL**, and **anon key**.
3. From **Settings → API**, also grab the **service_role key** (keep secret — server-side only).

### 1.2 Link and push schema

```bash
supabase login
supabase link --project-ref <your-ref>

# Apply all 42 migrations
supabase db push

# Verify local == remote
supabase migration list
```

### 1.3 Deploy edge functions

```bash
# All 29 at once
supabase functions deploy

# Or one at a time
supabase functions deploy ai-chat-respond
```

### 1.4 Set function secrets

These are shared across tenants (per-tenant keys live in `app_settings`):

```bash
supabase secrets set \
  OPENAI_API_KEY=sk-... \
  RESEND_API_KEY=re_... \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  SQUARE_ACCESS_TOKEN=EAAA... \
  SQUARE_WEBHOOK_SIGNATURE_KEY=... \
  SINCH_APP_ID=... \
  SINCH_APP_SECRET=... \
  TWILIO_ACCOUNT_SID=AC... \
  TWILIO_AUTH_TOKEN=... \
  ADMIN_UPGRADE_KEY=<random-hex>
```

List with `supabase secrets list`.

### 1.5 Enable cron (reminders + queue worker)

Cron uses `pg_cron` + `pg_net` and is set up by `20260329120000_add_reminder_cron_jobs.sql`. After the migration, set the service-role key it uses:

```sql
-- in Supabase SQL editor
SELECT vault.create_secret('<your-service-role-key>', 'service_role_key');
```

Running jobs:
- `send-booking-reminders` — every 15 min
- `send-sms-reminder` — every 15 min
- `process-email-queue` — every minute

Verify: `SELECT * FROM cron.job;`

### 1.6 Storage buckets

Created by migrations. Expected buckets:
- `logos` (public read, admin write)
- `hero-media` (public read, admin write)
- `service-images` (public read, admin write)

Verify in **Dashboard → Storage**.

---

## 2. Bootstrap the first tenant

```bash
npx tsx scripts/setup-tenant.ts
```

Prompts for salon name, slug, owner email, first admin email + password. It prints a `VITE_TENANT_ID` — copy it for step 3.

Or do it manually:

```sql
-- 1. tenant
INSERT INTO tenants (slug, name, owner_email)
VALUES ('my-salon', 'My Salon', 'owner@example.com')
RETURNING id;  -- copy this UUID

-- 2. create admin via edge function
-- POST /functions/v1/create-admin { email, password, role: 'admin' }

-- 3. link admin to tenant
INSERT INTO user_roles (user_id, role, tenant_id)
VALUES ('<user-uuid-from-step-2>', 'admin', '<tenant-uuid>');

-- 4. seed settings
INSERT INTO app_settings (key, value, tenant_id) VALUES
  ('spa_name', 'My Salon', '<tenant-uuid>'),
  ('shop_state', 'VIC', '<tenant-uuid>'),
  ('shop_timezone', 'Australia/Melbourne', '<tenant-uuid>'),
  ('open_days', '1,2,3,4,5,6', '<tenant-uuid>');
```

---

## 3. Deploy the frontend (Vercel)

### 3.1 First time — link the project

```bash
vercel login
vercel link      # creates .vercel/project.json
```

### 3.2 Set env vars

Per environment (Production / Preview / Development):

```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
vercel env add VITE_SUPABASE_PROJECT_ID production
vercel env add VITE_TENANT_ID production     # ← unique per salon
```

Or paste them in the Vercel dashboard under **Project → Settings → Environment Variables**.

### 3.3 Deploy

```bash
vercel              # preview deploy
vercel --prod       # production
```

Vercel reads `vercel.json` for security headers and SPA rewrites (already configured).

### 3.4 Domain

**Project → Settings → Domains** → add e.g. `book.my-salon.com`. Point DNS `CNAME` → `cname.vercel-dns.com`.

---

## 4. Deploying additional salons

Each salon = one new Vercel project sharing the same Supabase backend.

```bash
# 1. Create the tenant in the shared DB
npx tsx scripts/setup-tenant.ts
# → copy the VITE_TENANT_ID it prints

# 2. Clone the repo (or use the same repo with a different Vercel project)
git clone <repo-url> glamour-nails-app
cd glamour-nails-app

# 3. Link a new Vercel project
vercel link    # pick "new project"

# 4. Set env vars — same Supabase, different tenant
vercel env add VITE_SUPABASE_URL production         # same
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production  # same
vercel env add VITE_TENANT_ID production             # NEW, unique

# 5. Deploy
vercel --prod
```

Each salon's admin logs into `/admin/login` with their own credentials and configures their own branding, services, pricing, Resend/Twilio keys, etc. via the Admin Dashboard.

---

## 5. Third-party webhooks

After deploy, point these at the Supabase Edge Function URLs (`https://<ref>.supabase.co/functions/v1/<name>`):

| Provider | Webhook URL | Function |
|---|---|---|
| Stripe | `.../stripe-webhook` | payment status |
| Square | `.../square-webhook` | terminal + online payment status |
| Sinch Conversation API | `.../sinch-webhook` | inbound messages |
| Fresha (optional) | `.../fresha-webhook` | external bookings sync |
| Resend | `.../handle-email-suppression` (and bounce) | suppression list |

Configure signing secrets as Supabase secrets (step 1.4).

---

## 6. Post-deploy smoke tests

```bash
# 1. Frontend up
curl -I https://book.my-salon.com

# 2. Tenant header reaching DB
curl "https://<ref>.supabase.co/rest/v1/services?select=id,name&is_active=eq.true" \
  -H "apikey: <anon-key>" \
  -H "x-tenant-id: <tenant-uuid>"   # → should return rows

curl "https://<ref>.supabase.co/rest/v1/services?select=id&is_active=eq.true" \
  -H "apikey: <anon-key>"            # → should return []  (RLS fail-closed)

# 3. Cron jobs running
# Dashboard → Database → cron → jobrun_details should show recent successful runs

# 4. Edge function reachable
curl -X POST "https://<ref>.supabase.co/functions/v1/preview-transactional-email" \
  -H "apikey: <anon-key>" -H "Content-Type: application/json" \
  -d '{"template":"booking_confirmation"}'
```

---

## 7. CI/CD

Vercel auto-deploys on `git push`:
- **Production**: pushes to `main` → `vercel --prod`
- **Preview**: PRs and other branches → preview URL

To block deploys until tests pass, add a `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

Supabase changes are deploy-on-demand (`supabase db push`, `supabase functions deploy`) — commit migrations to git and deploy them manually from a maintainer machine, or add a GitHub Action with the Supabase access token.

---

## 8. Rollback

**Frontend**: Vercel dashboard → **Deployments** → promote a previous build to production (one click).

**Edge functions**: redeploy an older commit
```bash
git checkout <prev-sha>
supabase functions deploy <name>
git checkout main
```

**Database**: migrations are forward-only by convention. For a bad migration, write a new one that reverses the change. Never edit a migration that's already on the remote — add a new one.

---

## 9. Troubleshooting

| Symptom | Check |
|---|---|
| Frontend shows empty services | `VITE_TENANT_ID` set? matches a real tenant? RLS blocking anon? |
| Admin sees no data | `user_roles.tenant_id` populated for this user? |
| "Cross-tenant" data visible | Client-only filter bug — RLS should catch it; check `get_my_tenant_id()` returns the right UUID |
| Reminders not sending | `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;` |
| Stripe webhook 400 | Webhook secret mismatch — re-set `STRIPE_WEBHOOK_SECRET` |
| Build fails on Vercel | Check `package.json` deps vs lockfile; ensure env vars are set for that environment |

---

## 10. Cheat sheet

```bash
# Backend
supabase db push                               # apply migrations
supabase functions deploy                      # deploy all 29 functions
supabase functions deploy <name>               # just one
supabase secrets set KEY=value                 # shared secret
supabase migration list                        # local vs remote diff

# Frontend
vercel                                         # preview
vercel --prod                                  # production
vercel env ls                                  # list env vars
vercel logs <deployment-url>                   # tail logs

# Tenant
npx tsx scripts/setup-tenant.ts                # new salon end-to-end
psql $SUPABASE_DB_URL -f scripts/backfill-default-tenant.sql
```

See also: **[MULTI_TENANCY_GUIDE.md](./MULTI_TENANCY_GUIDE.md)** (per-tenant details), **[ARCHITECTURE.md](../ARCHITECTURE.md)** (system diagram).
