-- Fold free-form duration labels (3h / 2.5h / <1h / …) into fixed chart buckets.

create or replace function public.bess_project_duration_bucket(
  duration_band text,
  duration_h numeric
)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
  parsed numeric;
  hours numeric;
begin
  cleaned := regexp_replace(coalesce(duration_band, ''), '\s+', '', 'g');

  if cleaned <> '' then
    if cleaned ~ '(未知|—|——|^-$)' then
      return '未知';
    end if;
    if cleaned ~ '(^≤?1h$|^1h$|^<1h$|时长≤1|≤1小时)' then
      return '≤1h';
    end if;
    if cleaned ~ '(1h<|1-2|1～2|1—2|1至2)' then
      return '1–2h';
    end if;
    if cleaned ~ '(^2h$|＝2h|=2h)' then
      return '2h';
    end if;
    if cleaned ~ '(2h<|2-4|2～4|2—4|2至4)' then
      return '2–4h';
    end if;
    if cleaned ~ '(^4h$|＝4h|=4h)' then
      return '4h';
    end if;
    if cleaned ~ '(4h<|≥4|≥4|>4|≥ 4)' then
      return '≥4h';
    end if;

    begin
      parsed := nullif(substring(cleaned from '([0-9]+(?:\.[0-9]+)?)'), '')::numeric;
    exception
      when others then
        parsed := null;
    end;
  end if;

  hours := coalesce(parsed, duration_h);
  if hours is null then
    return '未知';
  end if;
  if hours <= 1 then
    return '≤1h';
  end if;
  if hours < 2 then
    return '1–2h';
  end if;
  if hours = 2 then
    return '2h';
  end if;
  if hours < 4 then
    return '2–4h';
  end if;
  if hours = 4 then
    return '4h';
  end if;
  return '≥4h';
end;
$$;
