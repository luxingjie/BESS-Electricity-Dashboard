-- Daily AI auto-publish counters on policy ingest runs.
alter table public.policy_ingest_runs
  add column if not exists auto_published integer not null default 0,
  add column if not exists drafts_retained integer not null default 0,
  add column if not exists drafts_cleaned integer not null default 0;

comment on column public.policy_ingest_runs.auto_published is
  'Signals created and auto-published in this run';
comment on column public.policy_ingest_runs.drafts_retained is
  'Signals created as ai_draft (below auto-publish threshold) in this run';
comment on column public.policy_ingest_runs.drafts_cleaned is
  'Stale or duplicate ai_draft rows deleted during this run';
comment on column public.policy_ingest_runs.weekly_cap is
  'Daily ingest ceiling for this run (column name retained for compatibility)';
