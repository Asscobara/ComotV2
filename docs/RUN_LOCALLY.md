# Running ComOt locally, backend included

This runs the whole product on your machine — Postgres, Auth, Realtime and the app —
with **no Supabase account and no cloud project**. Nothing here can be paused or
deleted out from under you, which is the main reason to prefer it for development.

If you would rather use the hosted project, see [`../supabase/README.md`](../supabase/README.md).

## What you need

- **Docker Desktop** (or Podman), running. The Supabase CLI starts the backend as containers.
- **Node.js 22+** and **pnpm**.
- The **Supabase CLI**: `brew install supabase/tap/supabase`, or see
  [the install docs](https://supabase.com/docs/guides/local-development/cli/getting-started)
  for other platforms.

## Start it

```bash
pnpm install

# Boots Postgres, Auth, Realtime and Studio, then applies migrations and seed data.
pnpm db:start

# Point the app at the local stack rather than the cloud project.
cp apps/mobile/.env.local.example apps/mobile/.env.local
```

`pnpm db:start` prints an **API URL** and an **anon key**. Put the anon key into
`apps/mobile/.env.local`; the URL there is already correct. Expo reads `.env.local` at a
higher priority than the committed `.env`, so the cloud configuration is left untouched, and
`.env.local` is gitignored.

Then run the app:

```bash
pnpm web     # browser at http://localhost:8081
pnpm dev     # Expo dev server; press i for iOS, a for Android, w for web
```

`pnpm db:status` re-prints the keys, `pnpm db:stop` shuts the stack down, and
`pnpm db:reset` rebuilds the database from scratch — migrations and seed — which is the
quickest way back to a known state after you have made a mess of the data.

## Signing in

`supabase/seed.sql` creates a populated building so every screen has something on it.
All accounts use the password **`comot1234`**.

| Email | Who they are | Use them to see |
| --- | --- | --- |
| `dana@comot.test` | Committee member, apartment 1 | Everything: tenant approval, budget, reports, vendor booking |
| `yossi@comot.test` | Tenant (owner), apartment 2 | The tenant's more limited view of the same building |
| `maya@comot.test` | Tenant (renter), apartment 3 | Renter rather than owner |
| `avi@comot.test` | **Pending** tenant, apartment 4 | The waiting-for-approval screen |
| `eli@comot.test` | Plumber, not a building member | The separate vendor experience |

Sign in as Dana first. The building "הברושים 12" has eight apartments, three active
tenants, one pending request, an open fault and one in progress, an upcoming residents'
meeting with a live poll, fees paid by three of eight apartments, and a plumber available
to book. Avi's pending request means the approval flow has something to act on, and the
five unpaid apartments mean the budget screen is not uniformly green.

Signing in as Eli shows the vendor side and demonstrates the isolation: he can see his own
vendor profile and jobs offered to him, and nothing else about the building.

The invite code for joining the building as a new tenant is **`comot123`**.

## Useful extras

Studio, a database GUI, runs at <http://127.0.0.1:54323> once the stack is up. It is the
easiest way to look at rows directly, and it bypasses RLS, so it shows everything
regardless of who is signed in.

Local sign-ups skip email confirmation (`enable_confirmations = false` in
`supabase/config.toml`), so you can register throwaway accounts freely.

To reach the local stack with `psql`:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

## If the app still talks to the cloud project

A real shell environment variable beats every `.env` file, silently. If
`EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` is exported in your shell —
or injected by your CI or agent environment — `.env.local` is ignored and the app keeps
using whatever the environment says. Check with:

```bash
env | grep EXPO_PUBLIC_SUPABASE
```

If anything is listed, `unset` it (or start a fresh shell) before running the app. To
confirm which values actually ended up in a build:

```bash
cd apps/mobile && DEBUG='expo:env*' pnpm exec expo export --platform web
```

Expo logs every env file it reads and every variable one file overrides in another.

## Notes

- **Seed data is for local use only.** It writes directly to `auth.users` to create accounts
  without going through sign-up, and the passwords are public. Never load it into a real
  project.
- **Social sign-in does not work locally** without provider credentials. Google, Apple and
  Facebook need real OAuth apps configured in `supabase/config.toml`; email and password
  work out of the box.
- **RLS still applies.** The seeded data is only visible to accounts with a membership in
  that building, which is why signing in as Eli shows an empty building. That is correct
  behaviour, not a broken seed.
- **Changing the schema**: add a new numbered file under `supabase/migrations/` and run
  `pnpm db:reset`. The CLI applies migrations in filename order and then re-seeds.
