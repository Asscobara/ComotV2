-- Test double for the auth tables GoTrue creates and owns through its own
-- migrations. NOT part of a deployment: on Cloud SQL, GoTrue creates these itself
-- on first boot, and running this instead would leave you with an auth schema
-- GoTrue does not recognise.
--
-- It exists so CI can verify the whole deploy chain — roles, migrations, grants,
-- verification — without starting an auth container. That matters because the
-- chain asserts things like "RLS is enabled on all 20 tables", which is exactly
-- the assertion that should fail the build if someone adds a table and forgets
-- its policies.
--
-- Only the columns the migrations and seed touch are included; GoTrue's real
-- table has many more.
set role supabase_auth_admin;

create table auth.users (
  instance_id uuid default '00000000-0000-0000-0000-000000000000',
  id uuid primary key default gen_random_uuid(),
  aud varchar(255) default 'authenticated',
  role varchar(255) default 'authenticated',
  email varchar(255) unique,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_data jsonb not null default '{}'::jsonb,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (provider, provider_id)
);

-- Deleting a user must invalidate their sessions, which is what makes the
-- account-deletion RPC actually revoke access rather than only hide data.
create table auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

reset role;
