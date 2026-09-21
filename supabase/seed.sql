-- Demo data for local development, applied automatically by `supabase db reset`.
--
-- The point is to make the app testable the moment it starts: a populated
-- building, a committee account to sign in as, and something to look at on every
-- screen — including one pending tenant so the approval flow has a subject and
-- one unpaid apartment so the budget screen is not all green.
--
-- Every account uses the password `comot1234`.
--
-- IDs are fixed rather than generated so that docs can name them and so re-running
-- a reset produces byte-identical data.
--
-- Never load this into a real project: it writes directly to auth.users, which
-- bypasses sign-up, and the passwords are public.

-- ============================================================
-- Accounts. public.profiles rows are created by the
-- on_auth_user_created trigger, so they are not inserted here.
-- ============================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'dana@comot.test', crypt('comot1234', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{"full_name":"דנה כהן"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'yossi@comot.test', crypt('comot1234', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{"full_name":"יוסי לוי"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'maya@comot.test', crypt('comot1234', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{"full_name":"מאיה בר"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000004',
   'authenticated', 'authenticated', 'avi@comot.test', crypt('comot1234', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{"full_name":"אבי מזרחי"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000005',
   'authenticated', 'authenticated', 'eli@comot.test', crypt('comot1234', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{"full_name":"אלי אינסטלטור"}', now(), now());

-- GoTrue resolves a password login through auth.identities, so every account needs one.
insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select id, id::text, 'email',
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       now(), now(), now()
from auth.users;

update public.profiles set phone = '050-1234567', preferred_language = 'he';

-- ============================================================
-- Building and apartments
-- ============================================================

insert into public.buildings (
  id, name, address, city, floors, apartments_count,
  invite_code, fee_amount, fee_due_day, fee_frequency, created_by
)
values (
  'b0000000-0000-4000-8000-000000000001',
  'הברושים 12', 'רחוב הברושים 12', 'תל אביב', 4, 8,
  'comot123', 250.00, 10, 'monthly', 'a0000000-0000-4000-8000-000000000001'
);

-- Two apartments per floor across four floors.
insert into public.apartments (id, building_id, number, floor)
select
  ('c0000000-0000-4000-8000-00000000000' || n)::uuid,
  'b0000000-0000-4000-8000-000000000001',
  n::text,
  ((n - 1) / 2) + 1
from generate_series(1, 8) as n;

-- ============================================================
-- Memberships. Avi is left pending so the committee has a request to act on.
-- ============================================================

insert into public.memberships (building_id, user_id, apartment_id, role, tenant_type, status)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'committee', 'owner', 'active'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
   'c0000000-0000-4000-8000-000000000002', 'tenant', 'owner', 'active'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   'c0000000-0000-4000-8000-000000000003', 'tenant', 'renter', 'active'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004',
   'c0000000-0000-4000-8000-000000000004', 'tenant', 'owner', 'pending');

-- ============================================================
-- Chat: a building-wide channel with a short conversation
-- ============================================================

insert into public.conversations (id, building_id, kind, name, created_by)
values ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
        'channel', 'כללי', 'a0000000-0000-4000-8000-000000000001');

insert into public.conversation_members (conversation_id, user_id)
values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003');

insert into public.messages (conversation_id, building_id, sender_id, body, created_at)
values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'שלום לכולם! אסיפת דיירים ביום שלישי הקרוב.', now() - interval '2 days'),
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'מעולה, אהיה שם.', now() - interval '2 days' + interval '12 minutes'),
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003', 'אפשר להוסיף את נושא החניה?', now() - interval '1 day');

-- ============================================================
-- Faults, one open and one already in progress
-- ============================================================

insert into public.faults (id, building_id, reporter_id, category, title, description, location, status, created_at)
values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'elevator', 'המעלית נתקעת בקומה 3',
   'המעלית עוצרת בין קומות ודלתותיה נפתחות באיחור.', 'לובי', 'reported', now() - interval '3 days'),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003', 'plumbing', 'נזילה בחניון',
   'נזילת מים מהצינור בתקרת החניון.', 'חניון', 'in_progress', now() - interval '6 days');

insert into public.fault_updates (fault_id, building_id, author_id, note, status, created_at)
values
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'הוזמן אינסטלטור, מטפל השבוע.', 'in_progress', now() - interval '4 days');

-- ============================================================
-- Events, plus an open poll attached to the upcoming meeting
-- ============================================================

insert into public.events (id, building_id, kind, title, description, location, starts_at, recurrence, created_by)
values
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'meeting', 'אסיפת דיירים', 'סיכום שנה ותקציב לשנה הבאה.', 'לובי הבניין',
   now() + interval '4 days', 'none', 'a0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'payment', 'גביית דמי ועד', null, null,
   date_trunc('month', now()) + interval '9 days', 'monthly', 'a0000000-0000-4000-8000-000000000001');

insert into public.polls (id, building_id, event_id, question, is_anonymous, created_by, created_at)
values ('11110000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000001', 'האם לצבוע את חדר המדרגות?', true,
        'a0000000-0000-4000-8000-000000000001', now() - interval '1 day');

insert into public.poll_options (id, poll_id, building_id, label, position)
values
  ('22220000-0000-4000-8000-000000000001', '11110000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', 'כן, בהקדם', 1),
  ('22220000-0000-4000-8000-000000000002', '11110000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', 'כן, בשנה הבאה', 2),
  ('22220000-0000-4000-8000-000000000003', '11110000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', 'לא', 3);

-- Dana has not voted, so the poll still shows as actionable when signed in as her.
insert into public.poll_votes (poll_id, option_id, user_id, building_id)
values
  ('11110000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001'),
  ('11110000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001');

-- ============================================================
-- Budget: collected fees plus expenses, leaving a visible balance
-- ============================================================

insert into public.budget_entries (building_id, kind, category, title, amount, entry_date, created_by)
values
  ('b0000000-0000-4000-8000-000000000001', 'income', 'fee', 'דמי ועד — חודש קודם', 1750.00,
   current_date - 30, 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000001', 'expense', 'cleaning', 'חברת ניקיון', 600.00,
   current_date - 25, 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000001', 'expense', 'elevator', 'תחזוקת מעלית', 450.00,
   current_date - 20, 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000001', 'expense', 'electricity', 'חשמל לובי', 180.00,
   current_date - 10, 'a0000000-0000-4000-8000-000000000001');

-- Apartments 1-3 have paid this period; the rest have not, so the fee screen has
-- both states to show.
insert into public.fee_payments (building_id, apartment_id, period, amount, marked_by)
select 'b0000000-0000-4000-8000-000000000001',
       ('c0000000-0000-4000-8000-00000000000' || n)::uuid,
       to_char(now(), 'YYYY-MM'), 250.00,
       'a0000000-0000-4000-8000-000000000001'
from generate_series(1, 3) as n;

-- ============================================================
-- Vendor marketplace: Eli signed up as a plumber, approved for this building
-- ============================================================

insert into public.vendors (id, user_id, business_name, categories, city, phone, about)
values ('33330000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005',
        'אלי אינסטלציה', array['plumbing', 'general'], 'תל אביב', '050-7654321',
        'אינסטלטור עם 15 שנות ניסיון, זמין לקריאות דחופות.');

insert into public.building_vendors (building_id, vendor_id, added_by)
values ('b0000000-0000-4000-8000-000000000001', '33330000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000001');
