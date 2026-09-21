# Moving the backend from Supabase to Google Cloud

## The finding that shapes this

The backend is already portable. The demo instance that has been serving the app all along
runs **stock PostgreSQL plus PostgREST with no Supabase components in it**, with all 46 RLS
policies enforced — sign-in, payments, vendor matching and account deletion all verified
through it over HTTP.

So this is a hosting migration, not a rewrite:

| Piece | Coupling to Supabase | What moving costs |
| --- | --- | --- |
| 20 tables, 46 policies, 8 enums, 49 indexes | None; plain Postgres | Restore a dump |
| `auth.uid()` — 56 call sites in policies and RPCs | A 3-line function over a JWT claim | Provided by `deploy/gcp/sql/01-roles-and-auth.sql` |
| `auth.users` — 2 references | One table plus the signup trigger | GoTrue creates it |
| 30 `.from()` / `.rpc()` call sites | PostgREST, not Supabase | **No change** |
| 19 `supabase.auth.*` call sites | GoTrue's API | **No change** — same service, self-hosted |
| 3 realtime subscriptions | Supabase-specific | Dropped; see below |
| Storage | Unused, no buckets exist | Nothing to move |

**`supabase/migrations/` needs no edits.** Verified by applying all of it to a database
built the GCP way — roles, GoTrue-shaped auth schema, then the migrations untouched, then
grants — and running the verification suite green.

## Architecture

```
  App (Expo)
    ├── data  ──▶ Cloud Run: PostgREST ──┐
    └── auth  ──▶ Cloud Run: GoTrue ─────┴──▶ Cloud SQL for PostgreSQL
                                                (schema + 46 RLS policies)
```

- **Cloud SQL for PostgreSQL 17** holds the schema unchanged. No authorized networks, so
  the address accepts nothing; everything connects through the Cloud SQL connector, which
  authenticates with IAM.
- **PostgREST on Cloud Run** serves the same REST and RPC endpoints Supabase did, which is
  what keeps the app's data layer untouched. Scales to zero.
- **GoTrue on Cloud Run** — the same auth service Supabase runs, self-hosted. Kept warm so
  sign-in never pays a cold start.
- **`me-west1` (Tel Aviv)** for latency.

### Why GoTrue rather than Identity Platform

Identity Platform is the GCP-native answer and is fully managed, which is a real advantage.
It was rejected because of one detail: `profiles.id` is a `uuid` referencing `auth.users`,
and Firebase UIDs are strings. Going that way means a UUID mapping layer, a provisioning
Cloud Function to replace the `on_auth_user_created` trigger and to set custom claims, and
rewriting the app's 19 auth call sites — with the security model, which is the part worth
protecting, disturbed along the way.

Self-hosting GoTrue keeps the uuid model, the trigger and every call site as they are. The
price is that you are running an auth container: follow its releases and redeploy for
security fixes. That is a smaller, more visible cost than reworking authentication.

Revisit this if you want managed auth or Google's MFA and identity features later; the
schema does not stop you.

### Realtime is dropped

GCP has no managed equivalent, and the app already degrades cleanly: chat and notification
badges refresh when a screen is focused rather than updating live. I ran the whole app this
way while the demo had no Realtime service and nothing broke — a WebSocket error appears in
the console and the UI carries on.

If live updates matter, the options are Firestore for a live collection alongside Postgres,
or Firebase Cloud Messaging for actual push notifications, which the app does not have on
any backend yet and which would be the more valuable feature.

## Cost, honestly

Cloud SQL does not scale to zero. The smallest shared-core instance plus Cloud Run and
Secret Manager lands somewhere around **$10–20/month**, against Supabase free at $0 or
Supabase Pro at $25. Cloud Run is near-free at this traffic; the instance is the floor.

What you get for it: data in `me-west1`, no project that pauses, backups and
point-in-time recovery you control, and everything in one cloud. What you take on: VPC-less
but still real IAM, container deploys, an auth service to keep patched, and a backup policy
that is now yours.

**If the reason for moving is that the Supabase project keeps pausing, restoring it or going
Pro is a much smaller lever for the same outcome.** This is worth saying plainly before
spending the money.

## What I need from you

I can write and validate all of this, but I cannot provision anything without access. In
order of what unblocks the most:

1. **A Google Cloud project with billing enabled**, and its project ID. Everything else
   follows from that.
2. **How you want it applied.** Either review and `terraform apply` yourself — recommended,
   since nothing has to be handed over and you keep control of billing — or add a service
   account key as a Cloud Agent secret and I apply it. If the latter, the service account
   needs: `roles/cloudsql.admin`, `roles/run.admin`, `roles/secretmanager.admin`,
   `roles/iam.serviceAccountAdmin`, `roles/iam.serviceAccountUser`,
   `roles/serviceusage.serviceUsageAdmin`, `roles/resourcemanager.projectIamAdmin`.
3. **A Supabase database dump**, if there is data worth keeping. The project currently does
   not resolve, so it has to be restored first — and if it was deleted rather than paused
   there is nothing to migrate and this becomes a clean build.
4. **Decisions I have made for you**, to overrule if you disagree: GoTrue over Identity
   Platform, Realtime dropped, `me-west1`, `db-f1-micro`.
5. **SMTP details** if you want password reset emails. Without them GoTrue auto-confirms new
   accounts, which is fine for a first deploy and wrong for production.
6. **OAuth client IDs and secrets** for Google, Apple and Facebook if you want social
   sign-in. These are per-provider and currently unconfigured on any backend — which is
   also an App Store problem, noted in [`APP_STORE.md`](APP_STORE.md).

## Running it

```bash
cd deploy/gcp/terraform
terraform init
terraform apply -var project_id=YOUR_PROJECT_ID
```

Then load the schema. Terraform prints the exact commands; the shape is:

```bash
# Reach the instance through the connector.
cloud-sql-proxy --port 5433 "$(terraform output -raw sql_connection_name)"

# 1. Roles and the auth helper functions.
psql -h 127.0.0.1 -p 5433 -U comot_app -d comot -f ../sql/01-roles-and-auth.sql

# 2. Let GoTrue create and own the auth schema — it runs its own migrations on
#    first boot, so just hit it once and wait for a healthy response.
curl -sS "$(terraform output -raw auth_url)/health"

# 3. The app schema, unchanged.
cat ../../../supabase/migrations/*.sql | psql -h 127.0.0.1 -p 5433 -U comot_app -d comot

# 4. Grants for the API roles, then verify.
psql -h 127.0.0.1 -p 5433 -U comot_app -d comot -f ../sql/02-grants.sql
psql -h 127.0.0.1 -p 5433 -U comot_app -d comot -f ../sql/03-verify.sql
```

Step 4's verification is the one not to skip. The dangerous failure here is not a broken
app, which is obvious immediately — it is a table served through PostgREST with its policies
missing, which looks fine to a signed-in user while exposing every building's data to every
other. `03-verify.sql` asserts RLS is enabled and has policies on all 20 tables, that
`auth.uid()` reads the JWT rather than a test setting, that the signup trigger exists, and
that a signed-in role cannot read `auth.users` directly.

## Moving existing data

With the Supabase project restored:

```bash
# Schema is already in git, so only take the data.
pg_dump --data-only --no-owner --no-privileges \
  --schema=public --schema=auth \
  "postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres" \
  > comot-data.sql

psql -h 127.0.0.1 -p 5433 -U comot_app -d comot -f comot-data.sql
```

Load `auth` before `public`, because `profiles.id` references `auth.users`. Expect the
notification triggers to fire on insert and generate a burst of rows; clear them afterwards
if that bothers you, or disable the triggers for the load.

## Cutting over

The app points at one Supabase URL today and will need two, because Cloud Run gives each
service its own hostname. That is the only app change this migration requires:
`apps/mobile/src/lib/supabase.ts` currently builds a single client from
`EXPO_PUBLIC_SUPABASE_URL`; it needs to pass the GoTrue URL separately. `supabase-js`
accepts this through its `auth` options, so the change is confined to that one file and the
11 files importing the client are unaffected.

Sequence: deploy, load the schema, verify, load the data, point a preview build at the new
URLs, sign in and walk the flows, then change `.env` and let the Pages deploy ship it. Keep
the Supabase project alive until you are satisfied — rolling back is then just reverting
`.env`.

## What is not verified

Everything that can be checked without a GCP project has been: the Terraform validates
against the real provider schema (v6.50), the SQL chain applies to a real PostgreSQL and
passes its assertions, and RLS was confirmed through minted JWTs over HTTP on exactly this
configuration — a committee member saw their building's data, a provider with no membership
saw none of it, and an unauthenticated request got a clean 401.

What has not been exercised is the parts that only exist on GCP: whether the first
`terraform apply` succeeds end to end, whether Cloud Run's Cloud SQL socket connects on the
first try, and whether GoTrue's own migrations run cleanly against Cloud SQL. Those are the
likely places to spend debugging time, and the reason to do this in a throwaway project
before a real one.
