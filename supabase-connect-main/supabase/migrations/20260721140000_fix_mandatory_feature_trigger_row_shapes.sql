-- Keep mandatory platform and church feature recovery paths immutable without
-- evaluating OLD/NEW fields that do not exist for the current trigger target.

create or replace function public.protect_mandatory_feature()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old_feature_is_mandatory boolean := false;
  v_new_feature_is_mandatory boolean := false;
begin
  if tg_table_schema = 'public' and tg_table_name = 'platform_features' then
    if tg_op = 'DELETE' then
      if old.is_mandatory then
        raise exception 'Mandatory recovery feature cannot be weakened or removed'
          using errcode = '23514';
      end if;
      return old;
    elsif tg_op = 'UPDATE' then
      if old.is_mandatory and (
        new.is_mandatory is not true
        or new.globally_enabled is not true
        or new.globally_locked is not true
        or new.id is distinct from old.id
        or new.key is distinct from old.key
      ) then
        raise exception 'Mandatory recovery feature cannot be weakened or removed'
          using errcode = '23514';
      end if;
      if new.is_mandatory
         and (new.globally_enabled is not true or new.globally_locked is not true) then
        raise exception 'Mandatory recovery feature must be enabled and locked'
          using errcode = '23514';
      end if;
      return new;
    elsif tg_op = 'INSERT' then
      if new.is_mandatory
         and (new.globally_enabled is not true or new.globally_locked is not true) then
        raise exception 'Mandatory recovery feature must be enabled and locked'
          using errcode = '23514';
      end if;
      return new;
    end if;
  elsif tg_table_schema = 'public' and tg_table_name = 'church_features' then
    if tg_op = 'DELETE' then
      select pf.is_mandatory
        into v_old_feature_is_mandatory
      from public.platform_features pf
      where pf.id = old.feature_id;

      if coalesce(v_old_feature_is_mandatory, false) then
        raise exception 'Mandatory church recovery feature cannot be weakened or removed'
          using errcode = '23514';
      end if;
      return old;
    elsif tg_op = 'UPDATE' then
      select pf.is_mandatory
        into v_old_feature_is_mandatory
      from public.platform_features pf
      where pf.id = old.feature_id;

      select pf.is_mandatory
        into v_new_feature_is_mandatory
      from public.platform_features pf
      where pf.id = new.feature_id;

      if coalesce(v_old_feature_is_mandatory, false) and (
        new.enabled is not true
        or new.locked is not true
        or new.feature_id is distinct from old.feature_id
        or new.church_id is distinct from old.church_id
      ) then
        raise exception 'Mandatory church recovery feature cannot be weakened or removed'
          using errcode = '23514';
      end if;
      if coalesce(v_new_feature_is_mandatory, false)
         and (new.enabled is not true or new.locked is not true) then
        raise exception 'Mandatory church recovery feature must be enabled and locked'
          using errcode = '23514';
      end if;
      return new;
    elsif tg_op = 'INSERT' then
      select pf.is_mandatory
        into v_new_feature_is_mandatory
      from public.platform_features pf
      where pf.id = new.feature_id;

      if coalesce(v_new_feature_is_mandatory, false)
         and (new.enabled is not true or new.locked is not true) then
        raise exception 'Mandatory church recovery feature must be enabled and locked'
          using errcode = '23514';
      end if;
      return new;
    end if;
  end if;

  raise exception 'protect_mandatory_feature is attached to unsupported operation %.% on %.%',
    tg_op, tg_when, tg_table_schema, tg_table_name
    using errcode = '55000';
end;
$$;

drop trigger if exists protect_mandatory_platform_feature on public.platform_features;
create trigger protect_mandatory_platform_feature
before insert or update or delete on public.platform_features
for each row execute function public.protect_mandatory_feature();

drop trigger if exists protect_mandatory_church_feature on public.church_features;
create trigger protect_mandatory_church_feature
before insert or update or delete on public.church_features
for each row execute function public.protect_mandatory_feature();

revoke all on function public.protect_mandatory_feature()
from public, anon, authenticated, service_role;
