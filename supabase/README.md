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

## RPC surface (Phase 1)

| Function | Caller | Purpose |
| --- | --- | --- |
| `create_building(...)` | Committee | Creates building + auto-generates apartments + committee membership |
| `get_building_by_invite_code(code)` | Any authed user | Join-flow lookup: building preview + apartment list |
| `join_building(code, apartment_id, tenant_type)` | Tenant | Creates a `pending` membership |
| `approve_member(membership_id, approve)` | Committee | Approves / rejects a pending member |
| `request_handover(building_id, to_user)` | Committee | Nominates a successor |
| `respond_handover(handover_id, accept)` | Successor | Explicit confirmation — role transfers only here |
