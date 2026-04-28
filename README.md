# Oasis Reserve

A multi-tenant booking and salon management platform. One Supabase backend serves many salon frontends, each branded, configured, and data-isolated.

## Stack

- **Frontend**: Vite + React 18 + TypeScript, Tailwind, shadcn/ui, React Router, TanStack Query
- **Backend**: Supabase (Postgres + RLS, Auth, Storage, Edge Functions)
- **Payments**: Stripe, Square (online + terminal)
- **Messaging**: Resend (email), Twilio / Sinch (SMS), voice agent handoff
- **Testing**: Vitest (unit), Playwright (e2e)

## Quick start

```bash
# install
npm install

# env — copy example and fill in your Supabase project
cp .env.example .env
#   VITE_SUPABASE_URL=https://<project>.supabase.co
#   VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
#   VITE_SUPABASE_PROJECT_ID=<project-ref>
#   VITE_TENANT_ID=<tenant-uuid>

# dev
npm run dev           # http://localhost:8080 (auto-bumps if taken)

# build & preview
npm run build
npm run preview

# tests
npm run test          # unit
npx playwright test   # e2e (needs preview server on :4173)
```

## Project layout

```
src/
  pages/           # routes (Home, Booking, Services, AdminLogin, AdminDashboard, …)
  components/      # shadcn/ui + feature components (settings, inbox, …)
  hooks/           # useAuth, useToast, …
  integrations/
    supabase/      # typed client + generated Database types
  lib/             # validation (zod), i18n, utils
  test/            # vitest specs
e2e/               # playwright specs
supabase/
  migrations/      # schema migrations (42 files)
  functions/       # 29 edge functions
scripts/           # tenant bootstrapping SQL + ts
```

## Multi-tenancy

The app is multi-tenant by design: each salon is a `tenant` row, and every business table carries a `tenant_id` column enforced by RLS.

- **Anon visitors** — frontend sends `x-tenant-id` header (from `VITE_TENANT_ID`); RLS scopes reads via `request_tenant_id()` and fails closed if the header is missing.
- **Authenticated admins** — RLS scopes reads/writes via `get_my_tenant_id()`, which looks up the admin's `user_roles.tenant_id`. Tampering with client-side env vars cannot cross tenants.
- **Edge functions** — cron jobs iterate every active tenant; user-triggered functions use the caller's tenant.

See **[MULTI_TENANCY_GUIDE.md](./MULTI_TENANCY_GUIDE.md)** for setup, onboarding a new salon, and the full isolation matrix. See **[ARCHITECTURE.md](../ARCHITECTURE.md)** for the system diagram. See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for end-to-end deployment (Supabase + Vercel + webhooks + cron).

### Onboarding a new salon

```bash
npx tsx scripts/setup-tenant.ts
# prompts: salon name, slug, owner email, first admin email/password
# outputs: VITE_TENANT_ID for the new frontend's .env
```

## Supabase

The CLI is already configured. Typical workflow:

```bash
supabase link --project-ref <ref>   # once
supabase db push                    # apply pending migrations
supabase functions deploy           # deploy all edge functions
supabase migration list             # compare local vs remote
```

Edge functions cover: AI chat + embeddings, booking / SMS / email reminders, Stripe & Square checkout + webhooks, Sinch messaging, email unsubscribe + suppression, voice agent handoff, admin management, key rotation, and more.

## Admin

- `/admin/login` — Supabase Auth (email/password)
- `/admin` — dashboard (bookings, services, therapists, sales, settings, AI config, inbox)
- Roles: `admin` (full), `employee` (scoped); stored in `user_roles` with a tenant link
- Role check is server-side via `has_role(user_id, role)`; the client UI reflects the result

Create the first admin for a tenant with the `create-admin` edge function or via `scripts/setup-tenant.ts`.

## Testing

| Kind | Location | Run |
|---|---|---|
| Unit | `src/test/*.test.ts` | `npm test` |
| e2e (browser) | `e2e/*.spec.ts` | `npx playwright test` |
| Tenant isolation | `src/test/multi-tenancy.test.ts`, `src/test/tenant-isolation-ai.test.ts`, `e2e/tenant-isolation.spec.ts` | — |

Unit tests cover validation schemas, RLS simulation, tenant-scoped query builders, booking availability, payment integrations, AI tool isolation, and messaging webhooks.

## Environment variables

| Var | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | Project ref (used by some tooling) |
| `VITE_TENANT_ID` | This deployment's tenant UUID — required for multi-tenant mode |

Per-tenant secrets (Resend, Twilio, Stripe, Sinch, AI license, etc.) live in the `app_settings` table, not env vars — each tenant configures its own via the Admin Dashboard.

## Deployment

Deployed via Vercel (`vercel.json`). Each salon is its own Vercel project with its own `VITE_TENANT_ID` — the shared Supabase backend handles the rest.
