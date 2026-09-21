# ComOt backend — where it lives and how to connect

## Where it runs

There is no server we operate and nothing to install. The backend is a single **hosted
Supabase project** in the owner's Supabase account, which provides managed PostgreSQL,
Auth, and Realtime. This repository holds only the *definition* of that backend — the SQL in
`supabase/migrations/` — and merging to `main` does not create or update it. See
[`../supabase/README.md`](../supabase/README.md) for the setup runbook.

The frontend is unrelated infrastructure: static files on GitHub Pages, deployed
automatically from `main`.

| Resource | Provider | Location | Deployed by |
| --- | --- | --- | --- |
| PostgreSQL, Auth, Realtime | Supabase (hosted) | `<project-ref>.supabase.co` | Applying `supabase/migrations/*.sql` by hand |
| Web app | GitHub Pages | `/ComotV2/app/` | `.github/workflows/deploy-web.yml` |
| Landing page | GitHub Pages | `/ComotV2/` | `.github/workflows/deploy-web.yml` |
| iOS / Android builds | Expo EAS | expo.dev | `.github/workflows/mobile-build.yml` |

Everything below is keyed off the **project ref**, the subdomain of the API URL. The ref
currently configured in `apps/mobile/.env` is `mkylsnmdxiwgylsezmdu`.

## API endpoints

All derived from the project ref, so they are known without logging in.

| Service | Endpoint | Used by ComOt |
| --- | --- | --- |
| PostgREST (tables, RPCs) | `https://<ref>.supabase.co/rest/v1/` | Yes |
| Auth (GoTrue) | `https://<ref>.supabase.co/auth/v1/` | Yes |
| Realtime | `wss://<ref>.supabase.co/realtime/v1/websocket` | Yes |
| Storage | `https://<ref>.supabase.co/storage/v1/` | **No** — no buckets exist |
| Edge Functions | `https://<ref>.functions.supabase.co/` | **No** — none deployed |

## Credentials

| Credential | Where it lives | Public? |
| --- | --- | --- |
| Project URL | `apps/mobile/.env` → `EXPO_PUBLIC_SUPABASE_URL` | Yes |
| Publishable (anon) key | `apps/mobile/.env` → `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| Secret (service-role) key | Dashboard → *Settings > API* only | **No** |
| Database password | Dashboard → *Settings > Database* only | **No** |

The two values in `.env` are committed deliberately: they ship inside every client bundle
anyway, and all access is constrained by Row-Level Security. The service-role key bypasses
RLS entirely and must never enter this repository.

## Connecting with a Postgres client

The exact strings are on the dashboard's **Connect** panel. The shapes are:

```bash
# Direct — IPv6 unless the project has the IPv4 add-on. Use for psql, pg_dump, migrations.
postgresql://postgres:[PASSWORD]@db.<ref>.supabase.co:5432/postgres

# Shared pooler (Supavisor), session mode — IPv4, for persistent clients.
postgresql://postgres.<ref>:[PASSWORD]@aws-[region].pooler.supabase.com:5432/postgres

# Shared pooler, transaction mode — IPv4, for serverless. Append ?pgbouncer=true for Prisma.
postgresql://postgres.<ref>:[PASSWORD]@aws-[region].pooler.supabase.com:6543/postgres
```

Two things catch people out: the pooler username embeds the project ref as
`postgres.<ref>`, not plain `postgres`; and a password containing special characters has to
be percent-encoded in a URI.

If you only need the data, the client libraries and PostgREST work over IPv4 with no add-on,
so a direct Postgres connection is usually unnecessary.

## Checking whether the backend is alive

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  "https://<ref>.supabase.co/rest/v1/" -H "apikey: <publishable-key>"
```

`200` means healthy. `Could not resolve host` means the project is paused or deleted — a
paused free project stops resolving in DNS entirely. Note that the web app and landing page
are static files and keep loading regardless, so a working UI does not imply a working
backend.

## Database inventory

Totals after applying `0001` through `0005`: **20 tables** (RLS enabled on all of them),
**46 policies**, **8 enum types**, **49 indexes**, **16 triggers**, and **36 functions of our
own** — 26 callable plus 10 trigger functions. A raw `count(*)` over `pg_proc` in `public`
reports 72 because `pgcrypto` contributes the rest.

### Tables

| Area | Tables |
| --- | --- |
| Identity & tenancy | `profiles`, `buildings`, `apartments`, `memberships`, `committee_handovers` |
| Chat | `conversations`, `conversation_members`, `messages` |
| Faults | `faults`, `fault_updates`, `fault_bookings` |
| Events & polls | `events`, `polls`, `poll_options`, `poll_votes` |
| Budget | `budget_entries`, `fee_payments` |
| Vendors | `vendors`, `building_vendors` |
| Notifications | `notifications` |

Every building-scoped row carries `building_id`, and isolation is enforced by RLS rather than
in application code, so a direct Postgres connection as `postgres` sees everything while an
authenticated client sees only its own building.

### Enum types

| Type | Values |
| --- | --- |
| `membership_role` | `committee`, `tenant` |
| `membership_status` | `pending`, `active`, `rejected`, `removed` |
| `tenant_type` | `owner`, `renter` |
| `fault_status` | `reported`, `in_progress`, `resolved`, `closed` |
| `event_kind` | `meeting`, `maintenance`, `payment`, `other` |
| `event_recurrence` | `none`, `weekly`, `monthly`, `yearly` |
| `conversation_kind` | `channel`, `dm` |
| `budget_kind` | `income`, `expense` |

### RPCs called by the client

Seventeen `security definer` functions, reachable at `POST /rest/v1/rpc/<name>`. These carry
the business rules that RLS alone cannot express.

| Area | Functions |
| --- | --- |
| Onboarding | `create_building`, `get_building_by_invite_code`, `join_building` |
| Tenancy | `approve_member`, `request_handover`, `respond_handover` |
| Chat | `get_or_create_dm`, `get_or_create_event_channel` |
| Faults & vendors | `update_fault_status`, `match_vendors`, `book_vendor`, `respond_booking` |
| Polls | `create_poll`, `vote`, `close_poll`, `poll_results` |
| Budget | `mark_fee_paid` |

Nine further functions exist but are not part of the client surface: `is_member`,
`is_committee`, `is_active_member`, `shares_building_with`, `can_access_conversation`,
`committee_ids` and `active_member_ids` are predicates used inside RLS policies;
`notify_users` is called by the notification triggers; and `run_fee_reminders` is driven by
`pg_cron`.

### Triggers

Sixteen, in three groups. `set_updated_at` maintains `updated_at` on `profiles`, `buildings`,
`memberships`, `faults`, `fault_bookings`, `events` and `vendors`. Eight `tg_notify_*`
triggers write rows into `notifications` when membership, faults, handovers, polls and
bookings change, which is why notifications need no application code to stay in sync.

The sixteenth is the important one: **`on_auth_user_created` on `auth.users`**, which runs
`handle_new_user` to create the matching `profiles` row on signup. It lives outside the
`public` schema, so a schema-only comparison of `public` will not show it, and without it
signup succeeds while the app has no profile to read.

### Realtime

Six tables are added to the `supabase_realtime` publication: `messages`, `faults`,
`fault_updates`, `polls`, `poll_votes` and `notifications`. The client subscribes to
`postgres_changes` on `messages` (per conversation) and `notifications` (per user).

### Extensions

`pgcrypto` for `gen_random_uuid()`, and `plpgsql`. `pg_cron` is optional: migration `0005`
schedules `run_fee_reminders()` daily only when the extension is present, so fee reminders
are the one feature that needs it enabled under *Database > Extensions*.

## Dashboard configuration not captured in SQL

Two things live only in project settings and have to be set by hand after a restore or
rebuild:

- **Auth providers** — email/password plus Google, Apple and Facebook under
  *Authentication > Providers*.
- **Redirect allow-list** — the native OAuth flow uses the `comot://` scheme from
  `app.json`, so it must be permitted alongside the deployed web origin.
