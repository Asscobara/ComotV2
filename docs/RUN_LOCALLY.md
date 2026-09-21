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

The quickest way in is the throwaway test account:

| Email | Password |
| --- | --- |
| `test@comot.test` | `1234` |

It is a committee member, so it reaches every screen. The rest of the residents use the
password **`comot1234`**:

| Email | Who they are | Use them to see |
| --- | --- | --- |
| `dana@comot.test` | Committee, apartment 1 | Everything: approvals, budget, reports, vendor booking |
| `test@comot.test` | Committee, apartment 2 | Same, with the short password above |
| `yossi@comot.test` | Tenant (owner), apartment 3 | The tenant's narrower view of the same building |
| `maya@comot.test` | Tenant (renter), apartment 4 | Renter rather than owner |
| `avi@comot.test` | **Pending** tenant, apartment 5 | The waiting-for-approval screen |
| `noa@comot.test` | Tenant (renter), apartment 6 | A second renter |
| `ronen@comot.test` | Tenant (owner), apartment 7 | Reporter of the open elevator fault |

Service providers sign in with `comot1234` too, and see the vendor side of the app rather
than a building:

| Email | Business | Covers |
| --- | --- | --- |
| `eli@comot.test` | אלי אינסטלציה | Plumbing, general — Tel Aviv, the building's **preferred** provider |
| `maor@comot.test` | מאור חשמל | Electricity — Tel Aviv, in the building's book |
| `gani@comot.test` | ירוק בגן | Gardening — Ramat Gan |
| `shachar@comot.test` | מעליות שחר | Elevators — Holon, in the building's book |
| `carmel@comot.test` | ניקיון כרמל | Cleaning — Tel Aviv, in the building's book |
| `avni@comot.test` | גגות אבני | Roofing — Petah Tikva |
| `handy@comot.test` | דני הנדימן | General, cleaning — Givatayim |
| `shifra@comot.test` | שפרה אינסטלציה | Plumbing, elevators — Bat Yam |
| `bar@comot.test` | בר חשמל ותקשורת | Electricity, general — **inactive**, never appears in matching |

### What is in the building

"הברושים 12" in Tel Aviv, four floors, eight apartments, ₪250 a month due on the 10th:

- **Tenants** — six active across two committee members, owners and renters, one pending
  join request to approve, and one vacant apartment.
- **Chat** — a building channel with a conversation in progress, plus a direct message.
- **Faults** — five, one in each status, spanning elevator, plumbing, electricity, cleaning
  and gardening. The plumbing one is already in progress with a job accepted by Eli.
- **Events** — four, one of each kind: an upcoming residents' meeting with a live poll, the
  monthly fee collection, an annual elevator inspection, and one in the past.
- **Polls** — one open (neither committee member has voted, so it is still actionable) and
  one already closed.
- **Budget** — ten entries across income and expense categories, and fees paid by four of
  the eight apartments, so the fee screen shows both states.
- **Providers** — nine covering all seven fault categories across seven cities, four in the
  building's own book with one preferred, and one inactive to prove matching filters it out.

Open a fault as a committee member and tap the matching action to see the ranking: the
preferred, in-the-book, same-city provider comes first.

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
