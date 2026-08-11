-- Policy ingest: Malaysia/Indonesia regions, whitelist feeds, run/skip logs,
-- and optional provenance columns on signals.

insert into public.regions (
  id, slug, code, name_zh, name_en, region_type, parent_id, is_demo
)
values
  (
    '00000000-0000-4000-8000-000000000219',
    'malaysia',
    'MY',
    '马来西亚',
    'Malaysia',
    'country',
    '00000000-0000-4000-8000-000000000101',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000220',
    'indonesia',
    'ID',
    '印度尼西亚',
    'Indonesia',
    'country',
    '00000000-0000-4000-8000-000000000101',
    true
  )
on conflict (id) do nothing;

alter table public.signals
  add column if not exists feed_id uuid,
  add column if not exists ingest_run_id uuid,
  add column if not exists content_hash text,
  add column if not exists ai_importance double precision,
  add column if not exists document_id text;

create unique index if not exists signals_content_hash_unique
  on public.signals (content_hash)
  where content_hash is not null;

create unique index if not exists signals_document_id_unique
  on public.signals (document_id)
  where document_id is not null;

create index if not exists signals_source_url_idx
  on public.signals (source_url)
  where source_url is not null;

create table if not exists public.policy_source_feeds (
  id uuid primary key,
  region_slug text not null,
  name text not null,
  list_url text not null,
  source_name text not null,
  language text not null default 'en',
  enabled boolean not null default true,
  priority integer not null default 50,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint policy_source_feeds_name_not_blank check (btrim(name) <> ''),
  constraint policy_source_feeds_list_url_http check (list_url ~* '^https?://'),
  constraint policy_source_feeds_region_slug_not_blank check (btrim(region_slug) <> '')
);

create index if not exists policy_source_feeds_enabled_priority_idx
  on public.policy_source_feeds (enabled, priority desc);

create table if not exists public.policy_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('cron', 'manual')),
  status text not null check (status in ('running', 'completed', 'failed', 'cancelled')),
  lookback_days integer not null default 14,
  weekly_cap integer not null default 12,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  feeds_scanned integer not null default 0,
  candidates_seen integer not null default 0,
  drafts_created integer not null default 0,
  skips_recorded integer not null default 0,
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists policy_ingest_runs_started_at_idx
  on public.policy_ingest_runs (started_at desc);

create table if not exists public.policy_ingest_skips (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.policy_ingest_runs(id) on delete cascade,
  feed_id uuid references public.policy_source_feeds(id) on delete set null,
  source_url text,
  title text,
  reason text not null check (
    reason in (
      'duplicate',
      'not_policy',
      'commentary',
      'out_of_scope',
      'fetch_error',
      'no_source_url',
      'below_importance',
      'weekly_cap',
      'stale'
    )
  ),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists policy_ingest_skips_run_id_idx
  on public.policy_ingest_skips (run_id, created_at desc);

create index if not exists policy_ingest_skips_reason_idx
  on public.policy_ingest_skips (reason);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'policy_source_feeds_set_updated_at'
  ) then
    create trigger policy_source_feeds_set_updated_at
    before update on public.policy_source_feeds
    for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'policy_ingest_runs_set_updated_at'
  ) then
    create trigger policy_ingest_runs_set_updated_at
    before update on public.policy_ingest_runs
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.policy_source_feeds enable row level security;
alter table public.policy_ingest_runs enable row level security;
alter table public.policy_ingest_skips enable row level security;

drop policy if exists policy_source_feeds_admin_all on public.policy_source_feeds;
create policy policy_source_feeds_admin_all
on public.policy_source_feeds
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists policy_ingest_runs_admin_all on public.policy_ingest_runs;
create policy policy_ingest_runs_admin_all
on public.policy_ingest_runs
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists policy_ingest_skips_admin_all on public.policy_ingest_skips;
create policy policy_ingest_skips_admin_all
on public.policy_ingest_skips
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant select, insert, update, delete on public.policy_source_feeds to authenticated;
grant select, insert, update, delete on public.policy_ingest_runs to authenticated;
grant select, insert, update, delete on public.policy_ingest_skips to authenticated;

-- Starter whitelist (official list pages only; no open-web search).
insert into public.policy_source_feeds (
  id, region_slug, name, list_url, source_name, language, enabled, priority, notes
)
values
  ('10000000-0000-4000-8000-000000000001', 'china', '国家能源局 — 政策法规', 'https://www.nea.gov.cn/policy/index.htm', '国家能源局', 'zh', true, 100, '中国国家级能源政策主入口'),
  ('10000000-0000-4000-8000-000000000002', 'china', '国家发展改革委 — 政策发布', 'https://www.ndrc.gov.cn/xxgk/zcfb/', '国家发展改革委', 'zh', true, 95, null),
  ('10000000-0000-4000-8000-000000000010', 'india', 'Ministry of Power — Notices', 'https://powermin.gov.in/en/content/notices', 'Ministry of Power (India)', 'en', true, 80, null),
  ('10000000-0000-4000-8000-000000000011', 'india', 'CERC — Orders / Regulations', 'https://cercind.gov.in/orders.html', 'CERC', 'en', true, 75, null),
  ('10000000-0000-4000-8000-000000000020', 'malaysia', 'Energy Commission Malaysia — Announcements', 'https://www.st.gov.my/en/web/consumer/details/2/8', 'Suruhanjaya Tenaga', 'en', true, 60, null),
  ('10000000-0000-4000-8000-000000000021', 'indonesia', 'Ministry of Energy and Mineral Resources — Regulations', 'https://www.esdm.go.id/en/regulation', 'ESDM', 'en', true, 60, null),
  ('10000000-0000-4000-8000-000000000030', 'australia', 'AEMC — Rules & determinations', 'https://www.aemc.gov.au/rule-changes', 'AEMC', 'en', true, 70, null),
  ('10000000-0000-4000-8000-000000000031', 'australia', 'AEMO — Market notices', 'https://aemo.com.au/market-notices', 'AEMO', 'en', true, 65, null),
  ('10000000-0000-4000-8000-000000000040', 'south-korea', 'MOTIE — Press / Policy', 'https://english.motie.go.kr/en/pc/pressreleases/bbs/bbsList.do?bbs_cd_n=2', 'MOTIE', 'en', true, 55, null),
  ('10000000-0000-4000-8000-000000000041', 'japan', 'METI — News Releases', 'https://www.meti.go.jp/english/press/index.html', 'METI', 'en', true, 55, null),
  ('10000000-0000-4000-8000-000000000050', 'united-kingdom', 'OFGEM — Publications', 'https://www.ofgem.gov.uk/publications', 'OFGEM', 'en', true, 70, null),
  ('10000000-0000-4000-8000-000000000051', 'germany', 'Bundesnetzagentur — Decisions', 'https://www.bundesnetzagentur.de/EN/RulingChambers/Decisions/start.html', 'BNetzA', 'en', true, 60, null),
  ('10000000-0000-4000-8000-000000000060', 'usa', 'FERC — News & Notices', 'https://www.ferc.gov/news-events/news', 'FERC', 'en', true, 80, null),
  ('10000000-0000-4000-8000-000000000061', 'usa', 'DOE — Energy Storage newsroom', 'https://www.energy.gov/oe/articles', 'U.S. DOE', 'en', true, 65, '仅收录正式规则/指令类'),
  ('10000000-0000-4000-8000-000000000062', 'canada', 'CER — Regulatory documents', 'https://www.cer-rec.gc.ca/en/about/news-room/news-releases/index.html', 'CER', 'en', true, 50, null),
  ('10000000-0000-4000-8000-000000000070', 'mexico', 'CRE — Acuerdos', 'https://www.gob.mx/cre/archivo/acciones_y_programas', 'CRE', 'es', true, 50, null),
  ('10000000-0000-4000-8000-000000000071', 'chile', 'CNE Chile — Normativa', 'https://www.cne.cl/normativas/', 'CNE', 'es', true, 55, null),
  ('10000000-0000-4000-8000-000000000072', 'brazil', 'ANEEL — Resoluções', 'https://www.gov.br/aneel/pt-br/assuntos/noticias', 'ANEEL', 'pt', true, 55, null)
on conflict (id) do nothing;

comment on table public.policy_source_feeds is
  'Whitelist of official policy list/RSS pages for weekly BESS policy ingest. No open-web search.';
comment on table public.policy_ingest_runs is
  'One row per weekly (or manual) policy ingest execution.';
comment on table public.policy_ingest_skips is
  'Candidates skipped during ingest (duplicate, commentary, out of scope, fetch errors, caps).';
