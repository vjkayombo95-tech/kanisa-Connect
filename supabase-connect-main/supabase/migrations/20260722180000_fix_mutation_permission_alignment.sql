-- Align mutation authorization with the effective multi-role permission matrix.
-- This migration is forward-only and intentionally does not grant permissions by role name.

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
  if session_user in ('postgres', 'supabase_admin') or auth.role() = 'service_role' then
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

revoke all on function public.enforce_church_settings_manage_permission() from public, anon, authenticated;

drop policy if exists "church settings manage update" on public.churches;
create policy "church settings manage update"
on public.churches
as restrictive
for update
to authenticated
using (
  public.has_church_feature_permission(auth.uid(), id, 'feature_permissions_admin', 'manage')
)
with check (
  public.has_church_feature_permission(auth.uid(), id, 'feature_permissions_admin', 'manage')
);

drop trigger if exists enforce_church_settings_manage_permission on public.churches;
create trigger enforce_church_settings_manage_permission
before update on public.churches
for each row execute function public.enforce_church_settings_manage_permission();

drop policy if exists message_templates_manage_by_role on public.message_templates;
drop policy if exists message_templates_manage_by_permission on public.message_templates;
create policy message_templates_manage_by_permission
on public.message_templates
for all
to authenticated
using (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'feature_permissions_admin', 'manage')
)
with check (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'feature_permissions_admin', 'manage')
);

drop policy if exists "message template settings insert" on public.message_templates;
create policy "message template settings insert"
on public.message_templates as restrictive for insert to authenticated
with check (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'feature_permissions_admin', 'manage')
);

drop policy if exists "message template settings update" on public.message_templates;
create policy "message template settings update"
on public.message_templates as restrictive for update to authenticated
using (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'feature_permissions_admin', 'manage')
)
with check (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'feature_permissions_admin', 'manage')
);

drop policy if exists "message template settings delete" on public.message_templates;
create policy "message template settings delete"
on public.message_templates as restrictive for delete to authenticated
using (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'feature_permissions_admin', 'manage')
);

drop trigger if exists enforce_church_settings_manage_permission on public.message_templates;
create trigger enforce_church_settings_manage_permission
before insert or update or delete on public.message_templates
for each row execute function public.enforce_church_settings_manage_permission();

-- Branding files are settings mutations too. Other church-assets paths retain
-- their existing feature/workflow policies.
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "Church settings permission can upload branding" on storage.objects;
    create policy "Church settings permission can upload branding"
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'church-assets'
      and coalesce((storage.foldername(name))[2], '') in ('logos', 'banners')
      and exists (
        select 1 from public.churches c
        where c.id::text = (storage.foldername(name))[1]
          and public.has_church_feature_permission(auth.uid(), c.id, 'feature_permissions_admin', 'manage')
      )
    );

    drop policy if exists "Church settings permission can update branding" on storage.objects;
    create policy "Church settings permission can update branding"
    on storage.objects for update to authenticated
    using (
      bucket_id = 'church-assets'
      and coalesce((storage.foldername(name))[2], '') in ('logos', 'banners')
      and exists (
        select 1 from public.churches c
        where c.id::text = (storage.foldername(name))[1]
          and public.has_church_feature_permission(auth.uid(), c.id, 'feature_permissions_admin', 'manage')
      )
    )
    with check (
      bucket_id = 'church-assets'
      and coalesce((storage.foldername(name))[2], '') in ('logos', 'banners')
      and exists (
        select 1 from public.churches c
        where c.id::text = (storage.foldername(name))[1]
          and public.has_church_feature_permission(auth.uid(), c.id, 'feature_permissions_admin', 'manage')
      )
    );

    drop policy if exists "Church settings permission can delete branding" on storage.objects;
    create policy "Church settings permission can delete branding"
    on storage.objects for delete to authenticated
    using (
      bucket_id = 'church-assets'
      and coalesce((storage.foldername(name))[2], '') in ('logos', 'banners')
      and exists (
        select 1 from public.churches c
        where c.id::text = (storage.foldername(name))[1]
          and public.has_church_feature_permission(auth.uid(), c.id, 'feature_permissions_admin', 'manage')
      )
    );

    drop policy if exists "church settings guard asset insert" on storage.objects;
    create policy "church settings guard asset insert"
    on storage.objects as restrictive for insert to authenticated
    with check (
      bucket_id <> 'church-assets'
      or coalesce((storage.foldername(name))[2], '') not in ('logos', 'banners')
      or exists (
        select 1 from public.churches c
        where c.id::text = (storage.foldername(name))[1]
          and public.has_church_feature_permission(auth.uid(), c.id, 'feature_permissions_admin', 'manage')
      )
    );

    drop policy if exists "church settings guard asset update" on storage.objects;
    create policy "church settings guard asset update"
    on storage.objects as restrictive for update to authenticated
    using (
      bucket_id <> 'church-assets'
      or coalesce((storage.foldername(name))[2], '') not in ('logos', 'banners')
      or exists (
        select 1 from public.churches c
        where c.id::text = (storage.foldername(name))[1]
          and public.has_church_feature_permission(auth.uid(), c.id, 'feature_permissions_admin', 'manage')
      )
    )
    with check (
      bucket_id <> 'church-assets'
      or coalesce((storage.foldername(name))[2], '') not in ('logos', 'banners')
      or exists (
        select 1 from public.churches c
        where c.id::text = (storage.foldername(name))[1]
          and public.has_church_feature_permission(auth.uid(), c.id, 'feature_permissions_admin', 'manage')
      )
    );

    drop policy if exists "church settings guard asset delete" on storage.objects;
    create policy "church settings guard asset delete"
    on storage.objects as restrictive for delete to authenticated
    using (
      bucket_id <> 'church-assets'
      or coalesce((storage.foldername(name))[2], '') not in ('logos', 'banners')
      or exists (
        select 1 from public.churches c
        where c.id::text = (storage.foldername(name))[1]
          and public.has_church_feature_permission(auth.uid(), c.id, 'feature_permissions_admin', 'manage')
      )
    );
  end if;
end $$;

-- Event mutation policies previously required role-administration permission,
-- contradicting the configured events action matrix.
drop policy if exists "Church managers can insert events" on public.events;
create policy "Church managers can insert events"
on public.events for insert to authenticated
with check (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'events', 'create')
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Church managers can update events" on public.events;
create policy "Church managers can update events"
on public.events for update to authenticated
using (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'events', 'edit')
)
with check (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'events', 'edit')
);

drop policy if exists "Church managers can delete events" on public.events;
create policy "Church managers can delete events"
on public.events for delete to authenticated
using (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'events', 'delete')
);

-- Announcement UPDATE is admitted when either possible action is available;
-- enforce_feature_mutation_permission() still determines the exact edit versus
-- publish action from OLD/NEW and rejects an unauthorized transition.
drop policy if exists "Church managers can update announcements" on public.announcements;
create policy "Church managers can update announcements"
on public.announcements for update to authenticated
using (
  church_id is not null
  and (
    public.has_church_feature_permission(auth.uid(), church_id, 'announcements', 'edit')
    or public.has_church_feature_permission(auth.uid(), church_id, 'announcements', 'publish')
  )
)
with check (
  church_id is not null
  and (
    public.has_church_feature_permission(auth.uid(), church_id, 'announcements', 'edit')
    or public.has_church_feature_permission(auth.uid(), church_id, 'announcements', 'publish')
  )
);

drop policy if exists "Church managers can delete announcements" on public.announcements;
create policy "Church managers can delete announcements"
on public.announcements for delete to authenticated
using (
  church_id is not null
  and public.has_church_feature_permission(auth.uid(), church_id, 'announcements', 'delete')
);

-- Direct updates can change content and publication state in one statement.
-- Require every applicable action instead of allowing the lifecycle action to
-- mask a simultaneous content edit.
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
  if session_user in ('postgres', 'supabase_admin') or auth.role() = 'service_role' then
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

revoke all on function public.enforce_announcement_action_permissions() from public, anon, authenticated;
drop trigger if exists enforce_announcement_action_permissions on public.announcements;
create trigger enforce_announcement_action_permissions
before insert or update or delete on public.announcements
for each row execute function public.enforce_announcement_action_permissions();

create or replace function public.enforce_tenant_actor_immutability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if session_user in ('postgres', 'supabase_admin') or auth.role() = 'service_role' then
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

revoke all on function public.enforce_tenant_actor_immutability() from public, anon, authenticated;

drop trigger if exists enforce_tenant_actor_immutability on public.events;
create trigger enforce_tenant_actor_immutability
before update of church_id, created_by on public.events
for each row execute function public.enforce_tenant_actor_immutability();

drop trigger if exists enforce_tenant_actor_immutability on public.announcements;
create trigger enforce_tenant_actor_immutability
before update of church_id, created_by on public.announcements
for each row execute function public.enforce_tenant_actor_immutability();

create or replace function public.update_announcement_lifecycle(_church_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_published integer := 0;
  v_expired integer := 0;
begin
  if auth.role() <> 'service_role' then
    if auth.uid() is null then
      raise exception 'Authentication required' using errcode = '42501';
    end if;
    if _church_id is null or not public.has_church_feature_permission(
      auth.uid(), _church_id, 'announcements', 'publish'
    ) then
      raise exception 'Missing publish permission for announcements' using errcode = '42501';
    end if;
  end if;

  update public.announcements a
  set is_published = true,
      published_at = coalesce(a.published_at, now()),
      status = case when a.featured then 'featured' else 'active' end
  where a.archived_at is null
    and a.is_published = false
    and a.publish_at is not null
    and a.publish_at <= now()
    and (_church_id is null or a.church_id = _church_id);
  get diagnostics v_published = row_count;

  update public.announcements a
  set is_published = false, status = 'expired'
  where a.archived_at is null
    and a.never_expires = false
    and a.expires_at is not null
    and a.expires_at <= now()
    and (_church_id is null or a.church_id = _church_id);
  get diagnostics v_expired = row_count;

  return jsonb_build_object('success', true, 'published', v_published, 'expired', v_expired);
end;
$$;

create or replace function public.save_church_announcement(
  _announcement_id uuid,
  _church_id uuid,
  _title text,
  _content text,
  _is_published boolean default false,
  _publish_at timestamptz default null,
  _expires_at timestamptz default null,
  _timezone text default 'Africa/Nairobi',
  _never_expires boolean default false,
  _audience text[] default array['everyone']::text[],
  _target_ministry text default null,
  _target_community text default null,
  _show_on_calendar boolean default false,
  _notification_strategy text default 'none',
  _category text default 'general',
  _featured boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_publish_at timestamptz := _publish_at;
  v_is_published boolean := coalesce(_is_published, false);
  v_existing public.announcements%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if _church_id is null or nullif(trim(coalesce(_title, '')), '') is null
     or nullif(trim(coalesce(_content, '')), '') is null then
    raise exception 'Missing announcement fields' using errcode = '22023';
  end if;

  if _announcement_id is null then
    if not public.has_church_feature_permission(auth.uid(), _church_id, 'announcements', 'create') then
      raise exception 'Missing create permission for announcements' using errcode = '42501';
    end if;
    if v_is_published and not public.has_church_feature_permission(auth.uid(), _church_id, 'announcements', 'publish') then
      raise exception 'Missing publish permission for announcements' using errcode = '42501';
    end if;
  else
    select * into v_existing from public.announcements
    where id = _announcement_id and church_id = _church_id;
    if v_existing.id is null then
      raise exception 'Announcement was not found' using errcode = 'P0002';
    end if;
    if v_existing.is_published is distinct from v_is_published then
      if not public.has_church_feature_permission(auth.uid(), _church_id, 'announcements', 'publish') then
        raise exception 'Missing publish permission for announcements' using errcode = '42501';
      end if;
    elsif not public.has_church_feature_permission(auth.uid(), _church_id, 'announcements', 'edit') then
      raise exception 'Missing edit permission for announcements' using errcode = '42501';
    end if;
  end if;

  if v_is_published and v_publish_at is null then v_publish_at := now(); end if;

  if _announcement_id is null then
    insert into public.announcements (
      church_id, title, content, is_published, published_at, created_by,
      publish_at, expires_at, timezone, never_expires, audience,
      target_ministry, target_community, show_on_calendar,
      notification_strategy, category, featured
    ) values (
      _church_id, trim(_title), trim(_content), v_is_published,
      case when v_is_published then v_publish_at else null end, auth.uid(),
      v_publish_at, case when coalesce(_never_expires, false) then null else _expires_at end,
      coalesce(nullif(trim(_timezone), ''), 'Africa/Nairobi'), coalesce(_never_expires, false),
      coalesce(_audience, array['everyone']::text[]), nullif(trim(coalesce(_target_ministry, '')), ''),
      nullif(trim(coalesce(_target_community, '')), ''), coalesce(_show_on_calendar, false),
      coalesce(nullif(trim(_notification_strategy), ''), 'none'),
      coalesce(nullif(trim(_category), ''), 'general'), coalesce(_featured, false)
    ) returning id into v_id;
  else
    update public.announcements
    set title = trim(_title), content = trim(_content), is_published = v_is_published,
        published_at = case when v_is_published then coalesce(published_at, v_publish_at, now()) else null end,
        archived_at = null, publish_at = v_publish_at,
        expires_at = case when coalesce(_never_expires, false) then null else _expires_at end,
        timezone = coalesce(nullif(trim(_timezone), ''), 'Africa/Nairobi'),
        never_expires = coalesce(_never_expires, false), audience = coalesce(_audience, array['everyone']::text[]),
        target_ministry = nullif(trim(coalesce(_target_ministry, '')), ''),
        target_community = nullif(trim(coalesce(_target_community, '')), ''),
        show_on_calendar = coalesce(_show_on_calendar, false),
        notification_strategy = coalesce(nullif(trim(_notification_strategy), ''), 'none'),
        category = coalesce(nullif(trim(_category), ''), 'general'), featured = coalesce(_featured, false)
    where id = _announcement_id and church_id = _church_id
    returning id into v_id;
  end if;

  if v_id is null then raise exception 'Announcement was not found' using errcode = 'P0002'; end if;
  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;

create or replace function public.set_church_announcement_archived(_announcement_id uuid, _archived boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_row public.announcements%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_row from public.announcements where id = _announcement_id for update;
  if v_row.id is null then raise exception 'Announcement was not found' using errcode = 'P0002'; end if;
  if not (
    public.has_church_feature_permission(auth.uid(), v_row.church_id, 'announcements', 'edit')
    or public.has_church_feature_permission(auth.uid(), v_row.church_id, 'announcements', 'publish')
  ) then
    raise exception 'Missing edit or publish permission for announcements' using errcode = '42501';
  end if;
  update public.announcements
  set archived_at = case when _archived then now() else null end,
      is_published = case when _archived then false else is_published end,
      published_at = case when _archived then null else published_at end
  where id = _announcement_id;
  return jsonb_build_object('success', true, 'id', _announcement_id);
end;
$$;

create or replace function public.delete_church_announcement(_announcement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_row public.announcements%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_row from public.announcements where id = _announcement_id for update;
  if v_row.id is null then raise exception 'Announcement was not found' using errcode = 'P0002'; end if;
  if not public.has_church_feature_permission(auth.uid(), v_row.church_id, 'announcements', 'delete') then
    raise exception 'Missing delete permission for announcements' using errcode = '42501';
  end if;
  delete from public.announcements where id = _announcement_id;
  return jsonb_build_object('success', true, 'id', _announcement_id);
end;
$$;
