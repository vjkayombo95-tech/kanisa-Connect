-- Forward-only follow-up: keep optional source identifiers catalog-derived so
-- plpgsql_check does not constant-fold guarded dynamic SQL for absent tables.

create or replace function public._count_church_admin_pending_source(
  _relation regclass,
  _church_id uuid,
  _required_columns text[],
  _predicate_key text
)
returns integer
language plpgsql
stable
set search_path = pg_catalog, pg_temp
as $$
declare
  v_schema_name name;
  v_relation_name name;
  v_predicate text;
  v_count integer := 0;
begin
  if _relation is null then
    return 0;
  end if;

  if not (
    select count(*) = pg_catalog.cardinality(_required_columns)
    from pg_catalog.pg_attribute a
    where a.attrelid = _relation
      and a.attnum > 0
      and not a.attisdropped
      and a.attname::text = any(_required_columns)
  ) then
    return 0;
  end if;

  select n.nspname, c.relname
  into v_schema_name, v_relation_name
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where c.oid = _relation;

  v_predicate := case _predicate_key
    when 'events' then 'coalesce(status, ''submitted'') in (''submitted'', ''under_review'')'
    when 'sacraments' then 'coalesce(status, ''planned'') in (''planned'', ''preparation'')'
    when 'mass_intentions' then '(coalesce(status, ''pending'') = ''pending'' or coalesce(payment_status, ''pending'') in (''pending'', ''unpaid'', ''submitted''))'
    when 'pending' then 'coalesce(status, ''pending'') = ''pending'''
    when 'invites' then 'coalesce(status, ''pending'') = ''pending'' and coalesce(used, false) = false'
    when 'announcements' then 'archived_at is null and coalesce(is_published, false) = false and coalesce(status, ''draft'') in (''draft'', ''scheduled'')'
    when 'membership' then 'coalesce(status, ''pending'') in (''pending'', ''submitted'')'
    when 'volunteer' then 'coalesce(status, ''pending'') in (''pending'', ''submitted'')'
    else null
  end;

  if v_schema_name is null or v_relation_name is null or v_predicate is null then
    return 0;
  end if;

  execute pg_catalog.format(
    'select count(*)::integer from %I.%I where church_id = $1 and %s',
    v_schema_name,
    v_relation_name,
    v_predicate
  ) into v_count using _church_id;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public._count_church_admin_pending_source(regclass, uuid, text[], text)
from public, anon, authenticated;

create or replace function public._count_church_admin_pending_pledge_payments(
  _payment_relation regclass,
  _pledge_relation regclass,
  _church_id uuid
)
returns integer
language plpgsql
stable
set search_path = pg_catalog, pg_temp
as $$
declare
  v_payment_schema name;
  v_payment_table name;
  v_pledge_schema name;
  v_pledge_table name;
  v_count integer := 0;
begin
  if _payment_relation is null or _pledge_relation is null then
    return 0;
  end if;

  if not (
    select count(*) = 2
    from pg_catalog.pg_attribute a
    where a.attrelid = _payment_relation
      and a.attnum > 0
      and not a.attisdropped
      and a.attname::text = any(array['pledge_id', 'verification_status'])
  ) or not (
    select count(*) = 2
    from pg_catalog.pg_attribute a
    where a.attrelid = _pledge_relation
      and a.attnum > 0
      and not a.attisdropped
      and a.attname::text = any(array['id', 'church_id'])
  ) then
    return 0;
  end if;

  select n.nspname, c.relname
  into v_payment_schema, v_payment_table
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where c.oid = _payment_relation;

  select n.nspname, c.relname
  into v_pledge_schema, v_pledge_table
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where c.oid = _pledge_relation;

  execute pg_catalog.format(
    'select count(*)::integer from %I.%I pp join %I.%I p on p.id = pp.pledge_id where p.church_id = $1 and coalesce(pp.verification_status, ''pending'') = ''pending''',
    v_payment_schema, v_payment_table, v_pledge_schema, v_pledge_table
  ) into v_count using _church_id;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public._count_church_admin_pending_pledge_payments(regclass, regclass, uuid)
from public, anon, authenticated;

create or replace function public.get_church_admin_pending_counts(_church_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_relation regclass;
  v_first_membership_relation oid := null;
  v_first_volunteer_relation oid := null;
  v_events integer := 0;
  v_sacraments integer := 0;
  v_mass_intentions integer := 0;
  v_prayer_requests integer := 0;
  v_community_help integer := 0;
  v_invitations integer := 0;
  v_announcements integer := 0;
  v_payments integer := 0;
  v_memberships integer := 0;
  v_volunteers integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if _church_id is null then
    raise exception 'Church is required' using errcode = '22023';
  end if;
  if not (
    public.can_manage_church_roles(auth.uid(), _church_id)
    or public.can_manage_church_workspace(auth.uid(), _church_id)
    or public.is_platform_super_admin(auth.uid())
    or public.is_super_admin(auth.uid())
  ) then
    raise exception 'You do not have permission to view pending approvals for this church'
      using errcode = '42501';
  end if;

  v_events := public._count_church_admin_pending_source(
    pg_catalog.to_regclass('public.event_requests'), _church_id,
    array['church_id', 'status'], 'events');
  v_sacraments := public._count_church_admin_pending_source(
    pg_catalog.to_regclass('public.sacramental_records'), _church_id,
    array['church_id', 'status'], 'sacraments');
  v_mass_intentions := public._count_church_admin_pending_source(
    pg_catalog.to_regclass('public.mass_intentions'), _church_id,
    array['church_id', 'status', 'payment_status'], 'mass_intentions');
  v_prayer_requests := public._count_church_admin_pending_source(
    pg_catalog.to_regclass('public.prayer_requests'), _church_id,
    array['church_id', 'status'], 'pending');
  v_community_help := public._count_church_admin_pending_source(
    pg_catalog.to_regclass('public.community_help_requests'), _church_id,
    array['church_id', 'status'], 'pending');
  v_invitations := public._count_church_admin_pending_source(
    pg_catalog.to_regclass('public.invitations'), _church_id,
    array['church_id', 'status'], 'pending');
  v_invitations := v_invitations + public._count_church_admin_pending_source(
    pg_catalog.to_regclass('public.invites'), _church_id,
    array['church_id', 'status', 'used'], 'invites');
  v_announcements := public._count_church_admin_pending_source(
    pg_catalog.to_regclass('public.announcements'), _church_id,
    array['church_id', 'archived_at', 'is_published', 'status'], 'announcements');
  v_payments := public._count_church_admin_pending_source(
    pg_catalog.to_regclass('public.event_registration_payments'), _church_id,
    array['church_id', 'status'], 'pending');

  v_payments := v_payments + public._count_church_admin_pending_pledge_payments(
    pg_catalog.to_regclass('public.pledge_payments'),
    pg_catalog.to_regclass('public.pledges'),
    _church_id
  );

  -- Optional membership sources are intentionally independent.
  v_relation := pg_catalog.to_regclass('public.community_join_requests');
  if v_relation is not null then
    v_memberships := v_memberships + public._count_church_admin_pending_source(
      v_relation, _church_id, array['church_id', 'status'], 'membership');
    v_first_membership_relation := v_relation::oid;
  end if;

  v_relation := pg_catalog.to_regclass('public.community_membership_requests');
  if v_relation is not null and v_relation::oid is distinct from v_first_membership_relation then
    v_memberships := v_memberships + public._count_church_admin_pending_source(
      v_relation, _church_id, array['church_id', 'status'], 'membership');
  end if;

  -- Optional volunteer sources are intentionally independent.
  v_relation := pg_catalog.to_regclass('public.ministry_join_requests');
  if v_relation is not null then
    v_volunteers := v_volunteers + public._count_church_admin_pending_source(
      v_relation, _church_id, array['church_id', 'status'], 'pending');
    v_first_volunteer_relation := v_relation::oid;
  end if;

  v_relation := pg_catalog.to_regclass('public.volunteer_requests');
  if v_relation is not null and v_relation::oid is distinct from v_first_volunteer_relation then
    v_volunteers := v_volunteers + public._count_church_admin_pending_source(
      v_relation, _church_id, array['church_id', 'status'], 'volunteer');
  end if;

  return jsonb_build_object(
    'events', coalesce(v_events, 0),
    'sacraments', coalesce(v_sacraments, 0),
    'massIntentions', coalesce(v_mass_intentions, 0),
    'prayerRequests', coalesce(v_prayer_requests, 0),
    'communityHelp', coalesce(v_community_help, 0),
    'invitations', coalesce(v_invitations, 0),
    'announcements', coalesce(v_announcements, 0),
    'payments', coalesce(v_payments, 0),
    'memberships', coalesce(v_memberships, 0),
    'volunteers', coalesce(v_volunteers, 0),
    'total', coalesce(v_events, 0) + coalesce(v_sacraments, 0)
      + coalesce(v_mass_intentions, 0) + coalesce(v_prayer_requests, 0)
      + coalesce(v_community_help, 0) + coalesce(v_invitations, 0)
      + coalesce(v_announcements, 0) + coalesce(v_payments, 0)
      + coalesce(v_memberships, 0) + coalesce(v_volunteers, 0)
  );
end;
$$;

revoke all on function public.get_church_admin_pending_counts(uuid)
from public, anon;

grant execute on function public.get_church_admin_pending_counts(uuid)
to authenticated;
