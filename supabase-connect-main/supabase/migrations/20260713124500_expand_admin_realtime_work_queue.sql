-- Expand the Church Admin Action Required queue to cover all visible admin work.
-- The original aggregate focused on approval counters only, so requests such as
-- prayers, community help, invitations, and draft announcements could be missed.

create or replace function public.get_church_admin_pending_counts(_church_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_schema_name constant text := 'public';
  v_table_name text;
  v_relation regclass;
  v_required_columns text[];
  v_has_required_columns boolean := false;
  v_count integer := 0;
  v_membership_relations oid[] := array[]::oid[];
  v_volunteer_relations oid[] := array[]::oid[];
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

  v_table_name := 'event_requests';
  v_relation := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_schema_name, v_table_name));
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation
    and a.attnum > 0
    and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''submitted'') in (''submitted'', ''under_review'')',
      v_schema_name,
      v_table_name
    ) into v_events using _church_id;
  end if;

  v_table_name := 'sacramental_records';
  v_relation := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_schema_name, v_table_name));
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation
    and a.attnum > 0
    and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''planned'') in (''planned'', ''preparation'')',
      v_schema_name,
      v_table_name
    ) into v_sacraments using _church_id;
  end if;

  v_table_name := 'mass_intentions';
  v_relation := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_schema_name, v_table_name));
  v_required_columns := array['church_id', 'status', 'payment_status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation
    and a.attnum > 0
    and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and (coalesce(status, ''pending'') = ''pending'' or coalesce(payment_status, ''pending'') in (''pending'', ''unpaid'', ''submitted''))',
      v_schema_name,
      v_table_name
    ) into v_mass_intentions using _church_id;
  end if;

  v_table_name := 'prayer_requests';
  v_relation := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_schema_name, v_table_name));
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation
    and a.attnum > 0
    and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') = ''pending''',
      v_schema_name,
      v_table_name
    ) into v_prayer_requests using _church_id;
  end if;

  v_table_name := 'community_help_requests';
  v_relation := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_schema_name, v_table_name));
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation
    and a.attnum > 0
    and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') = ''pending''',
      v_schema_name,
      v_table_name
    ) into v_community_help using _church_id;
  end if;

  v_table_name := 'invitations';
  v_relation := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_schema_name, v_table_name));
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation
    and a.attnum > 0
    and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') = ''pending''',
      v_schema_name,
      v_table_name
    ) into v_invitations using _church_id;
  end if;

  v_table_name := 'invites';
  v_relation := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_schema_name, v_table_name));
  v_required_columns := array['church_id', 'status', 'used'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation
    and a.attnum > 0
    and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') = ''pending'' and coalesce(used, false) = false',
      v_schema_name,
      v_table_name
    ) into v_count using _church_id;
    v_invitations := v_invitations + coalesce(v_count, 0);
  end if;

  v_table_name := 'announcements';
  v_relation := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_schema_name, v_table_name));
  v_required_columns := array['church_id', 'archived_at', 'is_published', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation
    and a.attnum > 0
    and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and archived_at is null and coalesce(is_published, false) = false and coalesce(status, ''draft'') in (''draft'', ''scheduled'')',
      v_schema_name,
      v_table_name
    ) into v_announcements using _church_id;
  end if;

  v_table_name := 'event_registration_payments';
  v_relation := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_schema_name, v_table_name));
  v_required_columns := array['church_id', 'status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation
    and a.attnum > 0
    and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    execute pg_catalog.format(
      'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') = ''pending''',
      v_schema_name,
      v_table_name
    ) into v_payments using _church_id;
  end if;

  v_table_name := 'pledge_payments';
  v_relation := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_schema_name, v_table_name));
  v_required_columns := array['pledge_id', 'verification_status'];
  select count(*) = pg_catalog.cardinality(v_required_columns)
  into v_has_required_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = v_relation
    and a.attnum > 0
    and not a.attisdropped
    and a.attname::text = any(v_required_columns);
  if v_relation is not null and v_has_required_columns then
    v_relation := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_schema_name, 'pledges'));
    v_required_columns := array['id', 'church_id'];
    select count(*) = pg_catalog.cardinality(v_required_columns)
    into v_has_required_columns
    from pg_catalog.pg_attribute a
    where a.attrelid = v_relation
      and a.attnum > 0
      and not a.attisdropped
      and a.attname::text = any(v_required_columns);
    if v_relation is not null and v_has_required_columns then
      execute pg_catalog.format(
        'select count(*)::integer from %I.%I pp join %I.%I p on p.id = pp.pledge_id where p.church_id = $1 and coalesce(pp.verification_status, ''pending'') = ''pending''',
        v_schema_name,
        v_table_name,
        v_schema_name,
        'pledges'
      ) into v_count using _church_id;
      v_payments := v_payments + coalesce(v_count, 0);
    end if;
  end if;

  foreach v_table_name in array array['community_join_requests', 'community_membership_requests']
  loop
    v_relation := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_schema_name, v_table_name));
    v_required_columns := array['church_id', 'status'];
    select count(*) = pg_catalog.cardinality(v_required_columns)
    into v_has_required_columns
    from pg_catalog.pg_attribute a
    where a.attrelid = v_relation
      and a.attnum > 0
      and not a.attisdropped
      and a.attname::text = any(v_required_columns);
    if v_relation is not null
      and v_has_required_columns
      and not (v_relation::oid = any(v_membership_relations))
    then
      execute pg_catalog.format(
        'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') in (''pending'', ''submitted'')',
        v_schema_name,
        v_table_name
      ) into v_count using _church_id;
      v_memberships := v_memberships + coalesce(v_count, 0);
      v_membership_relations := pg_catalog.array_append(v_membership_relations, v_relation::oid);
    end if;
  end loop;

  foreach v_table_name in array array['ministry_join_requests', 'volunteer_requests']
  loop
    v_relation := pg_catalog.to_regclass(pg_catalog.format('%I.%I', v_schema_name, v_table_name));
    v_required_columns := array['church_id', 'status'];
    select count(*) = pg_catalog.cardinality(v_required_columns)
    into v_has_required_columns
    from pg_catalog.pg_attribute a
    where a.attrelid = v_relation
      and a.attnum > 0
      and not a.attisdropped
      and a.attname::text = any(v_required_columns);
    if v_relation is not null
      and v_has_required_columns
      and not (v_relation::oid = any(v_volunteer_relations))
    then
      if v_table_name = 'ministry_join_requests' then
        execute pg_catalog.format(
          'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') = ''pending''',
          v_schema_name,
          v_table_name
        ) into v_count using _church_id;
      else
        execute pg_catalog.format(
          'select count(*)::integer from %I.%I where church_id = $1 and coalesce(status, ''pending'') in (''pending'', ''submitted'')',
          v_schema_name,
          v_table_name
        ) into v_count using _church_id;
      end if;
      v_volunteers := v_volunteers + coalesce(v_count, 0);
      v_volunteer_relations := pg_catalog.array_append(v_volunteer_relations, v_relation::oid);
    end if;
  end loop;

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

grant execute on function public.get_church_admin_pending_counts(uuid) to authenticated;

do $$
declare
  v_table text;
begin
  -- Tables created after this migration require a later migration to add them to realtime.
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'event_requests',
      'mass_intentions',
      'prayer_requests',
      'community_help_requests',
      'event_registration_payments',
      'community_join_requests',
      'community_membership_requests',
      'ministry_join_requests',
      'volunteer_requests',
      'sacramental_records',
      'invitations',
      'invites',
      'announcements'
    ]
    loop
      if exists (
          select 1
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname = v_table
            and c.relkind in ('r', 'p')
        )
        and not exists (
          select 1
          from pg_catalog.pg_publication_tables
          where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = v_table
        )
      then
        execute pg_catalog.format(
          'alter publication %I add table %I.%I',
          'supabase_realtime',
          'public',
          v_table
        );
      end if;
    end loop;
  end if;
end $$;
