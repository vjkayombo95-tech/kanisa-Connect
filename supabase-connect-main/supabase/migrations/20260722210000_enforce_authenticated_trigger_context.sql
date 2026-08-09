-- Keep privileged maintenance behavior while honoring an explicitly emulated
-- authenticated JWT context. Direct postgres/supabase_admin maintenance has no
-- auth.uid(); service-role automation remains an explicit trusted bypass.

create or replace function public.enforce_church_settings_manage_permission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_church_id uuid;
begin
  if (session_user in ('postgres', 'supabase_admin') and auth.uid() is null)
     or auth.role() = 'service_role' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_church_id := case
    when tg_table_name = 'churches' then nullif(v_row->>'id', '')::uuid
    else nullif(v_row->>'church_id', '')::uuid
  end;

  if v_church_id is null or not public.has_church_feature_permission(
    auth.uid(), v_church_id, 'feature_permissions_admin', 'manage'
  ) then
    raise exception 'Missing manage permission for church settings' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and tg_table_name = 'churches' and new.id is distinct from old.id then
    raise exception 'Church identity cannot be changed' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.enforce_announcement_action_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_church_id uuid := case when tg_op = 'DELETE' then old.church_id else new.church_id end;
  v_content_changed boolean := false;
  v_lifecycle_changed boolean := false;
begin
  if (session_user in ('postgres', 'supabase_admin') and auth.uid() is null)
     or auth.role() = 'service_role' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  if tg_op = 'INSERT' then
    if not public.has_church_feature_permission(auth.uid(), v_church_id, 'announcements', 'create') then
      raise exception 'Missing create permission for announcements' using errcode = '42501';
    end if;
    if coalesce(new.is_published, false)
       and not public.has_church_feature_permission(auth.uid(), v_church_id, 'announcements', 'publish') then
      raise exception 'Missing publish permission for announcements' using errcode = '42501';
    end if;
  elsif tg_op = 'DELETE' then
    if not public.has_church_feature_permission(auth.uid(), v_church_id, 'announcements', 'delete') then
      raise exception 'Missing delete permission for announcements' using errcode = '42501';
    end if;
  else
    v_content_changed := new.title is distinct from old.title
      or new.content is distinct from old.content
      or new.audience is distinct from old.audience
      or new.target_ministry is distinct from old.target_ministry
      or new.target_community is distinct from old.target_community
      or new.show_on_calendar is distinct from old.show_on_calendar
      or new.notification_strategy is distinct from old.notification_strategy
      or new.category is distinct from old.category;
    v_lifecycle_changed := new.is_published is distinct from old.is_published
      or new.status is distinct from old.status
      or new.published_at is distinct from old.published_at
      or new.publish_at is distinct from old.publish_at
      or new.expires_at is distinct from old.expires_at
      or new.never_expires is distinct from old.never_expires
      or new.archived_at is distinct from old.archived_at
      or new.featured is distinct from old.featured;

    if v_content_changed
       and not public.has_church_feature_permission(auth.uid(), v_church_id, 'announcements', 'edit') then
      raise exception 'Missing edit permission for announcements' using errcode = '42501';
    end if;
    if v_lifecycle_changed
       and not public.has_church_feature_permission(auth.uid(), v_church_id, 'announcements', 'publish') then
      raise exception 'Missing publish permission for announcements' using errcode = '42501';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.enforce_tenant_actor_immutability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if (session_user in ('postgres', 'supabase_admin') and auth.uid() is null)
     or auth.role() = 'service_role' then
    return new;
  end if;
  if new.church_id is distinct from old.church_id then
    raise exception 'Tenant identity cannot be changed' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'Mutation actor cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_event_mutation_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_church_id uuid := new.church_id;
begin
  if (session_user in ('postgres', 'supabase_admin') and auth.uid() is null)
     or auth.role() = 'service_role' then
    return new;
  end if;
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.created_by is distinct from auth.uid() then
      raise exception 'Event creator must match the authenticated actor' using errcode = '42501';
    end if;
    if not public.has_church_feature_permission(auth.uid(), v_church_id, 'events', 'create') then
      raise exception 'Missing create permission for events' using errcode = '42501';
    end if;
  else
    if not public.has_church_feature_permission(auth.uid(), v_church_id, 'events', 'edit') then
      raise exception 'Missing edit permission for events' using errcode = '42501';
    end if;
    if old.created_by is distinct from auth.uid()
       and not public.has_church_feature_permission(auth.uid(), old.church_id, 'events', 'manage') then
      raise exception 'Missing manage permission for cross-owner Event update' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_church_settings_manage_permission() from public, anon, authenticated;
revoke all on function public.enforce_announcement_action_permissions() from public, anon, authenticated;
revoke all on function public.enforce_tenant_actor_immutability() from public, anon, authenticated;
revoke all on function public.enforce_event_mutation_scope() from public, anon, authenticated;
