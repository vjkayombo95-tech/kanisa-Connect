-- Forward-only replacement for the Church Admin pending-count aggregate.
-- Optional workflow sources are checked independently so missing or partially
-- deployed tables are skipped without confusing PostgreSQL function linting.

create or replace function public.get_church_admin_pending_counts(_church_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_relation regclass;
  v_required_columns text[];
  v_has_required_columns boolean := false;
  v_count integer := 0;
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
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if _church_id is null then
    raise exception 'Church is required'
      using errcode = '22023';
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

  v_relation := pg_catalog.to_regclass('public.event_requests');
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''submitted'') in (''submitted'', ''under_review'')',
      'public', 'event_requests'
    ) into v_events using _church_id;
  end if;

  v_relation := pg_catalog.to_regclass('public.sacramental_records');
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''planned'') in (''planned'', ''preparation'')',
      'public', 'sacramental_records'
    ) into v_sacraments using _church_id;
  end if;

  v_relation := pg_catalog.to_regclass('public.mass_intentions');
  v_required_columns := array['church_id', 'status', 'payment_status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and (coalesce(status, ''pending'') = ''pending'' or coalesce(payment_status, ''pending'') in (''pending'', ''unpaid'', ''submitted''))',
      'public', 'mass_intentions'
    ) into v_mass_intentions using _church_id;
  end if;

  v_relation := pg_catalog.to_regclass('public.prayer_requests');
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') = ''pending''',
      'public', 'prayer_requests'
    ) into v_prayer_requests using _church_id;
  end if;

  v_relation := pg_catalog.to_regclass('public.community_help_requests');
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') = ''pending''',
      'public', 'community_help_requests'
    ) into v_community_help using _church_id;
  end if;

  v_relation := pg_catalog.to_regclass('public.invitations');
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') = ''pending''',
      'public', 'invitations'
    ) into v_invitations using _church_id;
  end if;

  v_relation := pg_catalog.to_regclass('public.invites');
  v_required_columns := array['church_id', 'status', 'used'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') = ''pending'' and coalesce(used, false) = false',
      'public', 'invites'
    ) into v_count using _church_id;
    v_invitations := v_invitations + coalesce(v_count, 0);
  end if;

  v_relation := pg_catalog.to_regclass('public.announcements');
  v_required_columns := array['church_id', 'archived_at', 'is_published', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and archived_at is null and coalesce(is_published, false) = false and coalesce(status, ''draft'') in (''draft'', ''scheduled'')',
      'public', 'announcements'
    ) into v_announcements using _church_id;
  end if;

  v_relation := pg_catalog.to_regclass('public.event_registration_payments');
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') = ''pending''',
      'public', 'event_registration_payments'
    ) into v_payments using _church_id;
  end if;

  v_relation := pg_catalog.to_regclass('public.pledge_payments');
  v_required_columns := array['pledge_id', 'verification_status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    v_relation := pg_catalog.to_regclass('public.pledges');
    v_required_columns := array['id', 'church_id'];
    select count(*) = pg_catalog.cardinality(v_required_columns)
    into v_has_required_columns
    from pg_catalog.pg_attribute a
    where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
      and a.attname::text = any(v_required_columns);
    if v_relation is not null and v_has_required_columns then
      execute pg_catalog.format(
        'select count(*)::integer from %I.%I pp join %I.%I p on p.id = pp.pledge_id where p.church_id = $1 and coalesce(pp.verification_status, ''pending'') = ''pending''',
        'public', 'pledge_payments', 'public', 'pledges'
      ) into v_count using _church_id;
      v_payments := v_payments + coalesce(v_count, 0);
    end if;
  end if;

  -- Each alternative membership source is deliberately independent.
  v_relation := pg_catalog.to_regclass('public.community_join_requests');
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') in (''pending'', ''submitted'')',
      'public', 'community_join_requests'
    ) into v_count using _church_id;
    v_memberships := v_memberships + coalesce(v_count, 0);
    v_first_membership_relation := v_relation::oid;
  end if;

  v_relation := pg_catalog.to_regclass('public.community_membership_requests');
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null
    and v_has_required_columns
    and v_relation::oid is distinct from v_first_membership_relation
  then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') in (''pending'', ''submitted'')',
      'public', 'community_membership_requests'
    ) into v_count using _church_id;
    v_memberships := v_memberships + coalesce(v_count, 0);
  end if;

  -- Each alternative volunteer source is deliberately independent.
  v_relation := pg_catalog.to_regclass('public.ministry_join_requests');
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') = ''pending''',
      'public', 'ministry_join_requests'
    ) into v_count using _church_id;
    v_volunteers := v_volunteers + coalesce(v_count, 0);
    v_first_volunteer_relation := v_relation::oid;
  end if;

  v_relation := pg_catalog.to_regclass('public.volunteer_requests');
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation and a.attnum > 0 and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null
    and v_has_required_columns
    and v_relation::oid is distinct from v_first_volunteer_relation
  then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') in (''pending'', ''submitted'')',
      'public', 'volunteer_requests'
    ) into v_count using _church_id;
    v_volunteers := v_volunteers + coalesce(v_count, 0);
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
    'total',
      coalesce(v_events, 0)
      + coalesce(v_sacraments, 0)
      + coalesce(v_mass_intentions, 0)
      + coalesce(v_prayer_requests, 0)
      + coalesce(v_community_help, 0)
      + coalesce(v_invitations, 0)
      + coalesce(v_announcements, 0)
      + coalesce(v_payments, 0)
      + coalesce(v_memberships, 0)
      + coalesce(v_volunteers, 0)
  );
end;
$$;

revoke all on function public.get_church_admin_pending_counts(uuid)
from public, anon;

grant execute on function public.get_church_admin_pending_counts(uuid)
to authenticated;
