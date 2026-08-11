-- CESA-style storage project tender / award / commissioning events.
-- Follows market_metrics: is_published flag (no signal review pipeline).
-- region_id is nullable: unmapped / multi-province rows stay public as 「未知」.

create type public.bess_project_event_type as enum (
  'tender',
  'award',
  'commissioning'
);

create table public.bess_project_events (
  id uuid primary key default gen_random_uuid(),
  event_type public.bess_project_event_type not null,
  title text not null,
  event_date date not null,
  region_id uuid references public.regions(id) on update cascade on delete restrict,
  province_label text not null default '未知',
  province_raw text,
  city_raw text,
  region_bloc text,
  power_mw numeric,
  energy_mwh numeric,
  duration_h numeric,
  duration_band text,
  scale_label text,
  c_rate numeric,
  scene text,
  plant_type text,
  technology text,
  owner_name text,
  owner_group text,
  counterparty_name text,
  scope_label text,
  status_label text,
  summary text,
  budget_wan numeric,
  unit_price_cap_yuan_per_wh numeric,
  result_date date,
  source_name text not null,
  source_batch text not null,
  source_row_hash text not null,
  raw jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bess_project_events_title_not_blank check (btrim(title) <> ''),
  constraint bess_project_events_province_label_not_blank check (btrim(province_label) <> ''),
  constraint bess_project_events_source_name_not_blank check (btrim(source_name) <> ''),
  constraint bess_project_events_source_batch_not_blank check (btrim(source_batch) <> ''),
  constraint bess_project_events_source_row_hash_not_blank check (btrim(source_row_hash) <> '')
);

comment on table public.bess_project_events is
  'Storage project tender, award, and commissioning events. NULL numerics mean unknown/unpublished and must never be coerced to zero. Unmapped provinces keep region_id null with province_label = 未知.';

comment on column public.bess_project_events.power_mw is
  'Installed power in MW. NULL means not published.';
comment on column public.bess_project_events.energy_mwh is
  'Energy capacity in MWh. NULL means not published.';

create unique index bess_project_events_source_hash_unique
  on public.bess_project_events (source_name, source_row_hash);
create index bess_project_events_public_idx
  on public.bess_project_events (event_type, event_date desc)
  where is_published = true;
create index bess_project_events_region_idx
  on public.bess_project_events (region_id)
  where region_id is not null;
create index bess_project_events_batch_idx
  on public.bess_project_events (source_batch);

create trigger bess_project_events_set_updated_at
before update on public.bess_project_events
for each row execute function public.set_updated_at();

create table public.bess_award_candidates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.bess_project_events(id)
    on update cascade on delete cascade,
  rank_label text not null,
  rank_order integer,
  candidate_name text not null,
  candidate_group text,
  bid_amount_wan numeric,
  unit_price_yuan_per_wh numeric,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bess_award_candidates_rank_not_blank check (btrim(rank_label) <> ''),
  constraint bess_award_candidates_name_not_blank check (btrim(candidate_name) <> '')
);

comment on table public.bess_award_candidates is
  'Ranked award candidates for bess_project_events of type award. Bid amounts NULL mean not published.';

create index bess_award_candidates_event_idx
  on public.bess_award_candidates (event_id, rank_order nulls last, created_at);

create trigger bess_award_candidates_set_updated_at
before update on public.bess_award_candidates
for each row execute function public.set_updated_at();

alter table public.bess_project_events enable row level security;
alter table public.bess_award_candidates enable row level security;

create policy bess_project_events_public_read
on public.bess_project_events
for select
to anon, authenticated
using (is_published = true);

create policy bess_project_events_admin_all
on public.bess_project_events
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Candidates are readable when their parent event is published.
create policy bess_award_candidates_public_read
on public.bess_award_candidates
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.bess_project_events e
    where e.id = event_id
      and e.is_published = true
  )
);

create policy bess_award_candidates_admin_all
on public.bess_award_candidates
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant select on public.bess_project_events, public.bess_award_candidates to anon, authenticated;
grant insert, update, delete on public.bess_project_events, public.bess_award_candidates to authenticated;
grant select, insert, update, delete on public.bess_project_events, public.bess_award_candidates to service_role;
