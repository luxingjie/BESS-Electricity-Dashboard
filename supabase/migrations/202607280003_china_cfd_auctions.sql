-- China wind/solar CfD (mechanism price, NDRC Doc 136) auction master table.
--
-- One row = one province-level grid area x auction round. This is reference
-- market data maintained by administrators (bulk-imported from BNEF and then
-- hand-corrected), so it follows the market_metrics pattern: a simple
-- is_published flag instead of the signal review pipeline.

create table public.china_cfd_auctions (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on update cascade on delete restrict,
  -- BNEF splits some provinces into grid areas (North/South Hebei, East/West
  -- Inner Mongolia), so the display label is stored separately from region_id.
  province_label text not null,
  province_label_en text,
  grid_region text,
  auction_round text,
  announcement_date date,
  delivery_year integer,
  commissioning_window text,
  status text,
  pot_design text,
  -- Prices in yuan per megawatt-hour. NULL always means "not published",
  -- never zero.
  onshore_wind_floor numeric,
  onshore_wind_cap numeric,
  onshore_wind_strike numeric,
  offshore_wind_floor numeric,
  offshore_wind_cap numeric,
  offshore_wind_strike numeric,
  solar_floor numeric,
  solar_cap numeric,
  solar_strike numeric,
  coal_benchmark numeric,
  -- Volumes in gigawatt-hours; subscription rate in percent.
  target_volume_gwh numeric,
  awarded_volume_gwh numeric,
  subscription_rate numeric,
  onshore_wind_target_gwh numeric,
  onshore_wind_awarded_gwh numeric,
  offshore_wind_target_gwh numeric,
  offshore_wind_awarded_gwh numeric,
  solar_target_gwh numeric,
  solar_awarded_gwh numeric,
  duration_years_onshore numeric,
  duration_years_offshore numeric,
  duration_years_solar numeric,
  note text,
  source_url text,
  source_name text,
  is_demo boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint china_cfd_auctions_label_not_blank check (btrim(province_label) <> '')
);

comment on table public.china_cfd_auctions is
  'Province x round CfD auction results under NDRC Document 136 (2025). NULL numeric values mean not published and must never be coerced to zero.';

create unique index china_cfd_auctions_natural_key
  on public.china_cfd_auctions (province_label, auction_round, delivery_year)
  nulls not distinct;
create index china_cfd_auctions_region_idx on public.china_cfd_auctions (region_id);
create index china_cfd_auctions_public_idx
  on public.china_cfd_auctions (announcement_date desc)
  where is_published = true;

create trigger china_cfd_auctions_set_updated_at
before update on public.china_cfd_auctions
for each row execute function public.set_updated_at();

alter table public.china_cfd_auctions enable row level security;

create policy china_cfd_auctions_public_read
on public.china_cfd_auctions
for select
to anon, authenticated
using (is_published = true);

create policy china_cfd_auctions_admin_all
on public.china_cfd_auctions
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant select on public.china_cfd_auctions to anon, authenticated;
grant insert, update, delete on public.china_cfd_auctions to authenticated;
-- service_role bypasses RLS but still needs SQL privileges; used only by
-- trusted operator scripts such as the BNEF workbook importer.
grant select, insert, update, delete on public.china_cfd_auctions to service_role;
