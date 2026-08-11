alter table public.china_cfd_auctions
  add column if not exists implementation_plan_url text,
  add column if not exists implementation_plan_name text;

comment on column public.china_cfd_auctions.implementation_plan_url is
  'Province-level Doc 136 local implementation plan URL (from BNEF Progress update). Distinct from auction result announcement source_url.';
comment on column public.china_cfd_auctions.implementation_plan_name is
  'Display label for the local implementation plan link.';
