-- KANISA CONNECT: Public Giving Staging catalog verification
--
-- READ ONLY. This script is standard PostgreSQL SQL for Supabase SQL Editor.
-- It uses SELECT statements only. It does not create, mutate, or expose donor
-- names, phone numbers, raw payment references, notes, contribution IDs, or
-- submission IDs.

select
  'public_giving_submissions table exists' as check_name,
  case when to_regclass('public.public_giving_submissions') is not null then 'PASS' else 'FAIL' end as status,
  jsonb_build_object(
    'resolved_table_oid', to_regclass('public.public_giving_submissions')::oid,
    'resolved_table_name', to_regclass('public.public_giving_submissions')::text
  ) as detail;

with target as (
  select to_regclass('public.public_giving_submissions')::oid as table_oid
),
expected(attnum, column_name, formatted_type, not_null, default_expr) as (
  values
    (1, 'id', 'uuid', true, 'gen_random_uuid()'),
    (2, 'church_id', 'uuid', true, null),
    (3, 'contribution_type', 'text', true, null),
    (4, 'amount', 'numeric', true, null),
    (5, 'currency', 'text', true, '''TZS''::text'),
    (6, 'donor_name', 'text', true, null),
    (7, 'phone', 'text', false, null),
    (8, 'payment_reference', 'text', false, null),
    (9, 'notes', 'text', false, null),
    (10, 'verification_status', 'text', true, '''pending''::text'),
    (11, 'reviewed_by', 'uuid', false, null),
    (12, 'reviewed_at', 'timestamp with time zone', false, null),
    (13, 'review_reason', 'text', false, null),
    (14, 'contribution_id', 'uuid', false, null),
    (15, 'created_at', 'timestamp with time zone', true, 'now()')
),
actual as (
  select
    a.attnum,
    a.attname as column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) as formatted_type,
    a.attnotnull as not_null,
    pg_catalog.pg_get_expr(d.adbin, d.adrelid) as default_expr
  from target t
  join pg_catalog.pg_attribute a on a.attrelid = t.table_oid
  left join pg_catalog.pg_attrdef d
    on d.adrelid = a.attrelid
   and d.adnum = a.attnum
  where a.attnum > 0
    and not a.attisdropped
)
select
  'public_giving_submissions column contract' as check_name,
  e.column_name,
  case
    when (select table_oid from target) is null then 'FAIL'
    when a.column_name is null then 'FAIL'
    when a.attnum = e.attnum
     and a.formatted_type = e.formatted_type
     and a.not_null = e.not_null
     and a.default_expr is not distinct from e.default_expr then 'PASS'
    else 'FAIL'
  end as status,
  jsonb_build_object(
    'expected', jsonb_build_object(
      'attnum', e.attnum,
      'type', e.formatted_type,
      'not_null', e.not_null,
      'default', e.default_expr
    ),
    'actual', jsonb_build_object(
      'attnum', a.attnum,
      'type', a.formatted_type,
      'not_null', a.not_null,
      'default', a.default_expr
    )
  ) as detail
from expected e
left join actual a using (column_name)
order by e.attnum;

with target as (
  select to_regclass('public.public_giving_submissions')::oid as table_oid
),
actual_extra as (
  select a.attname as column_name
  from target t
  join pg_catalog.pg_attribute a on a.attrelid = t.table_oid
  where a.attnum > 0
    and not a.attisdropped
    and a.attname not in (
      'id', 'church_id', 'contribution_type', 'amount', 'currency',
      'donor_name', 'phone', 'payment_reference', 'notes',
      'verification_status', 'reviewed_by', 'reviewed_at',
      'review_reason', 'contribution_id', 'created_at'
    )
)
select
  'public_giving_submissions unexpected columns' as check_name,
  case
    when (select table_oid from target) is null then 'FAIL'
    when count(*) = 0 then 'PASS'
    else 'MANUAL_REVIEW'
  end as status,
  jsonb_build_object(
    'unexpected_column_count', count(*),
    'columns', coalesce(jsonb_agg(column_name order by column_name), '[]'::jsonb)
  ) as detail
from actual_extra;

with target as (
  select to_regclass('public.public_giving_submissions')::oid as table_oid
),
att as (
  select a.attname, a.attnum
  from target t
  join pg_catalog.pg_attribute a on a.attrelid = t.table_oid
  where a.attnum > 0
    and not a.attisdropped
),
checks(check_name, status, detail) as (
  select
    'primary key on id',
    case when exists (
      select 1
      from target t
      join pg_catalog.pg_constraint c on c.conrelid = t.table_oid
      where c.contype = 'p'
        and c.conkey = array[(select attnum from att where attname = 'id')]::smallint[]
    ) then 'PASS' else 'FAIL' end,
    null::jsonb
  union all
  select
    'foreign key church_id references public.churches(id)',
    case when exists (
      select 1
      from target t
      join pg_catalog.pg_constraint c on c.conrelid = t.table_oid
      where c.contype = 'f'
        and c.conkey = array[(select attnum from att where attname = 'church_id')]::smallint[]
        and c.confrelid = to_regclass('public.churches')::oid
    ) then 'PASS' else 'FAIL' end,
    null::jsonb
  union all
  select
    'foreign key reviewed_by references auth.users(id)',
    case when exists (
      select 1
      from target t
      join pg_catalog.pg_constraint c on c.conrelid = t.table_oid
      where c.contype = 'f'
        and c.conkey = array[(select attnum from att where attname = 'reviewed_by')]::smallint[]
        and c.confrelid = to_regclass('auth.users')::oid
    ) then 'PASS' else 'FAIL' end,
    null::jsonb
  union all
  select
    'foreign key contribution_id references public.contributions(id)',
    case when exists (
      select 1
      from target t
      join pg_catalog.pg_constraint c on c.conrelid = t.table_oid
      where c.contype = 'f'
        and c.conkey = array[(select attnum from att where attname = 'contribution_id')]::smallint[]
        and c.confrelid = to_regclass('public.contributions')::oid
    ) then 'PASS' else 'FAIL' end,
    null::jsonb
  union all
  select
    'unique contribution_id constraint',
    case when exists (
      select 1
      from target t
      join pg_catalog.pg_constraint c on c.conrelid = t.table_oid
      where c.contype = 'u'
        and c.conkey = array[(select attnum from att where attname = 'contribution_id')]::smallint[]
    ) then 'PASS' else 'FAIL' end,
    null::jsonb
  union all
  select
    'amount positive and capped check',
    case when count(*) = 0 then 'FAIL' else 'MANUAL_REVIEW' end,
    jsonb_build_object(
      'note', 'Catalog confirms candidate CHECK constraint presence only; manually review expression semantics.',
      'expressions', coalesce(jsonb_agg(pg_catalog.pg_get_expr(c.conbin, c.conrelid) order by c.conname), '[]'::jsonb)
    )
    from target t
    join pg_catalog.pg_constraint c on c.conrelid = t.table_oid
    where c.contype = 'c'
      and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%amount%'
      and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%100000000%'
  union all
  select
    'currency TZS check',
    case when count(*) = 0 then 'FAIL' else 'MANUAL_REVIEW' end,
    jsonb_build_object(
      'note', 'Catalog confirms candidate CHECK constraint presence only; manually review expression semantics.',
      'expressions', coalesce(jsonb_agg(pg_catalog.pg_get_expr(c.conbin, c.conrelid) order by c.conname), '[]'::jsonb)
    )
    from target t
    join pg_catalog.pg_constraint c on c.conrelid = t.table_oid
    where c.contype = 'c'
      and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%currency%'
      and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%TZS%'
  union all
  select
    'donor_name minimum length check',
    case when count(*) = 0 then 'FAIL' else 'MANUAL_REVIEW' end,
    jsonb_build_object(
      'note', 'Catalog confirms candidate CHECK constraint presence only; manually review expression semantics.',
      'expressions', coalesce(jsonb_agg(pg_catalog.pg_get_expr(c.conbin, c.conrelid) order by c.conname), '[]'::jsonb)
    )
    from target t
    join pg_catalog.pg_constraint c on c.conrelid = t.table_oid
    where c.contype = 'c'
      and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%donor_name%'
      and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%2%'
  union all
  select
    'verification_status enum check',
    case when count(*) = 0 then 'FAIL' else 'MANUAL_REVIEW' end,
    jsonb_build_object(
      'note', 'Catalog confirms candidate CHECK constraint presence only; manually review expression semantics.',
      'expressions', coalesce(jsonb_agg(pg_catalog.pg_get_expr(c.conbin, c.conrelid) order by c.conname), '[]'::jsonb)
    )
    from target t
    join pg_catalog.pg_constraint c on c.conrelid = t.table_oid
    where c.contype = 'c'
      and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%verification_status%'
      and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%pending%'
      and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%approved%'
      and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%rejected%'
  union all
  select
    'payment reference not blank check',
    case when count(*) = 0 then 'FAIL' else 'MANUAL_REVIEW' end,
    jsonb_build_object(
      'note', 'Catalog confirms named CHECK constraint presence only; manually review expression semantics.',
      'expressions', coalesce(jsonb_agg(pg_catalog.pg_get_expr(c.conbin, c.conrelid) order by c.conname), '[]'::jsonb)
    )
    from target t
    join pg_catalog.pg_constraint c on c.conrelid = t.table_oid
    where c.contype = 'c'
      and c.conname = 'public_giving_reference_not_blank'
      and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%payment_reference%'
  union all
  select
    'review consistency check',
    case when count(*) = 0 then 'FAIL' else 'MANUAL_REVIEW' end,
    jsonb_build_object(
      'note', 'Catalog confirms named CHECK constraint presence only; manually review expression semantics.',
      'expressions', coalesce(jsonb_agg(pg_catalog.pg_get_expr(c.conbin, c.conrelid) order by c.conname), '[]'::jsonb)
    )
      from target t
      join pg_catalog.pg_constraint c on c.conrelid = t.table_oid
      where c.contype = 'c'
        and c.conname = 'public_giving_review_consistency'
        and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%verification_status%'
        and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%reviewed_by%'
        and pg_catalog.pg_get_expr(c.conbin, c.conrelid) like '%contribution_id%'
)
select
  'public_giving_submissions constraints' as section,
  check_name,
  case when (select table_oid from target) is null then 'FAIL' else status end as status,
  detail
from checks
order by check_name;

with expected(index_name, expected_unique, expected_table_oid, expected_predicate_fragments, expected_definition_fragments) as (
  values
    ('public_giving_submissions_reference_unique', true, to_regclass('public.public_giving_submissions')::oid, array['payment_reference IS NOT NULL']::text[], array['church_id', 'lower(btrim(payment_reference))']::text[]),
    ('public_giving_submissions_pending_idx', false, to_regclass('public.public_giving_submissions')::oid, array['verification_status = ''pending''::text']::text[], array['church_id', 'created_at DESC']::text[]),
    ('contributions_church_payment_reference_unique', true, to_regclass('public.contributions')::oid, array['payment_reference IS NOT NULL', 'btrim(payment_reference) <> ''''::text']::text[], array['church_id', 'lower(btrim(payment_reference))']::text[])
),
actual as (
  select
    i.relname as index_name,
    ix.indrelid as table_oid,
    ix.indisunique,
    ix.indisvalid,
    ix.indisready,
    pg_catalog.pg_get_expr(ix.indpred, ix.indrelid) as predicate_expr,
    pg_catalog.pg_get_indexdef(i.oid) as indexdef
  from pg_catalog.pg_class i
  join pg_catalog.pg_namespace n on n.oid = i.relnamespace
  join pg_catalog.pg_index ix on ix.indexrelid = i.oid
  where n.nspname = 'public'
    and i.relname in (
      'public_giving_submissions_reference_unique',
      'public_giving_submissions_pending_idx',
      'contributions_church_payment_reference_unique'
    )
)
select
  'Public Giving index contract' as check_name,
  e.index_name,
  case
    when e.expected_table_oid is null then 'FAIL'
    when a.index_name is null then 'FAIL'
    when a.table_oid = e.expected_table_oid
     and a.indisunique = e.expected_unique
     and a.indisvalid
     and a.indisready
     and not exists (
       select 1
       from unnest(e.expected_predicate_fragments) fragment
       where a.predicate_expr is null or position(fragment in a.predicate_expr) = 0
     )
     and not exists (
       select 1
       from unnest(e.expected_definition_fragments) fragment
       where a.indexdef is null or position(fragment in a.indexdef) = 0
      ) then 'MANUAL_REVIEW'
    else 'FAIL'
  end as status,
  jsonb_build_object(
    'note', 'Uniqueness, table association, validity, and readiness are structural checks. Predicate and expression fragments require manual semantic review.',
    'expected_unique', e.expected_unique,
    'expected_table_oid', e.expected_table_oid,
    'actual_table_oid', a.table_oid,
    'actual_unique', a.indisunique,
    'actual_valid', a.indisvalid,
    'actual_ready', a.indisready,
    'predicate_expr', a.predicate_expr,
    'indexdef', a.indexdef
  ) as detail
from expected e
left join actual a using (index_name)
order by e.index_name;

with target as (
  select to_regclass('public.public_giving_submissions')::oid as table_oid
)
select
  'public_giving_submissions RLS enabled' as check_name,
  case
    when t.table_oid is null then 'FAIL'
    when c.relrowsecurity then 'PASS'
    else 'FAIL'
  end as status,
  jsonb_build_object('rls_enabled', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity) as detail
from target t
left join pg_catalog.pg_class c on c.oid = t.table_oid;

select
  'public_giving_submissions policies' as check_name,
  case
    when to_regclass('public.public_giving_submissions') is null then 'FAIL'
    when count(*) = 0 then 'PASS'
    else 'MANUAL_REVIEW'
  end as status,
  jsonb_build_object(
    'expected_policy_count', 0,
    'actual_policy_count', count(*),
    'policies', coalesce(
      jsonb_agg(
        jsonb_build_object('policyname', policyname, 'cmd', cmd, 'roles', roles, 'qual', qual, 'with_check', with_check)
        order by policyname
      ),
      '[]'::jsonb
    )
  ) as detail
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename = 'public_giving_submissions';

with expected(function_name, signature_text, return_type, language_name, expected_search_path, required_fragments) as (
  values
    ('approve_public_giving_submission', 'public.approve_public_giving_submission(uuid,boolean)', 'jsonb', 'plpgsql', 'search_path=pg_catalog, public', array['public.has_church_feature_permission(', '''contributions''', '''approve''', '''create''', 'Payment must be independently verified before approval', 'Payment reference has already been recorded', 'FOR UPDATE']::text[]),
    ('get_public_giving_church', 'public.get_public_giving_church(text)', 'record', 'plpgsql', 'search_path=pg_catalog, public', array['public.is_public_giving_available(c.id)']::text[]),
    ('is_public_giving_available', 'public.is_public_giving_available(uuid)', 'boolean', 'sql', 'search_path=pg_catalog, public', array['pf.key = ''give''::text', 'pf.globally_enabled = true', 'cf.locked = false', 'subscription.plan = ANY (pf.available_plans)']::text[]),
    ('list_pending_public_giving_submissions', 'public.list_pending_public_giving_submissions(uuid)', 'record', 'plpgsql', 'search_path=pg_catalog, public', array['Authentication required', 'Permission denied', '''contributions''', '''approve''', 's.verification_status = ''pending''::text']::text[]),
    ('reject_public_giving_submission', 'public.reject_public_giving_submission(uuid,text)', 'jsonb', 'plpgsql', 'search_path=pg_catalog, public', array['FOR UPDATE', '''contributions''', '''approve''', 'Rejection reason must contain at least 5 characters', 'Rejection reason cannot exceed 1000 characters']::text[]),
    ('submit_public_contribution', 'public.submit_public_contribution(text,text,numeric,text,text,text,text)', 'jsonb', 'plpgsql', 'search_path=pg_catalog, public', array['public.get_public_giving_church(p_church_slug_or_id)', 'public.enforce_rate_limit(', '''public_contribution''', 'INSERT INTO public.public_giving_submissions', 'WHEN unique_violation THEN']::text[])
),
actual as (
  select
    e.function_name,
    e.signature_text,
    p.oid as function_oid,
    p.prosecdef,
    p.proconfig,
    pg_catalog.format_type(p.prorettype, null) as return_type,
    l.lanname as language_name,
    case when p.oid is null then null else pg_catalog.pg_get_functiondef(p.oid) end as functiondef
  from expected e
  left join pg_catalog.pg_proc p on p.oid = to_regprocedure(e.signature_text)::oid
  left join pg_catalog.pg_language l on l.oid = p.prolang
)
select
  'Public Giving RPC structural contract' as check_name,
  e.function_name,
  case
    when a.function_oid is null then 'FAIL'
    when a.prosecdef = true
     and e.expected_search_path = any(a.proconfig)
     and a.return_type = e.return_type
     and a.language_name = e.language_name then 'PASS'
    else 'FAIL'
  end as status,
  jsonb_build_object(
    'signature', e.signature_text,
    'function_oid', a.function_oid,
    'expected_return_type', e.return_type,
    'actual_return_type', a.return_type,
    'expected_language', e.language_name,
    'actual_language', a.language_name,
    'security_definer', a.prosecdef,
    'proconfig', a.proconfig
  ) as detail
from expected e
left join actual a using (function_name, signature_text)
order by e.function_name;

with expected(function_name, signature_text, required_fragments) as (
  values
    ('approve_public_giving_submission', 'public.approve_public_giving_submission(uuid,boolean)', array['public.has_church_feature_permission(', '''contributions''', '''approve''', '''create''', 'Payment must be independently verified before approval', 'Payment reference has already been recorded', 'FOR UPDATE']::text[]),
    ('get_public_giving_church', 'public.get_public_giving_church(text)', array['public.is_public_giving_available(c.id)']::text[]),
    ('is_public_giving_available', 'public.is_public_giving_available(uuid)', array['pf.key = ''give''::text', 'pf.globally_enabled = true', 'cf.locked = false', 'subscription.plan = ANY (pf.available_plans)']::text[]),
    ('list_pending_public_giving_submissions', 'public.list_pending_public_giving_submissions(uuid)', array['Authentication required', 'Permission denied', '''contributions''', '''approve''', 's.verification_status = ''pending''::text']::text[]),
    ('reject_public_giving_submission', 'public.reject_public_giving_submission(uuid,text)', array['FOR UPDATE', '''contributions''', '''approve''', 'Rejection reason must contain at least 5 characters', 'Rejection reason cannot exceed 1000 characters']::text[]),
    ('submit_public_contribution', 'public.submit_public_contribution(text,text,numeric,text,text,text,text)', array['public.get_public_giving_church(p_church_slug_or_id)', 'public.enforce_rate_limit(', '''public_contribution''', 'INSERT INTO public.public_giving_submissions', 'WHEN unique_violation THEN']::text[])
),
actual as (
  select
    e.function_name,
    e.signature_text,
    p.oid as function_oid,
    case when p.oid is null then null else pg_catalog.pg_get_functiondef(p.oid) end as functiondef
  from expected e
  left join pg_catalog.pg_proc p on p.oid = to_regprocedure(e.signature_text)::oid
)
select
  'Public Giving RPC definition fragments' as check_name,
  e.function_name,
  case
    when a.function_oid is null then 'FAIL'
    when exists (
      select 1
      from unnest(e.required_fragments) fragment
      where a.functiondef is null or position(fragment in a.functiondef) = 0
    ) then 'FAIL'
    else 'MANUAL_REVIEW'
  end as status,
  jsonb_build_object(
    'signature', e.signature_text,
    'note', 'Fragment presence is a drift signal only; perform manual review for exact semantic equivalence.',
    'missing_required_fragments', coalesce(
      (
        select jsonb_agg(fragment)
        from unnest(e.required_fragments) fragment
        where a.functiondef is null or position(fragment in a.functiondef) = 0
      ),
      '[]'::jsonb
    )
  ) as detail
from expected e
left join actual a using (function_name, signature_text)
order by e.function_name;

with expected(function_name, signature_text, anon_execute, authenticated_execute, service_role_execute, public_execute) as (
  values
    ('approve_public_giving_submission', 'public.approve_public_giving_submission(uuid,boolean)', false, true, true, false),
    ('get_public_giving_church', 'public.get_public_giving_church(text)', true, true, true, false),
    ('is_public_giving_available', 'public.is_public_giving_available(uuid)', false, false, true, false),
    ('list_pending_public_giving_submissions', 'public.list_pending_public_giving_submissions(uuid)', false, true, true, false),
    ('reject_public_giving_submission', 'public.reject_public_giving_submission(uuid,text)', false, true, true, false),
    ('submit_public_contribution', 'public.submit_public_contribution(text,text,numeric,text,text,text,text)', true, true, true, false)
),
actual as (
  select e.*, to_regprocedure(e.signature_text)::oid as function_oid
  from expected e
),
resolved_roles(role_name, role_oid) as (
  values
    ('anon', to_regrole('anon')::oid),
    ('authenticated', to_regrole('authenticated')::oid),
    ('service_role', to_regrole('service_role')::oid)
)
select
  'Public Giving RPC EXECUTE privileges' as check_name,
  function_name,
  case
    when function_oid is null then 'FAIL'
    when exists (select 1 from resolved_roles where role_oid is null) then 'FAIL'
    when coalesce(has_function_privilege((select role_oid from resolved_roles where role_name = 'anon'), function_oid, 'EXECUTE'), false) = anon_execute
     and coalesce(has_function_privilege((select role_oid from resolved_roles where role_name = 'authenticated'), function_oid, 'EXECUTE'), false) = authenticated_execute
     and coalesce(has_function_privilege((select role_oid from resolved_roles where role_name = 'service_role'), function_oid, 'EXECUTE'), false) = service_role_execute
     and exists (
       select 1
       from pg_catalog.pg_proc p
       cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
       where p.oid = function_oid
         and acl.grantee = 0::oid
         and acl.privilege_type = 'EXECUTE'
     ) = public_execute then 'PASS'
    else 'FAIL'
  end as status,
  jsonb_build_object(
    'function_oid', function_oid,
    'expected', jsonb_build_object('anon', anon_execute, 'authenticated', authenticated_execute, 'service_role', service_role_execute, 'public', public_execute),
    'resolved_roles', (
      select jsonb_object_agg(role_name, role_oid is not null order by role_name)
      from resolved_roles
    ),
    'actual', jsonb_build_object(
      'anon', case
        when function_oid is null or (select role_oid from resolved_roles where role_name = 'anon') is null then null
        else has_function_privilege((select role_oid from resolved_roles where role_name = 'anon'), function_oid, 'EXECUTE')
      end,
      'authenticated', case
        when function_oid is null or (select role_oid from resolved_roles where role_name = 'authenticated') is null then null
        else has_function_privilege((select role_oid from resolved_roles where role_name = 'authenticated'), function_oid, 'EXECUTE')
      end,
      'service_role', case
        when function_oid is null or (select role_oid from resolved_roles where role_name = 'service_role') is null then null
        else has_function_privilege((select role_oid from resolved_roles where role_name = 'service_role'), function_oid, 'EXECUTE')
      end,
      'public', case
        when function_oid is null then null
        else exists (
          select 1
          from pg_catalog.pg_proc p
          cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
          where p.oid = function_oid
            and acl.grantee = 0::oid
            and acl.privilege_type = 'EXECUTE'
        )
      end
    )
  ) as detail
from actual
order by function_name;

with expected(role_name, privilege_type, expected_allowed) as (
  values
    ('anon', 'SELECT', false),
    ('anon', 'INSERT', false),
    ('anon', 'UPDATE', false),
    ('anon', 'DELETE', false),
    ('authenticated', 'SELECT', false),
    ('authenticated', 'INSERT', false),
    ('authenticated', 'UPDATE', false),
    ('authenticated', 'DELETE', false),
    ('service_role', 'SELECT', true),
    ('service_role', 'INSERT', true),
    ('service_role', 'UPDATE', true),
    ('service_role', 'DELETE', true),
    ('public', 'SELECT', false),
    ('public', 'INSERT', false),
    ('public', 'UPDATE', false),
    ('public', 'DELETE', false)
),
target as (
  select to_regclass('public.public_giving_submissions')::oid as table_oid
),
resolved_roles(role_name, role_oid) as (
  values
    ('anon', to_regrole('anon')::oid),
    ('authenticated', to_regrole('authenticated')::oid),
    ('service_role', to_regrole('service_role')::oid)
)
select
  'public_giving_submissions direct table privileges' as check_name,
  e.role_name,
  e.privilege_type,
  case
    when t.table_oid is null then 'FAIL'
    when e.role_name <> 'public' and rr.role_oid is null then 'FAIL'
    when e.role_name = 'public'
     and exists (
       select 1
       from pg_catalog.pg_class c
       cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
       where c.oid = t.table_oid
         and acl.grantee = 0::oid
         and acl.privilege_type = e.privilege_type
     ) = e.expected_allowed then 'PASS'
    when e.role_name <> 'public'
     and coalesce(has_table_privilege(rr.role_oid, t.table_oid, e.privilege_type), false) = e.expected_allowed then 'PASS'
    else 'FAIL'
  end as status,
  jsonb_build_object(
    'table_oid', t.table_oid,
    'expected_allowed', e.expected_allowed,
    'role_resolved', case when e.role_name = 'public' then true else rr.role_oid is not null end,
    'actual_allowed', case
      when t.table_oid is null then null
      when e.role_name = 'public' then exists (
        select 1
        from pg_catalog.pg_class c
        cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) acl
        where c.oid = t.table_oid
          and acl.grantee = 0::oid
          and acl.privilege_type = e.privilege_type
      )
      when rr.role_oid is null then null
      else has_table_privilege(rr.role_oid, t.table_oid, e.privilege_type)
    end
  ) as detail
from expected e
cross join target t
left join resolved_roles rr on rr.role_name = e.role_name
order by e.role_name, e.privilege_type;

with target as (
  select to_regclass('public.contributions')::oid as table_oid
),
required_columns(column_name) as (
  values ('church_id'), ('payment_reference')
),
missing_columns as (
  select rc.column_name
  from required_columns rc
  cross join target t
  where t.table_oid is not null
    and not exists (
      select 1
      from pg_catalog.pg_attribute a
      where a.attrelid = t.table_oid
        and a.attname = rc.column_name
        and a.attnum > 0
        and not a.attisdropped
    )
)
select
  'confirmed contribution duplicate normalized payment references readiness' as check_name,
  case
    when (select table_oid from target) is null then 'FAIL'
    when exists (select 1 from missing_columns) then 'FAIL'
    else 'MANUAL_REVIEW'
  end as status,
  jsonb_build_object(
    'contributions_table_oid', (select table_oid from target),
    'missing_required_columns', coalesce((select jsonb_agg(column_name order by column_name) from missing_columns), '[]'::jsonb),
    'operator_action', 'If this row is MANUAL_REVIEW, run supabase/tests/public_giving_staging_duplicate_reference_check.sql in the Staging SQL Editor to perform the aggregate-only duplicate scan.',
    'note', 'Main catalog verification does not read public.contributions data, so missing tables fail safely here.'
  ) as detail
;

select
  'manual review reminder' as check_name,
  'MANUAL_REVIEW' as status,
  jsonb_build_object(
    'items', jsonb_build_array(
      'Review MANUAL_REVIEW rows before applying the migration.',
      'If any FAIL result appears, stop and investigate before Staging writes.',
      'This script is read-only and does not prove runtime behavior; run focused local SQL tests separately.'
    )
  ) as detail;
