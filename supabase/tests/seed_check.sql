-- Verifies supabase/seed.sql against the current schema. Run on a database that
-- has the migrations and the seed applied, and nothing else.
--
-- The seed is only useful if it keeps working, and it is the kind of thing that
-- rots silently: a renamed column or a tightened check constraint breaks local
-- onboarding without breaking anything CI would otherwise notice. These
-- assertions also cover what the seed exists to provide — a populated building,
-- every awkward state represented, and data that is visible through RLS.
\set ON_ERROR_STOP on

-- Accounts and the profiles the auth.users trigger derives from them.
do $$ begin
  assert (select count(*) from auth.users) = 16, 'sixteen demo accounts';
  assert (select count(*) from auth.identities) = 16, 'every account has an identity for password login';
  assert (select count(*) from public.profiles) = 16,
    'on_auth_user_created created a profile per account';
  assert (select full_name from public.profiles
          where id = 'a0000000-0000-4000-8000-000000000001') = 'דנה כהן',
    'full_name carried across from raw_user_meta_data';
  assert (select count(*) from auth.users where encrypted_password is null) = 0,
    'every account has a password hash';
end $$;

-- The documented sign-in credentials must actually work, including the short
-- password on the `test` account, and must reject anything else.
do $$
declare
  v_hash text;
begin
  select encrypted_password into v_hash from auth.users where email = 'test@comot.test';
  assert v_hash is not null, 'the test account exists';
  assert v_hash = crypt('1234', v_hash), 'test signs in with 1234';
  assert v_hash <> crypt('comot1234', v_hash), 'test does not accept the shared password';

  select encrypted_password into v_hash from auth.users where email = 'dana@comot.test';
  assert v_hash = crypt('comot1234', v_hash), 'dana signs in with comot1234';
  assert v_hash <> crypt('wrong', v_hash), 'a wrong password is rejected';

  assert (select full_name from public.profiles p
          join auth.users u on u.id = p.id where u.email = 'test@comot.test') = 'test',
    'the test account is named test';
  assert (select m.role from public.memberships m
          join auth.users u on u.id = m.user_id where u.email = 'test@comot.test') = 'committee',
    'the test account has committee access so it can reach every screen';
end $$;

-- The building and its residents.
do $$ begin
  assert (select count(*) from public.buildings) = 1, 'one demo building';
  assert (select invite_code from public.buildings) = 'comot123', 'documented invite code';
  assert (select count(*) from public.apartments) = 8, 'eight apartments';
  assert (select count(*) from public.memberships where status = 'active') = 6, 'six active members';
  assert (select count(*) from public.memberships where status = 'pending') = 1,
    'one pending member, so the approval flow has a subject';
  assert (select count(*) from public.memberships where role = 'committee') = 2, 'two committee members';
  assert (select count(*) from public.memberships where tenant_type = 'renter') = 2,
    'owners and renters are both represented';
  assert (select count(*) from public.apartments) >
         (select count(*) from public.memberships where building_id = (select id from public.buildings)),
    'at least one apartment is vacant';
end $$;

-- Conversations, faults, events and polls: every state worth looking at.
do $$ begin
  assert (select count(*) from public.conversations where kind = 'channel') = 1, 'a building channel';
  assert (select count(*) from public.conversations where kind = 'dm') = 1, 'a direct message thread';
  assert (select count(*) from public.messages) = 8, 'seeded conversation';

  assert (select count(*) from public.faults) = 5, 'five faults';
  assert (select count(distinct status) from public.faults) = 4,
    'every fault status is represented';
  assert (select count(distinct category) from public.faults) >= 4,
    'faults span several categories';
  assert (select count(*) from public.fault_bookings) = 1, 'one job sent to a provider';

  assert (select count(*) from public.events) = 4, 'four events';
  assert (select count(distinct kind) from public.events) = 4, 'every event kind is represented';
  assert (select count(*) from public.polls where status = 'open') = 1, 'one open poll';
  assert (select count(*) from public.polls where status = 'closed') = 1, 'one closed poll';
  assert (select count(*) from public.poll_votes) = 6, 'polls have votes';
end $$;

-- Budget and fees need both paid and unpaid apartments to be worth looking at.
do $$ begin
  assert (select count(*) from public.budget_entries) = 10, 'budget populated';
  assert (select count(distinct category) from public.budget_entries) >= 8,
    'budget spans income and expense categories';
  assert (select count(*) from public.budget_entries where kind = 'income') > 0, 'income recorded';
  assert (select count(*) from public.budget_entries where kind = 'expense') > 0, 'expenses recorded';

  assert (select count(*) from public.fee_payments where period = to_char(now(), 'YYYY-MM')) = 4,
    'four apartments paid for the current period';
  assert (select count(*) from public.apartments) >
         (select count(*) from public.fee_payments where period = to_char(now(), 'YYYY-MM')),
    'some apartments are still unpaid';
  assert (select count(*) from public.fee_payments
          where period = to_char(now() - interval '1 month', 'YYYY-MM')) > 0,
    'a previous period exists so payment history is not empty';
end $$;

-- Service providers must cover every fault category, or matching a fault of
-- that category silently returns nothing.
do $$
declare
  v_missing text;
begin
  select string_agg(c, ', ') into v_missing
  from (values ('plumbing'), ('electricity'), ('gardening'), ('elevator'),
               ('cleaning'), ('roofing'), ('general')) as cats(c)
  where not exists (
    select 1 from public.vendors v where v.is_active and v.categories @> array[cats.c]
  );
  assert v_missing is null, 'every fault category has an active provider; missing: ' || coalesce(v_missing, '');

  assert (select count(*) from public.vendors where is_active) = 8, 'eight active providers';
  assert (select count(*) from public.vendors where not is_active) = 1,
    'one inactive provider, to prove matching filters it out';
  assert (select count(distinct city) from public.vendors) >= 6,
    'providers are spread across cities';
  assert (select count(*) from public.building_vendors) = 4, 'four providers in the building book';
  assert (select count(*) from public.building_vendors where preferred) = 1, 'one preferred provider';
end $$;

-- Committee members have not voted on the open poll, so it stays actionable.
do $$ begin
  assert not exists (
    select 1 from public.poll_votes v
    join public.memberships m on m.user_id = v.user_id
    where v.poll_id = '11110000-0000-4000-8000-000000000001' and m.role = 'committee'
  ), 'committee members have not voted on the open poll yet';
end $$;

-- Seeded rows are worthless if RLS hides them from the accounts we tell people
-- to sign in as, so check visibility rather than just existence.
set role app_user;

set test.uid = 'a0000000-0000-4000-8000-000000000001';
do $$ begin
  assert (select count(*) from public.buildings) = 1, 'committee sees the building';
  assert (select count(*) from public.memberships) = 7, 'committee sees all members including pending';
  assert (select count(*) from public.faults) = 5, 'committee sees faults';
  assert (select count(*) from public.budget_entries) = 10, 'committee sees the budget';
  assert (select count(*) from public.vendors where is_active) = 8, 'committee sees the marketplace';
end $$;

-- Matching must rank the building's preferred provider first and exclude the
-- inactive one entirely.
do $$
declare
  v_first text;
begin
  select e->>'business_name' into v_first
  from jsonb_array_elements(public.match_vendors('e0000000-0000-4000-8000-000000000002')) e
  limit 1;
  assert v_first = 'אלי אינסטלציה', 'the preferred, in-book, same-city plumber ranks first';

  assert not exists (
    select 1
    from jsonb_array_elements(public.match_vendors('e0000000-0000-4000-8000-000000000003')) e
    where e->>'business_name' = 'בר חשמל ותקשורת'
  ), 'the inactive provider is excluded from matching';
end $$;

set test.uid = 'a0000000-0000-4000-8000-000000000002';
do $$ begin
  assert (select count(*) from public.buildings) = 1, 'the test account sees the building';
  assert (select count(*) from public.faults) = 5, 'the test account sees faults';
end $$;

set test.uid = 'a0000000-0000-4000-8000-000000000003';
do $$ begin
  assert (select count(*) from public.buildings) = 1, 'a tenant sees the building';
  assert (select count(*) from public.faults) = 5, 'a tenant sees faults';
end $$;

-- A provider has no membership, so the building must be invisible to them.
set test.uid = 'a0000000-0000-4000-8000-000000000011';
do $$ begin
  assert (select count(*) from public.buildings) = 0, 'a provider sees no buildings';
  assert (select count(*) from public.faults) = 0, 'a provider sees no faults';
  assert (select count(*) from public.vendors where user_id = auth.uid()) = 1,
    'a provider sees their own profile';
end $$;

reset role;
select 'SEED CHECK PASSED' as result;
