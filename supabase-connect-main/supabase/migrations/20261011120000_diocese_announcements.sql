-- Slice 5A: Diocese announcement management foundation.
--
-- Diocese announcements are intentionally separate from parish/church
-- announcements. Diocese authority does not grant church workspace authority.

create table public.diocese_announcements (
  id uuid not null default gen_random_uuid(),
  diocese_id uuid not null,
  title text not null,
  content text not null,
  status text not null default 'draft',
  target_mode text not null default 'all_parishes',
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid default auth.uid(),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diocese_announcements_pkey primary key (id),
  constraint diocese_announcements_diocese_id_fkey
    foreign key (diocese_id) references public.dioceses(id) on delete cascade,
  constraint diocese_announcements_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null,
  constraint diocese_announcements_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null,
  constraint diocese_announcements_id_diocese_id_key unique (id, diocese_id),
  constraint diocese_announcements_title_not_blank_check
    check (length(trim(title)) > 0),
  constraint diocese_announcements_content_not_blank_check
    check (length(trim(content)) > 0),
  constraint diocese_announcements_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint diocese_announcements_target_mode_check
    check (target_mode in ('all_parishes', 'selected_parishes')),
  constraint diocese_announcements_published_at_check
    check ((status = 'published' and published_at is not null) or status <> 'published'),
  constraint diocese_announcements_archived_at_check
    check ((status = 'archived' and archived_at is not null) or status <> 'archived')
);

comment on table public.diocese_announcements is
  'Diocese-owned announcements. These are not rows in public.announcements and do not grant parish authority.';

create index diocese_announcements_diocese_status_updated_idx
  on public.diocese_announcements (diocese_id, status, updated_at desc);

create index diocese_announcements_diocese_created_idx
  on public.diocese_announcements (diocese_id, created_at desc);

create table public.diocese_announcement_parish_targets (
  id uuid not null default gen_random_uuid(),
  announcement_id uuid not null,
  diocese_id uuid not null,
  church_id uuid not null,
  created_at timestamptz not null default now(),
  constraint diocese_announcement_parish_targets_pkey primary key (id),
  constraint diocese_announcement_parish_targets_announcement_fkey
    foreign key (announcement_id, diocese_id)
    references public.diocese_announcements(id, diocese_id)
    on delete cascade,
  constraint diocese_announcement_parish_targets_church_id_fkey
    foreign key (church_id) references public.churches(id) on delete restrict,
  constraint diocese_announcement_parish_targets_unique_church_key
    unique (announcement_id, church_id)
);

comment on table public.diocese_announcement_parish_targets is
  'Selected active parish targets for Diocese announcements. Parish IDs are validated against active Diocese church links.';

create index diocese_announcement_targets_announcement_idx
  on public.diocese_announcement_parish_targets (announcement_id);

create index diocese_announcement_targets_diocese_church_idx
  on public.diocese_announcement_parish_targets (diocese_id, church_id);

create trigger set_diocese_announcements_updated_at
before update on public.diocese_announcements
for each row execute function public.update_updated_at_column();

create function public.validate_diocese_announcement_parish_target()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
    from public.diocese_announcements da
    where da.id = new.announcement_id
      and da.diocese_id = new.diocese_id
      and da.target_mode = 'selected_parishes'
  ) then
    raise exception 'Announcement target must belong to a selected-parishes Diocese announcement'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.diocese_churches dc
    where dc.diocese_id = new.diocese_id
      and dc.church_id = new.church_id
      and dc.status = 'active'
  ) then
    raise exception 'Selected parish is not active in this Diocese'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.validate_diocese_announcement_parish_target() is
  'Server-side guard preventing cross-Diocese or inactive parish announcement targets.';

create trigger validate_diocese_announcement_parish_target_before_write
before insert or update on public.diocese_announcement_parish_targets
for each row execute function public.validate_diocese_announcement_parish_target();

create function public.get_diocese_announcements(
  _diocese_id uuid
)
returns table (
  id uuid,
  diocese_id uuid,
  title text,
  content text,
  status text,
  target_mode text,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  target_count integer,
  parish_targets jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    da.id,
    da.diocese_id,
    da.title,
    da.content,
    da.status,
    da.target_mode,
    da.published_at,
    da.archived_at,
    da.created_at,
    da.updated_at,
    coalesce(count(dat.id)::integer, 0) as target_count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'church_id', c.id,
          'church_name', c.name,
          'church_code', c.code
        )
        order by c.name asc, c.id asc
      ) filter (where dat.id is not null),
      '[]'::jsonb
    ) as parish_targets
  from public.diocese_announcements da
  left join public.diocese_announcement_parish_targets dat
    on dat.announcement_id = da.id
   and dat.diocese_id = da.diocese_id
  left join public.churches c
    on c.id = dat.church_id
  where _diocese_id is not null
    and da.diocese_id = _diocese_id
    and public.current_user_can_view_diocese(_diocese_id)
  group by da.id
  order by da.updated_at desc, da.created_at desc, da.id desc;
$$;

comment on function public.get_diocese_announcements(uuid) is
  'Caller-authorized Diocese announcement list. Exposes only announcement and selected parish summary fields.';

create function public.save_diocese_announcement(
  _diocese_id uuid,
  _announcement_id uuid,
  _title text,
  _content text,
  _status text,
  _target_mode text,
  _target_church_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_announcement_id uuid;
  v_title text := btrim(coalesce(_title, ''));
  v_content text := btrim(coalesce(_content, ''));
  v_status text := lower(btrim(coalesce(_status, 'draft')));
  v_target_mode text := lower(btrim(coalesce(_target_mode, 'all_parishes')));
  v_target_ids uuid[] := coalesce(_target_church_ids, '{}'::uuid[]);
  v_invalid_count integer;
begin
  if not public.current_user_can_manage_diocese(_diocese_id) then
    raise exception 'Not authorized to manage this Diocese'
      using errcode = '42501';
  end if;

  if v_title = '' then
    raise exception 'Announcement title is required'
      using errcode = '22023';
  end if;

  if v_content = '' then
    raise exception 'Announcement content is required'
      using errcode = '22023';
  end if;

  if v_status not in ('draft', 'published') then
    raise exception 'Invalid Diocese announcement status'
      using errcode = '22023';
  end if;

  if v_target_mode not in ('all_parishes', 'selected_parishes') then
    raise exception 'Invalid Diocese announcement target mode'
      using errcode = '22023';
  end if;

  if v_target_mode = 'selected_parishes' and cardinality(v_target_ids) = 0 then
    raise exception 'At least one active parish target is required'
      using errcode = '22023';
  end if;

  if v_target_mode = 'all_parishes' then
    v_target_ids := '{}'::uuid[];
  end if;

  if v_target_mode = 'selected_parishes' then
    select count(*)
      into v_invalid_count
    from unnest(v_target_ids) as supplied(church_id)
    where supplied.church_id is null
       or not exists (
         select 1
         from public.diocese_churches dc
         where dc.diocese_id = _diocese_id
           and dc.church_id = supplied.church_id
           and dc.status = 'active'
       );

    if v_invalid_count > 0 then
      raise exception 'All selected parishes must be active in this Diocese'
        using errcode = '42501';
    end if;
  end if;

  if _announcement_id is null then
    insert into public.diocese_announcements (
      diocese_id,
      title,
      content,
      status,
      target_mode,
      published_at,
      archived_at,
      created_by,
      updated_by
    )
    values (
      _diocese_id,
      v_title,
      v_content,
      v_status,
      v_target_mode,
      case when v_status = 'published' then now() else null end,
      null,
      auth.uid(),
      auth.uid()
    )
    returning id into v_announcement_id;
  else
    if exists (
      select 1
      from public.diocese_announcements da
      where da.id = _announcement_id
        and da.diocese_id = _diocese_id
        and da.status = 'archived'
    ) then
      raise exception 'Archived Diocese announcements cannot be edited'
        using errcode = '42501';
    end if;

    update public.diocese_announcements da
    set title = v_title,
        content = v_content,
        status = v_status,
        target_mode = v_target_mode,
        published_at = case
          when v_status = 'published' then coalesce(da.published_at, now())
          else null
        end,
        archived_at = null,
        updated_by = auth.uid()
    where da.id = _announcement_id
      and da.diocese_id = _diocese_id
      and da.status <> 'archived'
    returning da.id into v_announcement_id;

    if v_announcement_id is null then
      raise exception 'Diocese announcement not found'
        using errcode = 'P0002';
    end if;
  end if;

  delete from public.diocese_announcement_parish_targets
  where announcement_id = v_announcement_id;

  if v_target_mode = 'selected_parishes' then
    insert into public.diocese_announcement_parish_targets (
      announcement_id,
      diocese_id,
      church_id
    )
    select distinct
      v_announcement_id,
      _diocese_id,
      supplied.church_id
    from unnest(v_target_ids) as supplied(church_id);
  end if;

  return jsonb_build_object(
    'id', v_announcement_id,
    'diocese_id', _diocese_id,
    'status', v_status,
    'target_mode', v_target_mode
  );
end;
$$;

comment on function public.save_diocese_announcement(uuid, uuid, text, text, text, text, uuid[]) is
  'Creates or updates Diocese announcements using caller-bound Diocese management authorization and active parish target validation.';

create function public.publish_diocese_announcement(
  _diocese_id uuid,
  _announcement_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_announcement_id uuid;
begin
  if not public.current_user_can_manage_diocese(_diocese_id) then
    raise exception 'Not authorized to manage this Diocese'
      using errcode = '42501';
  end if;

  update public.diocese_announcements
  set status = 'published',
      published_at = coalesce(published_at, now()),
      archived_at = null,
      updated_by = auth.uid()
  where id = _announcement_id
    and diocese_id = _diocese_id
    and status <> 'archived'
  returning id into v_announcement_id;

  if v_announcement_id is null then
    raise exception 'Diocese announcement not found or archived'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', v_announcement_id, 'status', 'published');
end;
$$;

create function public.archive_diocese_announcement(
  _diocese_id uuid,
  _announcement_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_announcement_id uuid;
begin
  if not public.current_user_can_manage_diocese(_diocese_id) then
    raise exception 'Not authorized to manage this Diocese'
      using errcode = '42501';
  end if;

  update public.diocese_announcements
  set status = 'archived',
      archived_at = coalesce(archived_at, now()),
      updated_by = auth.uid()
  where id = _announcement_id
    and diocese_id = _diocese_id
  returning id into v_announcement_id;

  if v_announcement_id is null then
    raise exception 'Diocese announcement not found'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', v_announcement_id, 'status', 'archived');
end;
$$;

alter function public.validate_diocese_announcement_parish_target() owner to postgres;
alter function public.get_diocese_announcements(uuid) owner to postgres;
alter function public.save_diocese_announcement(uuid, uuid, text, text, text, text, uuid[]) owner to postgres;
alter function public.publish_diocese_announcement(uuid, uuid) owner to postgres;
alter function public.archive_diocese_announcement(uuid, uuid) owner to postgres;

alter table public.diocese_announcements enable row level security;
alter table public.diocese_announcement_parish_targets enable row level security;

create policy "Authorized Diocese users can read Diocese announcements"
on public.diocese_announcements
for select
to authenticated
using (public.current_user_can_view_diocese(diocese_id));

create policy "Diocese managers can create Diocese announcements"
on public.diocese_announcements
for insert
to authenticated
with check (public.current_user_can_manage_diocese(diocese_id));

create policy "Diocese managers can update Diocese announcements"
on public.diocese_announcements
for update
to authenticated
using (public.current_user_can_manage_diocese(diocese_id))
with check (public.current_user_can_manage_diocese(diocese_id));

create policy "Diocese managers can delete Diocese announcements"
on public.diocese_announcements
for delete
to authenticated
using (public.current_user_can_manage_diocese(diocese_id));

create policy "Authorized Diocese users can read Diocese announcement parish targets"
on public.diocese_announcement_parish_targets
for select
to authenticated
using (public.current_user_can_view_diocese(diocese_id));

create policy "Diocese managers can create Diocese announcement parish targets"
on public.diocese_announcement_parish_targets
for insert
to authenticated
with check (public.current_user_can_manage_diocese(diocese_id));

create policy "Diocese managers can update Diocese announcement parish targets"
on public.diocese_announcement_parish_targets
for update
to authenticated
using (public.current_user_can_manage_diocese(diocese_id))
with check (public.current_user_can_manage_diocese(diocese_id));

create policy "Diocese managers can delete Diocese announcement parish targets"
on public.diocese_announcement_parish_targets
for delete
to authenticated
using (public.current_user_can_manage_diocese(diocese_id));

revoke all on table public.diocese_announcements from public, anon, authenticated;
revoke all on table public.diocese_announcement_parish_targets from public, anon, authenticated;

grant select, insert, update, delete on table public.diocese_announcements to authenticated;
grant select, insert, update, delete on table public.diocese_announcement_parish_targets to authenticated;

grant select, insert, update, delete on table public.diocese_announcements to service_role;
grant select, insert, update, delete on table public.diocese_announcement_parish_targets to service_role;

revoke all on function public.validate_diocese_announcement_parish_target()
  from public, anon, authenticated;
revoke all on function public.get_diocese_announcements(uuid)
  from public, anon, authenticated;
revoke all on function public.save_diocese_announcement(uuid, uuid, text, text, text, text, uuid[])
  from public, anon, authenticated;
revoke all on function public.publish_diocese_announcement(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.archive_diocese_announcement(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.get_diocese_announcements(uuid)
  to authenticated, service_role;
grant execute on function public.save_diocese_announcement(uuid, uuid, text, text, text, text, uuid[])
  to authenticated, service_role;
grant execute on function public.publish_diocese_announcement(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.archive_diocese_announcement(uuid, uuid)
  to authenticated, service_role;
