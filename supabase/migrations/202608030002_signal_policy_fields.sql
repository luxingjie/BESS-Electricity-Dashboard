-- Minimum policy field set: body, issuer, expiry, crawl time, human-review flag.
-- Also expose selected provenance columns to public (anon) readers.

alter table public.signals
  add column if not exists body text,
  add column if not exists issuer text,
  add column if not exists expires_at date,
  add column if not exists needs_human_review boolean not null default false,
  add column if not exists crawled_at timestamptz;

comment on column public.signals.body is
  'Fuller policy main text / key points; summary remains the short lead.';
comment on column public.signals.issuer is
  'Issuing agency or authority; may differ from source_name (feed/site label).';
comment on column public.signals.expires_at is
  'Policy expiry / repeal date when known; null means unknown or not time-bound.';
comment on column public.signals.needs_human_review is
  'Explicit queue flag: true for ai_draft / pending_review; false after publish or auto-publish.';
comment on column public.signals.crawled_at is
  'When the source document was fetched / ingested; distinct from published_at.';

update public.signals
set crawled_at = coalesce(crawled_at, created_at)
where crawled_at is null;

update public.signals
set issuer = coalesce(nullif(btrim(issuer), ''), nullif(btrim(source_name), ''))
where issuer is null;

update public.signals
set needs_human_review = true
where review_status in ('ai_draft', 'pending_review');

update public.signals
set needs_human_review = false
where review_status in ('published', 'rejected');

create index if not exists signals_needs_human_review_idx
  on public.signals (needs_human_review, updated_at desc)
  where needs_human_review = true;

create index if not exists signals_expires_at_idx
  on public.signals (expires_at)
  where expires_at is not null;

create index if not exists signals_crawled_at_idx
  on public.signals (crawled_at desc nulls last);

-- Refresh anon column grant so public detail can read the expanded field set.
revoke select on public.signals from anon;
grant select (
  id,
  region_id,
  signal_type,
  title,
  summary,
  body,
  category,
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
