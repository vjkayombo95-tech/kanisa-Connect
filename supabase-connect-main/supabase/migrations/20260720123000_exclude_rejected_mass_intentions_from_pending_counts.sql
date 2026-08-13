-- Rejected and otherwise terminal Mass intentions must not remain in the
-- Church Admin Action Required queue solely because payment is still unpaid.

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
    when 'mass_intentions' then '(coalesce(status, ''pending'') = ''pending'' or (coalesce(status, ''pending'') in (''approved'', ''scheduled'') and coalesce(payment_status, ''pending'') in (''pending'', ''unpaid'', ''submitted'')))'
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
