# ComOt — Supabase backend

PostgreSQL schema, Row-Level Security policies, and RPCs covering profiles, buildings,
apartments, memberships and committee handover, plus chat, faults, events, polls, budget,
the vendor marketplace, and trigger-driven notifications.

## Multi-tenancy model

- Every building-scoped row carries `building_id`.
- Isolation is enforced **in the database** via RLS — see the policies in `migrations/0001_init.sql`.
- Joining a building goes through `security definer` RPCs (`get_building_by_invite_code`, `join_building`) so non-members never get direct table access.
- New members land in `status = 'pending'` and see nothing but the building name until the committee calls `approve_member`.

## Setup (one time)

The backend is a hosted Supabase project, not something this repository deploys. Merging to
`main` redeploys only the web app and landing page to GitHub Pages; the database has to be
created once in your own Supabase account, and the migrations here applied to it.

1. Create a project at [supabase.com](https://supabase.com). Note its **project ref** (the
   subdomain of the API URL) and its **publishable/anon key** from *Settings > API*.

2. Apply every migration, in numeric order. `migrations/` currently holds `0001` through
   `0005`; later ones depend on earlier ones, so order matters. In the dashboard, open
   *SQL Editor* and paste each file in turn, or bundle them into a single paste:

```bash
cat supabase/migrations/*.sql > /tmp/comot-setup.sql   # 0001..0005, glob order is numeric
```

   With the Supabase CLI instead of the dashboard:

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

   A correct run leaves 20 tables, all with RLS enabled, plus 46 policies and 72 functions.
   Verify with:

```sql
select count(*) as tables from pg_tables where schemaname = 'public';
```

3. Enable social providers (Google / Apple / Facebook) under **Authentication → Providers**, and add the app scheme `comot://` to the redirect allow-list for native OAuth.

4. Point the app at the project by editing `apps/mobile/.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable-key>
```

   Committing that change redeploys the web app against the new project. These two values
   are public by design and safe to commit; the secret service-role key never belongs here.

5. Optionally enable the `pg_cron` extension under *Database > Extensions* to activate the
   daily fee reminders in `0005_notifications.sql`. Everything else works without it.

## Free-tier projects pause when idle

A free Supabase project is paused after about a week without traffic, and a paused project's
API hostname stops resolving in DNS entirely. The app keeps loading — it is only static
files — but every request fails, which surfaces as "can't reach the server".

Restore it from the project's page in the Supabase dashboard. A restore keeps the same
project ref, so no code or `.env` change is needed. If the project was deleted rather than
paused you have to create a new one, which means a new ref: update `apps/mobile/.env` and
re-apply every migration in order.

## Tests

`tests/` contains a stubbed Supabase auth environment (`setup.sql`) plus one functional smoke
suite per phase, covering signup triggers, building creation, the join/approval flow,
cross-building isolation, committee handover, chat, faults, events, polls, budget, vendor
matching, and notification triggers. Every suite asserts isolation between buildings, so a
regression in an RLS policy fails the build.

They run against plain PostgreSQL 16, locally or in CI (`.github/workflows/ci.yml`). This is
also the quickest way to confirm a migration set applies cleanly before touching a real
project:

```bash
# Dropping first keeps this re-runnable: setup.sql recreates the cluster-wide
# app_user role, which cannot be dropped while an old test database still
# references it.
psql -v ON_ERROR_STOP=1 -c "drop database if exists comot_test" -c "create database comot_test"
psql -d comot_test -v ON_ERROR_STOP=1 \
  -f tests/setup.sql \
  -f migrations/0001_init.sql -f migrations/0002_chat_faults.sql \
  -f migrations/0003_events_polls_budget.sql -f migrations/0004_vendors.sql \
  -f migrations/0005_notifications.sql \
  -f tests/smoke.sql -f tests/smoke2.sql -f tests/smoke3.sql \
  -f tests/smoke4.sql -f tests/smoke5.sql
```

## RPC surface (Phase 1)

| Function | Caller | Purpose |
| --- | --- | --- |
| `create_building(...)` | Committee | Creates building + auto-generates apartments + committee membership |
| `get_building_by_invite_code(code)` | Any authed user | Join-flow lookup: building preview + apartment list |
| `join_building(code, apartment_id, tenant_type)` | Tenant | Creates a `pending` membership |
| `approve_member(membership_id, approve)` | Committee | Approves / rejects a pending member |
| `request_handover(building_id, to_user)` | Committee | Nominates a successor |
| `respond_handover(handover_id, accept)` | Successor | Explicit confirmation — role transfers only here |
