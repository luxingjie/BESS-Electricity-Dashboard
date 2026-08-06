-- Align direct PostgREST access with the Viewer API DTO.
-- Anonymous and ordinary authenticated users may read published business
-- fields, but never importer batch identifiers, row hashes, or raw workbook
-- metadata. service_role retains the full trusted-operator surface.

revoke select on public.bess_project_events from anon, authenticated;

-- is_published and created_at support explicit publication filtering and stable
-- ordering in PostgREST. They are omitted again by the Viewer DTO.
grant select (
  id,
  event_type,
  title,
  event_date,
  region_id,
  province_label,
  province_raw,
  city_raw,
  region_bloc,
  power_mw,
  energy_mwh,
  duration_h,
  duration_band,
  scale_label,
  c_rate,
  scene,
  plant_type,
  technology,
  owner_name,
  owner_group,
  counterparty_name,
  scope_label,
  status_label,
  summary,
  budget_wan,
  unit_price_cap_yuan_per_wh,
  result_date,
  source_name,
  is_demo,
  is_published,
  created_at
) on public.bess_project_events to anon, authenticated;

revoke select on public.bess_award_candidates from anon, authenticated;

-- event_id is required for parent filtering/joins and is omitted by the DTO.
grant select (
  id,
  event_id,
  rank_label,
  rank_order,
  candidate_name,
  candidate_group,
  bid_amount_wan,
  unit_price_yuan_per_wh,
  is_primary
) on public.bess_award_candidates to anon, authenticated;

-- Trusted imports and maintenance need the complete storage record.
grant select on public.bess_project_events, public.bess_award_candidates
to service_role;
