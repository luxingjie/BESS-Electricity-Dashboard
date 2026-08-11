-- Server-side analytics + type counts for bess_project_events.
-- Avoids shipping thousands of rows to Node for chart aggregation.

create or replace function public.bess_project_scene_bucket(scene text)
returns text
language sql
immutable
as $$
  select case
    when scene is null or btrim(scene) = '' or scene in ('——', '—', '-') then '其他'
    when scene ~ '电源|发电' then '发电侧'
    when scene ~ '电网' then '电网侧'
    when scene ~ '用户' then '用户侧'
    else '其他'
  end;
$$;

create or replace function public.bess_project_duration_bucket(
  duration_band text,
  duration_h numeric
)
returns text
language sql
immutable
as $$
  select case
    when duration_band is not null and btrim(duration_band) <> '' then
      case
        when regexp_replace(duration_band, '\s+', '', 'g') ~ '(^≤?1h$|^1h$|时长≤1|≤1小时)' then '≤1h'
        when regexp_replace(duration_band, '\s+', '', 'g') ~ '(1h<|1-2|1～2|1—2)' then '1–2h'
        when regexp_replace(duration_band, '\s+', '', 'g') ~ '(^2h$|＝2h|=2h)' then '2h'
        when regexp_replace(duration_band, '\s+', '', 'g') ~ '(2h<|2-4|2～4|2—4)' then '2–4h'
        when regexp_replace(duration_band, '\s+', '', 'g') ~ '(^4h$|＝4h|=4h)' then '4h'
        when regexp_replace(duration_band, '\s+', '', 'g') ~ '(4h<|≥4|≥ 4|>4|8h)' then '≥4h'
        when regexp_replace(duration_band, '\s+', '', 'g') ~ '(未知|—|——)' then '未知'
        else left(btrim(duration_band), 12)
      end
    when duration_h is null then '未知'
    when duration_h <= 1 then '≤1h'
    when duration_h < 2 then '1–2h'
    when duration_h = 2 then '2h'
    when duration_h < 4 then '2–4h'
    when duration_h = 4 then '4h'
    else '≥4h'
  end;
$$;

create or replace function public.bess_project_scope_bucket(scope_label text)
returns text
language sql
immutable
as $$
  select case
    when scope_label is null or btrim(scope_label) = '' or scope_label in ('——', '—', '-') then '其他'
    when scope_label ~* '电芯|电池芯|电芯模组' then '电芯'
    when scope_label ~* 'EPC|总承包|PC承包|设计施工' then 'EPC'
    when scope_label ~* '储能系统|系统设备|储能柜|一体柜|BESS|电池系统' then '储能系统'
    else '其他'
  end;
$$;

create or replace function public.bess_project_events_analytics(
  p_event_type text default null,
  p_province text default null,
  p_scene text default null,
  p_plant_type text default null,
  p_search text default null,
  p_region_ids uuid[] default null,
  p_include_unknown boolean default true,
  p_date_from date default null,
  p_date_to date default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  result jsonb;
begin
  with filtered as (
    select
      e.event_date,
      e.event_type,
      coalesce(nullif(btrim(e.province_label), ''), '未知') as province_label,
      public.bess_project_scene_bucket(e.scene) as scene_bucket,
      public.bess_project_duration_bucket(e.duration_band, e.duration_h) as duration_bucket,
      public.bess_project_scope_bucket(e.scope_label) as scope_bucket,
      e.power_mw,
      e.energy_mwh
    from public.bess_project_events e
    where e.is_published = true
      and (p_event_type is null or e.event_type::text = p_event_type)
      and (p_province is null or e.province_label = p_province)
      and (p_scene is null or e.scene = p_scene)
      and (p_plant_type is null or e.plant_type = p_plant_type)
      and (p_date_from is null or e.event_date >= p_date_from)
      and (p_date_to is null or e.event_date <= p_date_to)
      and (
        p_region_ids is null
        or cardinality(p_region_ids) = 0
        or e.region_id = any (p_region_ids)
        or (p_include_unknown and e.region_id is null)
      )
      and (
        p_search is null
        or btrim(p_search) = ''
        or e.title ilike '%' || p_search || '%'
        or coalesce(e.owner_name, '') ilike '%' || p_search || '%'
        or coalesce(e.owner_group, '') ilike '%' || p_search || '%'
        or coalesce(e.scope_label, '') ilike '%' || p_search || '%'
        or coalesce(e.province_raw, '') ilike '%' || p_search || '%'
      )
  ),
  type_counts as (
    select jsonb_object_agg(event_type, cnt) as counts
    from (
      select event_type::text as event_type, count(*)::int as cnt
      from filtered
      group by event_type
    ) t
  ),
  by_month as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key', month_key,
          'label', month_key,
          'count', cnt,
          'power_mw', power_mw,
          'energy_mwh', energy_mwh
        )
        order by month_key
      ),
      '[]'::jsonb
    ) as buckets
    from (
      select
        to_char(event_date, 'YYYY-MM') as month_key,
        count(*)::int as cnt,
        round(sum(power_mw)::numeric, 1) as power_mw,
        round(sum(energy_mwh)::numeric, 1) as energy_mwh
      from filtered
      where event_date is not null
      group by 1
    ) m
  ),
  province_ranked as (
    select
      province_label,
      count(*)::int as cnt,
      round(sum(power_mw)::numeric, 1) as power_mw,
      round(sum(energy_mwh)::numeric, 1) as energy_mwh,
      row_number() over (order by count(*) desc, province_label) as rn
    from filtered
    group by province_label
  ),
  by_province as (
    select
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'key', province_label,
              'label', province_label,
              'count', cnt,
              'power_mw', power_mw,
              'energy_mwh', energy_mwh
            )
            order by rn
          )
          from province_ranked
          where rn <= 10
        ),
        '[]'::jsonb
      )
      ||
      case
        when exists (select 1 from province_ranked where rn > 10) then
          jsonb_build_array(
            jsonb_build_object(
              'key', '__other__',
              'label', '其他',
              'count', (select coalesce(sum(cnt), 0)::int from province_ranked where rn > 10),
              'power_mw', (select round(coalesce(sum(power_mw), 0)::numeric, 1) from province_ranked where rn > 10),
              'energy_mwh', (select round(coalesce(sum(energy_mwh), 0)::numeric, 1) from province_ranked where rn > 10)
            )
          )
        else '[]'::jsonb
      end as buckets
  ),
  by_scene as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key', scene_bucket,
          'label', scene_bucket,
          'count', cnt,
          'power_mw', power_mw,
          'energy_mwh', energy_mwh
        )
        order by array_position(array['发电侧','电网侧','用户侧','其他'], scene_bucket)
      ),
      '[]'::jsonb
    ) as buckets
    from (
      select
        scene_bucket,
        count(*)::int as cnt,
        round(sum(power_mw)::numeric, 1) as power_mw,
        round(sum(energy_mwh)::numeric, 1) as energy_mwh
      from filtered
      group by scene_bucket
    ) s
  ),
  by_duration as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key', duration_bucket,
          'label', duration_bucket,
          'count', cnt,
          'power_mw', power_mw,
          'energy_mwh', energy_mwh
        )
        order by array_position(
          array['≤1h','1–2h','2h','2–4h','4h','≥4h','未知'],
          duration_bucket
        ) nulls last
      ),
      '[]'::jsonb
    ) as buckets
    from (
      select
        duration_bucket,
        count(*)::int as cnt,
        round(sum(power_mw)::numeric, 1) as power_mw,
        round(sum(energy_mwh)::numeric, 1) as energy_mwh
      from filtered
      group by duration_bucket
    ) d
  ),
  by_scope as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key', scope_bucket,
          'label', scope_bucket,
          'count', cnt,
          'power_mw', power_mw,
          'energy_mwh', energy_mwh
        )
        order by array_position(array['EPC','储能系统','电芯','其他'], scope_bucket)
      ),
      '[]'::jsonb
    ) as buckets
    from (
      select
        scope_bucket,
        count(*)::int as cnt,
        round(sum(power_mw)::numeric, 1) as power_mw,
        round(sum(energy_mwh)::numeric, 1) as energy_mwh
      from filtered
      group by scope_bucket
    ) s
  )
  select jsonb_build_object(
    'sample_size', (select count(*)::int from filtered),
    'counts', jsonb_build_object(
      'all', (select count(*)::int from filtered),
      'tender', coalesce((select (counts->>'tender')::int from type_counts), 0),
      'award', coalesce((select (counts->>'award')::int from type_counts), 0),
      'commissioning', coalesce((select (counts->>'commissioning')::int from type_counts), 0)
    ),
    'by_month', (select buckets from by_month),
    'by_province', (select buckets from by_province),
    'by_scene', (select buckets from by_scene),
    'by_duration', (select buckets from by_duration),
    'by_scope', (select buckets from by_scope),
    'date_min', (select min(event_date) from filtered),
    'date_max', (select max(event_date) from filtered)
  )
  into result;

  return result;
end;
$$;

comment on function public.bess_project_events_analytics is
  'Public analytics aggregates for published BESS project events. Invoker respects RLS.';

grant execute on function public.bess_project_scene_bucket(text) to anon, authenticated, service_role;
grant execute on function public.bess_project_duration_bucket(text, numeric) to anon, authenticated, service_role;
grant execute on function public.bess_project_scope_bucket(text) to anon, authenticated, service_role;
grant execute on function public.bess_project_events_analytics(
  text, text, text, text, text, uuid[], boolean, date, date
) to anon, authenticated, service_role;

create index if not exists bess_project_events_event_date_idx
  on public.bess_project_events (event_date desc)
  where is_published = true;
