# Google Cloud deployment

Infrastructure for running ComOt's backend on Google Cloud instead of Supabase.
[`../../docs/GCP_MIGRATION.md`](../../docs/GCP_MIGRATION.md) explains the architecture, the
cost, what it does and does not replace, and what is still needed to apply it.

```
terraform/   Cloud SQL, two Cloud Run services, Secret Manager, IAM
sql/         The glue Supabase provides for free and Cloud SQL does not
```

## Why the SQL lives here and not in migrations

`supabase/migrations/` is portable as it stands and needs no changes to run on Cloud SQL. Its
only platform dependencies are `auth.uid()`, `auth.users`, and two blocks already guarded
with `if exists`.

What Supabase supplies implicitly — the `auth` schema's helper functions and the
`anon`/`authenticated` roles — has to be created explicitly. That belongs to the environment
rather than the schema, so it sits here. Keeping it out of the migrations also keeps them
testable against `supabase/tests/setup.sql`, which defines `auth.uid()` differently so the
test suites can impersonate users without minting JWTs.

## Order

1. `sql/01-roles-and-auth.sql` — roles, the `auth` schema, `auth.uid()` / `role()` / `email()`
2. GoTrue's first boot — it creates and owns `auth.users`
3. `supabase/migrations/*.sql` — unchanged
4. `sql/02-grants.sql` — privileges for the API roles
5. `sql/03-verify.sql` — asserts the deployment is safe to point the app at

Step 5 is the one not to skip: it catches a table served without its RLS policies, which
looks fine to a signed-in user while exposing every building's data to every other.
