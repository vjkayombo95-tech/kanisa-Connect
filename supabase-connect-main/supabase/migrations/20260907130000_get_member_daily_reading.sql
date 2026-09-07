create or replace function public.get_member_daily_reading(p_reading_date date)
returns table (
  id uuid,
  reading_date date,
  source text,
  language_code text,
  status text,
  liturgical_day_id uuid,
  celebration text,
  liturgical_season text,
  liturgical_year text,
  weekday_cycle text,
  liturgical_color text,
  rank text,
  lectionary_number text,
  first_reading_reference text,
  responsorial_psalm_reference text,
  second_reading_reference text,
  gospel_acclamation_reference text,
  gospel_reference text,
  reflection text,
  prayer text,
  is_reference_only boolean,
  source_attribution text,
  source_organization text,
  source_publication text,
  source_year integer,
  source_edition text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_reading_date is null then
    raise exception 'Reading date is required' using errcode = '22023';
  end if;

  return query
  with cms_candidate as (
    select
      cdr.id,
      cdr.reading_date,
      'cms'::text as source,
      cl.code as language_code,
      cdr.status,
      ld.id as liturgical_day_id,
      coalesce(nullif(ld.celebration, ''), nullif(cdr.celebration, '')) as celebration,
      coalesce(nullif(ld.season, ''), nullif(cdr.liturgical_season, '')) as liturgical_season,
      coalesce(nullif(ld.liturgical_year, ''), nullif(cdr.liturgical_year, '')) as liturgical_year,
      ld.weekday_cycle,
      coalesce(nullif(ld.liturgical_color, ''), nullif(cdr.liturgical_color, '')) as liturgical_color,
      ld.rank,
      ld.lectionary_number,
      cdr.first_reading_reference,
      cdr.responsorial_psalm_reference,
      cdr.second_reading_reference,
      cdr.gospel_acclamation_reference,
      cdr.gospel_reference,
      cdr.reflection,
      cdr.prayer,
      true as is_reference_only,
      cdr.source_attribution,
      cib.source_organization,
      cib.source_publication,
      cib.source_year,
      cib.source_edition
    from public.content_daily_readings cdr
    left join public.content_languages cl on cl.id = cdr.language_id
    left join public.liturgical_days ld on ld.date = cdr.reading_date
    left join public.content_import_batches cib on cib.id = cdr.import_batch_id
    where cdr.reading_date = p_reading_date
      and cdr.status in ('published', 'featured')
      and cdr.visibility in ('public', 'member')
      and (cl.code in ('sw', 'en') or cdr.language_id is null)
    order by
      case
        when cl.code = 'sw' then 1
        when cl.code = 'en' then 2
        when cdr.language_id is null then 3
        else 4
      end asc,
      case
        when cdr.status = 'featured' then 1
        when cdr.status = 'published' then 2
        else 3
      end asc,
      cdr.updated_at desc,
      cdr.created_at desc,
      cdr.id asc
    limit 1
  ),
  legacy_candidate as (
    select
      dr.id,
      dr.reading_date,
      'legacy'::text as source,
      null::text as language_code,
      'published'::text as status,
      ld.id as liturgical_day_id,
      nullif(ld.celebration, '') as celebration,
      coalesce(nullif(ld.season, ''), nullif(dr.liturgical_season, '')) as liturgical_season,
      nullif(ld.liturgical_year, '') as liturgical_year,
      nullif(ld.weekday_cycle, '') as weekday_cycle,
      nullif(ld.liturgical_color, '') as liturgical_color,
      ld.rank,
      ld.lectionary_number,
      coalesce(nullif(dr.first_reading_reference, ''), 'Daily reading reference pending') as first_reading_reference,
      coalesce(nullif(dr.responsorial_psalm_reference, ''), 'Psalm reference pending') as responsorial_psalm_reference,
      dr.second_reading_reference,
      dr.gospel_acclamation as gospel_acclamation_reference,
      coalesce(nullif(dr.gospel_reference, ''), 'Gospel reference pending') as gospel_reference,
      dr.reflection,
      dr.prayer,
      not (
        nullif(btrim(coalesce(dr.first_reading, '')), '') is not null
        or nullif(btrim(coalesce(dr.psalm, '')), '') is not null
        or nullif(btrim(coalesce(dr.second_reading, '')), '') is not null
        or nullif(btrim(coalesce(dr.gospel, '')), '') is not null
        or exists (
          select 1
          from public.daily_reading_passages drp
          where drp.daily_reading_id = dr.id
            and nullif(btrim(coalesce(drp.text, '')), '') is not null
        )
      ) as is_reference_only,
      null::text as source_attribution,
      null::text as source_organization,
      null::text as source_publication,
      null::integer as source_year,
      null::text as source_edition
    from public.daily_readings dr
    left join public.liturgical_days ld on ld.id = dr.liturgical_day_id
    where dr.reading_date = p_reading_date
      and dr.is_published = true
      and not exists (select 1 from cms_candidate)
    order by dr.updated_at desc, dr.id asc
    limit 1
  )
  select * from cms_candidate
  union all
  select * from legacy_candidate
  limit 1;
end;
$$;

revoke all on function public.get_member_daily_reading(date) from public;
revoke all on function public.get_member_daily_reading(date) from anon;
grant execute on function public.get_member_daily_reading(date) to authenticated;

comment on function public.get_member_daily_reading(date) is
  'Authenticated canonical member Daily Readings boundary. Uses Tanzania date supplied by the client, deterministic language/publication precedence, and explicit temporary legacy compatibility.';
