-- KANISA CONNECT STAGING LOAD DATA
-- MANUAL, DESTRUCTIVE-TO-STAGING-ONLY OPERATION. This file is never run by migrations.
-- Before running, confirm you are linked to staging with: supabase status
-- This script creates no auth.users. Create test login accounts separately, then link them
-- to seeded member rows if authenticated test journeys are required.

begin;

create temporary table staging_churches (id uuid primary key) on commit drop;
create temporary table staging_members (id uuid primary key, church_id uuid not null) on commit drop;

with inserted as (
  insert into public.churches (name, email, phone, address, status)
  select format('Staging Parish %s', lpad(n::text, 3, '0')), format('office%03s@staging.kanisa.test', n),
    format('+255 7%08s', n), format('Ward %s, Dar es Salaam', ((n - 1) % 20) + 1), 'active'
  from generate_series(1, 100) n
  returning id
)
insert into staging_churches (id) select id from inserted;

insert into public.contribution_categories (church_id, name, description, is_special)
select c.id, category.name, 'Staging seed category', category.is_special
from staging_churches c
cross join (values ('Tithe', false), ('Offering', false), ('Thanksgiving', true), ('Building Fund', true)) as category(name, is_special);

with inserted as (
  insert into public.members (church_id, full_name, email, phone, gender, status, date_of_birth, date_joined)
  select c.id, format('%s %s', first_name, last_name), format('member%05s@staging.kanisa.test', n), format('+255 7%08s', n),
    case when n % 2 = 0 then 'female'::public.gender_type else 'male'::public.gender_type end, 'active',
    current_date - ((18 + (n % 60)) * interval '1 year') - ((n % 365) * interval '1 day'), current_date - ((n % 3650) * interval '1 day')
  from generate_series(1, 10000) n
  join (select id, row_number() over (order by id) as row_num from staging_churches) c on c.row_num = 1 + ((n - 1) % 100)
  cross join lateral (select (array['Amina','Baraka','Clara','Daniel','Esther','Francis','Grace','Hassan','Irene','Joseph'])[((n - 1) % 10) + 1] first_name) f
  cross join lateral (select (array['Mashauri','Mwangi','Nyerere','Kweka','Mrema','Said','Mushi','John','Kilonzo','Mwaniki'])[((n - 1) % 10) + 1] last_name) l
  returning id, church_id
)
insert into staging_members (id, church_id) select id, church_id from inserted;

insert into public.contributions (church_id, member_id, category_id, amount, currency, donor_name, payment_reference, date)
select m.church_id, m.id,
  (select cc.id from public.contribution_categories cc where cc.church_id = m.church_id order by cc.name offset (n % 4) limit 1),
  (5000 + (n % 100) * 2500)::numeric(12,2), 'TZS', format('Staging donor %s', n),
  format('STG-CON-%s', lpad(n::text, 6, '0')), current_date - (n % 730)
from generate_series(1, 50000) n
join (select id, church_id, row_number() over (order by id) as row_num from staging_members) m on m.row_num = 1 + ((n - 1) % 10000);

insert into public.prayer_requests (church_id, member_id, requester_name, request, status, is_anonymous, created_at)
select m.church_id, m.id, format('Member %s', n),
  (array['Prayer for family health and peace.','Prayer for work and provision.','Prayer for studies and wisdom.','Prayer of thanksgiving for blessings received.'])[((n - 1) % 4) + 1],
  'active', n % 7 = 0, now() - ((n % 365) * interval '1 day')
from generate_series(1, 20000) n
join (select id, church_id, row_number() over (order by id) as row_num from staging_members) m on m.row_num = 1 + ((n - 1) % 10000);

insert into public.mass_intentions (church_id, requester_name, intention_type, message, offering_amount, preferred_date, status, created_at)
select m.church_id, format('Member %s', n),
  (array['thanksgiving','requiem','healing','special intention'])[((n - 1) % 4) + 1],
  'Staging mass intention generated for realistic load testing.', (10000 + (n % 30) * 5000)::numeric(10,2),
  current_date + (n % 90), 'pending', now() - ((n % 365) * interval '1 day')
from generate_series(1, 20000) n
join (select id, church_id, row_number() over (order by id) as row_num from staging_members) m on m.row_num = 1 + ((n - 1) % 10000);

insert into public.announcements (church_id, title, content, is_published, published_at, created_at)
select c.id, format('Staging community announcement %s', n),
  'This is synthetic staging content used only to validate list, search, and feed performance.', true,
  now() - ((n % 365) * interval '1 day'), now() - ((n % 365) * interval '1 day')
from generate_series(1, 5000) n
join (select id, row_number() over (order by id) as row_num from staging_churches) c on c.row_num = 1 + ((n - 1) % 100);

insert into public.analytics_snapshots (church_id, snapshot_type, period_start, period_end, payload, generated_at)
select c.id, 'monthly_overview', date_trunc('month', now()) - (n * interval '1 month'), date_trunc('month', now()) - ((n - 1) * interval '1 month'),
  jsonb_build_object('member_count', 100, 'contribution_total', 1250000, 'seed', true), now()
from staging_churches c cross join generate_series(1, 12) n;

commit;

-- Expected totals from an empty staging project: 100 churches, 10,000 members,
-- 50,000 contributions, 20,000 prayer requests, 20,000 mass intentions,
-- 5,000 announcements, 1,200 analytics snapshots.
