-- Extra policy document links from BNEF Auction terms / Legacy sheets.
-- Distinct from result announcement (source_url) and local implementation plan.

alter table public.china_cfd_auctions
  add column if not exists announcement_url text,
  add column if not exists announcement_name text,
  add column if not exists supplemental_url text,
  add column if not exists supplemental_name text,
  add column if not exists legacy_coverage_ratio numeric,
  add column if not exists legacy_strike numeric,
  add column if not exists legacy_duration_years numeric,
  add column if not exists legacy_note text,
  add column if not exists legacy_url text;

comment on column public.china_cfd_auctions.announcement_url is
  'Auction announcement / tender notice URL (BNEF Auction terms).';
comment on column public.china_cfd_auctions.announcement_name is
  'Display label for the auction announcement link.';
comment on column public.china_cfd_auctions.supplemental_url is
  'Supplemental policy document URL when published separately.';
comment on column public.china_cfd_auctions.supplemental_name is
  'Display label for the supplemental document link.';
comment on column public.china_cfd_auctions.legacy_coverage_ratio is
  'Pre-Doc-136 / legacy project-level CfD coverage ratio (percent), province-level.';
comment on column public.china_cfd_auctions.legacy_strike is
  'Legacy CfD strike price (yuan/MWh), province-level.';
comment on column public.china_cfd_auctions.legacy_duration_years is
  'Legacy CfD duration in years, province-level.';
comment on column public.china_cfd_auctions.legacy_note is
  'Legacy projects note (prefer Chinese text from Legacy projects-CN).';
comment on column public.china_cfd_auctions.legacy_url is
  'Legacy projects policy / reference URL.';
