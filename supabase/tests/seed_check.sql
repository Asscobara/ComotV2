-- Verifies supabase/seed.sql against the current schema. Run on a database that
-- has the migrations and the seed applied, and nothing else.
--
-- The seed is only useful if it keeps working, and it is the kind of thing that
-- rots silently: a renamed column or a tightened check constraint breaks local
-- onboarding without breaking anything CI would otherwise notice. These
-- assertions also cover the two properties the seed exists to provide — a
-- populated building, and data that is actually visible through RLS.
\set ON_ERROR_STOP on

-- Accounts and the profiles the auth.users trigger derives from them.
do $$ begin
  assert (select count(*) from auth.users) = 5, 'five demo accounts';
  assert (select count(*) from auth.identities) = 5, 'every account has an identity for password login';
  assert (select count(*) from public.profiles) = 5,
    'on_auth_user_created created a profile per account';
  assert (select full_name from public.profiles
          where id = 'a0000000-0000-4000-8000-000000000001') = 'דנה כהן',
    'full_name carried across from raw_user_meta_data';
  assert (select count(*) from auth.users where encrypted_password is null) = 0,
    'every account has a password hash';
end $$;

-- The building and its contents.
do $$ begin
  assert (select count(*) from public.buildings) = 1, 'one demo building';
  assert (select invite_code from public.buildings) = 'comot123', 'documented invite code';
  assert (select count(*) from public.apartments) = 8, 'eight apartments';
  assert (select count(*) from public.memberships where status = 'active') = 3, 'three active members';
  assert (select count(*) from public.memberships where status = 'pending') = 1,
    'one pending member, so the approval flow has a subject';
  assert (select count(*) from public.memberships where role = 'committee') = 1, 'one committee member';
  assert (select count(*) from public.messages) = 3, 'seeded conversation';
  assert (select count(*) from public.faults) = 2, 'two faults';
  assert (select count(*) from public.faults where status = 'in_progress') = 1, 'one fault in progress';
  assert (select count(*) from public.events) = 2, 'two events';
  assert (select count(*) from public.poll_options) = 3, 'poll has options';
  assert (select count(*) from public.poll_votes) = 2, 'poll has votes';
  assert (select count(*) from public.budget_entries) = 4, 'budget populated';
  assert (select count(*) from public.vendors) = 1, 'one vendor';
end $$;

-- The fee screen needs both paid and unpaid apartments to be worth looking at.
do $$ begin
  assert (select count(*) from public.fee_payments where period = to_char(now(), 'YYYY-MM')) = 3,
    'three apartments paid for the current period';
  assert (select count(*) from public.apartments) >
         (select count(*) from public.fee_payments where period = to_char(now(), 'YYYY-MM')),
    'some apartments are still unpaid';
end $$;

-- Dana has deliberately not voted, so the poll is still actionable as her.
do $$ begin
  assert not exists (
    select 1 from public.poll_votes where user_id = 'a0000000-0000-4000-8000-000000000001'
  ), 'committee member has not voted yet';
end $$;

-- Seeded rows are worthless if RLS hides them from the accounts we tell people
-- to sign in as, so check visibility rather than just existence.
set role app_user;

set test.uid = 'a0000000-0000-4000-8000-000000000001';
do $$ begin
  assert (select count(*) from public.buildings) = 1, 'committee sees the building';
  assert (select count(*) from public.memberships) = 4, 'committee sees all members including pending';
  assert (select count(*) from public.faults) = 2, 'committee sees faults';
  assert (select count(*) from public.budget_entries) = 4, 'committee sees the budget';
end $$;

set test.uid = 'a0000000-0000-4000-8000-000000000002';
do $$ begin
  assert (select count(*) from public.buildings) = 1, 'tenant sees the building';
  assert (select count(*) from public.faults) = 2, 'tenant sees faults';
end $$;

-- The vendor has no membership, so the building must be invisible to him.
set test.uid = 'a0000000-0000-4000-8000-000000000005';
do $$ begin
  assert (select count(*) from public.buildings) = 0, 'vendor sees no buildings';
  assert (select count(*) from public.faults) = 0, 'vendor sees no faults';
  assert (select count(*) from public.vendors) = 1, 'vendor sees his own profile';
end $$;

reset role;
select 'SEED CHECK PASSED' as result;
