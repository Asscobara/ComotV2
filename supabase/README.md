# ComOt — Supabase backend

PostgreSQL schema, Row-Level Security policies, and RPCs. Phase 1 covers: profiles, buildings, apartments, memberships (tenant approval flow), and committee handover.

## Multi-tenancy model

- Every building-scoped row carries `building_id`.
- Isolation is enforced **in the database** via RLS — see the policies in `migrations/0001_init.sql`.
- Joining a building goes through `security definer` RPCs (`get_building_by_invite_code`, `join_building`) so non-members never get direct table access.
- New members land in `status = 'pending'` and see nothing but the building name until the committee calls `approve_member`.

## Setup (one time)

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migration — either paste `migrations/0001_init.sql` into the SQL editor, or use the CLI:

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

3. Enable social providers (Google / Apple / Facebook) under **Authentication → Providers**, and add the app scheme `comot://` to the redirect allow-list for native OAuth.
4. Copy the project URL and anon key into `apps/mobile/.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

## Free-tier projects pause when idle

A free Supabase project is paused after about a week without traffic, and a paused project's
API hostname stops resolving in DNS entirely. The app keeps loading — it is only static
files — but every request fails, which surfaces as "can't reach the server".

Restore it from the project's page in the Supabase dashboard. A restore keeps the same
project ref, so no code or `.env` change is needed. If the project was deleted rather than
paused you have to create a new one, which means a new ref: update `apps/mobile/.env` and
re-apply every migration in order.

## Tests

`tests/` contains a stubbed Supabase auth environment (`setup.sql`) and a functional smoke test (`smoke.sql`) covering signup triggers, building creation, the join/approval flow, cross-building isolation, and committee handover. They run against plain PostgreSQL 16 — locally or in CI (`.github/workflows/ci.yml`):

```bash
psql -v ON_ERROR_STOP=1 -c "create database comot_test"
psql -d comot_test -v ON_ERROR_STOP=1 -f tests/setup.sql -f migrations/0001_init.sql -f tests/smoke.sql
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
