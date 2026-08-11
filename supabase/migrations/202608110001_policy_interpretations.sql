-- Internal "重要政策专题解读" briefing documents.
-- Admins upload Word/PDF/PPT/Excel; public users see published rows only.
-- File bytes live in a private bucket; download/preview goes through app APIs.

create table public.policy_interpretations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  -- Optional country/province scope. Null = global / multi-region briefing.
  region_id uuid references public.regions(id) on update cascade on delete restrict,
  -- Business desk key aligned with POLICY_REGION_BLOCS (e.g. bloc:china).
  -- Empty string means global.
  region_bloc text not null default '',
  topic_tags text[] not null default '{}'::text[],
  department text,
  original_filename text not null,
  mime_type text not null,
  file_ext text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  storage_path text not null,
  is_demo boolean not null default false,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint policy_interpretations_title_not_blank check (btrim(title) <> ''),
  constraint policy_interpretations_filename_not_blank
    check (btrim(original_filename) <> ''),
  constraint policy_interpretations_storage_path_not_blank
    check (btrim(storage_path) <> ''),
  constraint policy_interpretations_file_ext_not_blank
    check (btrim(file_ext) <> ''),
  constraint policy_interpretations_published_complete check (
    is_published = false
    or (
      published_at is not null
      and btrim(title) <> ''
      and btrim(storage_path) <> ''
    )
  ),
  constraint policy_interpretations_region_bloc_format check (
    region_bloc = ''
    or region_bloc in (
      'bloc:china',
      'bloc:apac',
      'bloc:europe',
      'bloc:north-america',
      'bloc:latam',
      'bloc:mea'
    )
  )
);

comment on table public.policy_interpretations is
  'Internal policy interpretation briefs (Word/PDF/PPT/Excel). Public SELECT only when is_published.';

create index policy_interpretations_public_idx
  on public.policy_interpretations (published_at desc nulls last)
  where is_published = true;

create index policy_interpretations_region_bloc_idx
  on public.policy_interpretations (region_bloc);

create index policy_interpretations_topic_tags_gin
  on public.policy_interpretations using gin (topic_tags);

create trigger policy_interpretations_set_updated_at
before update on public.policy_interpretations
for each row execute function public.set_updated_at();

alter table public.policy_interpretations enable row level security;

create policy policy_interpretations_public_read
on public.policy_interpretations
for select
to anon, authenticated
using (is_published = true);

create policy policy_interpretations_admin_all
on public.policy_interpretations
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant select on public.policy_interpretations to anon, authenticated;
grant insert, update, delete on public.policy_interpretations to authenticated;
grant select, insert, update, delete on public.policy_interpretations to service_role;

-- Private briefing artifacts. Never expose a permanent public URL.
insert into storage.buckets (id, name)
values (
  'grid-ledger-policy-briefs',
  'grid-ledger-policy-briefs'
)
on conflict (id) do update
set name = excluded.name;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'buckets'
      and column_name = 'public'
  ) then
    execute $sql$
      update storage.buckets
      set public = false
      where id = 'grid-ledger-policy-briefs'
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'buckets'
      and column_name = 'file_size_limit'
  ) then
    execute $sql$
      update storage.buckets
      set file_size_limit = 26214400
      where id = 'grid-ledger-policy-briefs'
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'storage'
      and table_name = 'buckets'
      and column_name = 'allowed_mime_types'
  ) then
    execute $sql$
      update storage.buckets
      set allowed_mime_types = array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/csv'
      ]::text[]
      where id = 'grid-ledger-policy-briefs'
    $sql$;
  end if;
end;
$$;

drop policy if exists policy_briefs_storage_admin_read on storage.objects;
drop policy if exists policy_briefs_storage_admin_insert on storage.objects;
drop policy if exists policy_briefs_storage_admin_update on storage.objects;
drop policy if exists policy_briefs_storage_admin_delete on storage.objects;

create policy policy_briefs_storage_admin_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'grid-ledger-policy-briefs'
  and (select public.is_admin())
);

create policy policy_briefs_storage_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'grid-ledger-policy-briefs'
  and (select public.is_admin())
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy policy_briefs_storage_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'grid-ledger-policy-briefs'
  and (select public.is_admin())
)
with check (
  bucket_id = 'grid-ledger-policy-briefs'
  and (select public.is_admin())
);

create policy policy_briefs_storage_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'grid-ledger-policy-briefs'
  and (select public.is_admin())
);

comment on column public.policy_interpretations.storage_path is
  'Private grid-ledger-policy-briefs object path. Expected: {auth.uid()}/{id}/{uuid}{ext}.';
