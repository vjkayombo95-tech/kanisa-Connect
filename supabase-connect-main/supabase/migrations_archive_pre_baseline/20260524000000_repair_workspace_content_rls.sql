-- Restore management access for live workspace content tables.
create or replace function public.can_manage_church_workspace(_user_id uuid, _church_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _user_id is null or _church_id is null
     or to_regclass('public.user_roles') is null
     or (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'user_roles' and column_name in ('user_id', 'church_id', 'role')) <> 3 then
    return false;
  end if;
  return (
  _user_id is not null
    and _church_id is not null
    and (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = _user_id
          and ur.church_id = _church_id
          and lower(coalesce(ur.role::text, '')) in ('church_admin', 'admin', 'pastor', 'secretary', 'treasurer')
      )
      or exists (
        select 1
        from public.profiles p
        where p.id = _user_id
          and p.church_id = _church_id
          and lower(coalesce(p.role, '')) in ('church_admin', 'admin', 'pastor', 'secretary', 'treasurer')
      )
      or exists (
        select 1
        from public.churches c
        where c.id = _church_id
          and (_user_id = c.owner_id or _user_id = c.created_by)
      )
      or exists (
        select 1
        from public.super_admins sa
        where sa.id = _user_id
      )
    ));
end;
$$;

grant execute on function public.can_manage_church_workspace(uuid, uuid) to authenticated;

create or replace function public.can_view_church_workspace(_user_id uuid, _church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_church_workspace(_user_id, _church_id)
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = _user_id
        and ur.church_id = _church_id
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = _user_id
        and p.church_id = _church_id
    );
$$;

grant execute on function public.can_view_church_workspace(uuid, uuid) to authenticated;

-- Each workspace table may be absent on legacy/fresh compatibility schemas.
-- RLS is enabled and policies are added only when their complete contract exists.
DO $$
DECLARE
  _table text;
BEGIN
  FOREACH _table IN ARRAY ARRAY['communities', 'ministries', 'families', 'invitations'] LOOP
    IF to_regclass('public.' || _table) IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=_table AND column_name='church_id') THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', _table);
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=_table AND policyname='Workspace managers can manage ' || _table) THEN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_manage_church_workspace(auth.uid(), church_id)) WITH CHECK (public.can_manage_church_workspace(auth.uid(), church_id))', 'Workspace managers can manage ' || _table, _table);
      END IF;
    END IF;
  END LOOP;

  IF to_regclass('public.members') IS NOT NULL
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name IN ('church_id','user_id')) = 2 THEN
    ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='members' AND policyname='Workspace managers can manage members') THEN
      EXECUTE 'CREATE POLICY "Workspace managers can manage members" ON public.members FOR ALL TO authenticated USING (public.can_manage_church_workspace(auth.uid(), church_id)) WITH CHECK (public.can_manage_church_workspace(auth.uid(), church_id))';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='members' AND policyname='Church workspace users can view members') THEN
      EXECUTE 'CREATE POLICY "Church workspace users can view members" ON public.members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.can_view_church_workspace(auth.uid(), church_id))';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='members' AND policyname='Members can update own member record') THEN
      EXECUTE 'CREATE POLICY "Members can update own member record" ON public.members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    END IF;
  END IF;

  IF to_regclass('public.member_communities') IS NOT NULL
     AND to_regclass('public.communities') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_communities' AND column_name='community_id')
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='communities' AND column_name IN ('id','church_id')) = 2 THEN
    ALTER TABLE public.member_communities ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='member_communities' AND policyname='Workspace managers can manage member communities') THEN
      EXECUTE 'CREATE POLICY "Workspace managers can manage member communities" ON public.member_communities FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND public.can_manage_church_workspace(auth.uid(), c.church_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND public.can_manage_church_workspace(auth.uid(), c.church_id)))';
    END IF;
  END IF;

  IF to_regclass('public.member_ministries') IS NOT NULL
     AND to_regclass('public.ministries') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_ministries' AND column_name='ministry_id')
     AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='ministries' AND column_name IN ('id','church_id')) = 2 THEN
    ALTER TABLE public.member_ministries ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='member_ministries' AND policyname='Workspace managers can manage member ministries') THEN
      EXECUTE 'CREATE POLICY "Workspace managers can manage member ministries" ON public.member_ministries FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ministry_id AND public.can_manage_church_workspace(auth.uid(), m.church_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ministry_id AND public.can_manage_church_workspace(auth.uid(), m.church_id)))';
    END IF;
  END IF;
END $$;

-- The live communities table stores its chairperson in mwenyekiti_id.
create or replace function public.update_community_leadership(
  _community_id uuid,
  _role_field text,
  _member_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _church_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if _role_field not in ('mwenyekiti_id', 'makamu_mwenyekiti_id', 'mweka_hazina_id', 'katibu_id') then
    return jsonb_build_object('success', false, 'error', 'Invalid leadership role');
  end if;

  select c.church_id into _church_id
  from public.communities c
  where c.id = _community_id;

  if _church_id is null then
    return jsonb_build_object('success', false, 'error', 'Community not found');
  end if;

  if not public.can_manage_church_workspace(auth.uid(), _church_id) then
    return jsonb_build_object('success', false, 'error', 'You do not have permission to update this community');
  end if;

  if _member_id is not null and not exists (
    select 1
    from public.members m
    where m.id = _member_id
      and m.church_id = _church_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Selected member does not belong to this church');
  end if;

  execute format('update public.communities set %I = $1 where id = $2', _role_field)
  using _member_id, _community_id;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.update_community_leadership(uuid, text, uuid) to authenticated;
