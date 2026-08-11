-- Persist dual-track + star mark on signals; grant cron service_role on ingest tables.

alter table public.signals
  add column if not exists policy_track text,
  add column if not exists star_mark boolean not null default false;

alter table public.signals
  drop constraint if exists signals_policy_track_check;

alter table public.signals
  add constraint signals_policy_track_check
  check (
    policy_track is null
    or policy_track in ('storage_power_market', 'esg', 'both', 'none')
  );

comment on column public.signals.policy_track is
  'Dual-track label from AI ingest: storage_power_market | esg | both | none.';
comment on column public.signals.star_mark is
  'High-impact star for BESS commercial / mandatory / market-access effects; drives （***）.';

create index if not exists signals_policy_track_idx
  on public.signals (policy_track)
  where policy_track is not null;

create index if not exists signals_star_mark_idx
  on public.signals (star_mark)
  where star_mark = true;

-- Cron uses SUPABASE_SERVICE_ROLE_KEY; table privileges are still required.
grant select, insert, update, delete
  on public.policy_source_feeds,
     public.policy_ingest_runs,
     public.policy_ingest_skips
  to service_role;

-- Refresh anon column grant so public detail can read track / star.
revoke select on public.signals from anon;
grant select (
  id,
  region_id,
  signal_type,
  title,
  summary,
  body,
  category,
  policy_track,
  star_mark,
  original_status,
  normalized_status,
  event_date,
  effective_date,
  expires_at,
  impact_channel,
  impact_direction,
  impact_level,
  source_url,
  source_name,
  issuer,
  document_id,
  ai_importance,
  needs_human_review,
  reviewer_note,
  review_status,
  published_at,
  reviewed_at,
  crawled_at,
  is_demo,
  created_at,
  updated_at
) on public.signals to anon;
