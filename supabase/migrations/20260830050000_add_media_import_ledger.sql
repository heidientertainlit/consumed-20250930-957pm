-- Durable, server-written receipt for every media import.  The uploaded bytes
-- are deliberately never persisted; only their digest and harmless metadata are.
create table if not exists public.media_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  original_filename text not null,
  content_type text,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  source text not null,
  points_formula jsonb not null default '{"book":15,"movie":8,"tv":10,"music":1,"podcast":3,"game":5,"youtube":2}'::jsonb,
  status text not null default 'processing' check (status in ('processing','completed','completed_with_errors','failed','interrupted')),
  started_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  source_rows integer not null default 0 check (source_rows >= 0),
  parsed_rows integer not null default 0 check (parsed_rows >= 0),
  unique_rows integer not null default 0 check (unique_rows >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  skipped_existing_count integer not null default 0 check (skipped_existing_count >= 0),
  skipped_duplicate_count integer not null default 0 check (skipped_duplicate_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  rejected_count integer not null default 0 check (rejected_count >= 0),
  ratings_imported_count integer not null default 0 check (ratings_imported_count >= 0),
  ratings_preserved_count integer not null default 0 check (ratings_preserved_count >= 0),
  ratings_failed_count integer not null default 0 check (ratings_failed_count >= 0),
  media_type_counts jsonb not null default '{}'::jsonb,
  points_by_media_type jsonb not null default '{}'::jsonb,
  imported_points integer not null default 0 check (imported_points >= 0),
  parser_version text not null default '1',
  points_formula_version text not null default 'current-v1',
  error_summary jsonb not null default '[]'::jsonb,
  is_legacy boolean not null default false,
  legacy_evidence jsonb,
  legacy_cohort text unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.media_import_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.media_import_batches(id) on delete cascade,
  source_row_index integer not null check (source_row_index >= 0),
  title text,
  media_type text,
  outcome text not null check (outcome in ('pending','inserted','skipped_existing','skipped_duplicate','failed')),
  error_message text,
  list_item_id uuid references public.list_items(id) on delete set null,
  media_rating_id bigint references public.media_ratings(id) on delete set null,
  rating_outcome text not null default 'none'
    check (rating_outcome in ('none','pending','inserted','preserved','duplicate','unresolved')),
  created_at timestamptz not null default now(),
  unique (batch_id, source_row_index)
);

alter table public.list_items add column if not exists import_batch_id uuid references public.media_import_batches(id) on delete set null;
alter table public.list_items add column if not exists import_source_row_index integer;
alter table public.media_ratings add column if not exists import_batch_id uuid references public.media_import_batches(id) on delete set null;
alter table public.media_ratings add column if not exists import_source_row_index integer;
alter table public.list_items drop constraint if exists list_items_import_source_row_index_check;
alter table public.list_items add constraint list_items_import_source_row_index_check check (import_source_row_index is null or import_source_row_index >= 0);
alter table public.media_ratings drop constraint if exists media_ratings_import_source_row_index_check;
alter table public.media_ratings add constraint media_ratings_import_source_row_index_check check (import_source_row_index is null or import_source_row_index >= 0);

create index if not exists media_import_batches_user_created_idx on public.media_import_batches(user_id, created_at desc);
create index if not exists media_import_rows_batch_outcome_idx on public.media_import_rows(batch_id, outcome);
create index if not exists list_items_import_batch_idx on public.list_items(import_batch_id);
create index if not exists media_ratings_import_batch_idx on public.media_ratings(import_batch_id);

alter table public.media_import_batches enable row level security;
alter table public.media_import_rows enable row level security;
revoke all on public.media_import_batches, public.media_import_rows from public, anon, authenticated;
grant select on public.media_import_batches, public.media_import_rows to authenticated;
create policy media_import_batches_owner_or_admin_select on public.media_import_batches for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));
create policy media_import_rows_owner_or_admin_select on public.media_import_rows for select to authenticated
  using (exists (select 1 from public.media_import_batches b where b.id = batch_id and (b.user_id = auth.uid() or exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin))));

-- These backfills are intentionally narrow.  A cohort is touched only when its
-- complete historical signature remains exact, and the cohort key makes reruns
-- harmless.  No points or media fields are changed.
do $$
declare v_user uuid; v_batch uuid; v_count integer;
begin
  foreach v_user in array array[
    (select id from public.users where user_name = 'KJWoodsEMH' limit 1),
    (select id from public.users where user_name = 'HeidiIsConsumed' limit 1)
  ] loop
    continue when v_user is null;
    if v_user = (select id from public.users where user_name = 'KJWoodsEMH' limit 1) then
      select count(*) into v_count from public.list_items where user_id=v_user and media_type='book' and created_at between '2025-10-21 23:53:21.008894+00' and '2025-10-21 23:53:21.53861+00' and import_batch_id is null;
      if v_count=624 then
        insert into public.media_import_batches(
          user_id,original_filename,content_type,file_size_bytes,source,status,
          source_rows,parsed_rows,unique_rows,inserted_count,media_type_counts,
          points_by_media_type,imported_points,is_legacy,legacy_evidence,completed_at,legacy_cohort
        )
        values(
          v_user,'Historical Goodreads import (original file not retained)','text/csv',0,'goodreads','completed',
          624,624,624,624,'{"book":624}'::jsonb,'{"book":9360}'::jsonb,9360,true,
          jsonb_build_object('matched_by','user + exact timestamp range + media type + row count','source_file_retained',false),
          now(),'KJWoodsEMH-goodreads-20251021'
        )
        on conflict (legacy_cohort) do update set legacy_cohort=excluded.legacy_cohort returning id into v_batch;
        update public.list_items set import_batch_id=v_batch, import_source_row_index=row_number-1
        from (select id,row_number() over(order by created_at,id) row_number from public.list_items where user_id=v_user and media_type='book' and created_at between '2025-10-21 23:53:21.008894+00' and '2025-10-21 23:53:21.53861+00') x
        where list_items.id=x.id and list_items.import_batch_id is null;
      end if;
    else
      select count(*) into v_count from public.list_items where user_id=v_user and media_type='book' and created_at between '2025-10-22 03:44:20.626852+00' and '2025-10-22 03:44:21.104051+00' and import_batch_id is null;
      if v_count=682 then
        insert into public.media_import_batches(
          user_id,original_filename,content_type,file_size_bytes,source,status,
          source_rows,parsed_rows,unique_rows,inserted_count,media_type_counts,
          points_by_media_type,imported_points,is_legacy,legacy_evidence,completed_at,legacy_cohort
        )
        values(
          v_user,'Historical Goodreads import','text/csv',0,'goodreads','completed',
          682,682,681,682,'{"book":682}'::jsonb,'{"book":10230}'::jsonb,10230,true,
          jsonb_build_object('matched_by','retained source file + user + exact timestamp range + media type + row count','source_file_retained',true),
          now(),'HeidiIsConsumed-goodreads-20251022'
        )
        on conflict (legacy_cohort) do update set legacy_cohort=excluded.legacy_cohort returning id into v_batch;
        update public.list_items set import_batch_id=v_batch, import_source_row_index=row_number-1 from (select id,row_number() over(order by created_at,id) row_number from public.list_items where user_id=v_user and media_type='book' and created_at between '2025-10-22 03:44:20.626852+00' and '2025-10-22 03:44:21.104051+00') x where list_items.id=x.id and list_items.import_batch_id is null;
      end if;
    end if;
  end loop;
  select id into v_user from public.users where user_name='KJWoodsEMH' limit 1;
  if v_user is not null then
    select count(*) into v_count from public.list_items where user_id=v_user and media_type='tv' and created_at between '2025-10-29 04:41:00.253817+00' and '2025-10-29 04:41:49.318699+00' and import_batch_id is null;
    if v_count=53 then
      insert into public.media_import_batches(
        user_id,original_filename,content_type,file_size_bytes,source,status,
        source_rows,parsed_rows,unique_rows,inserted_count,media_type_counts,
        points_by_media_type,imported_points,is_legacy,legacy_evidence,completed_at,legacy_cohort
      )
      values(
        v_user,'Historical Netflix import (original file not retained)','text/csv',0,'netflix','completed',
        53,53,53,53,'{"tv":53}'::jsonb,'{"tv":530}'::jsonb,530,true,
        jsonb_build_object('matched_by','user + exact timestamp range + legacy all-TV parser signature + row count','source_file_retained',false),
        now(),'KJWoodsEMH-netflix-20251029'
      )
      on conflict (legacy_cohort) do update set legacy_cohort=excluded.legacy_cohort returning id into v_batch;
      update public.list_items set import_batch_id=v_batch, import_source_row_index=row_number-1 from (select id,row_number() over(order by created_at,id) row_number from public.list_items where user_id=v_user and media_type='tv' and created_at between '2025-10-29 04:41:00.253817+00' and '2025-10-29 04:41:49.318699+00') x where list_items.id=x.id and list_items.import_batch_id is null;
    end if;
  end if;
  -- Populate the row ledger from the immutable provenance just assigned. This
  -- is also idempotent if a deployment is retried after a partial transaction.
  insert into public.media_import_rows(batch_id,source_row_index,title,media_type,outcome,list_item_id)
  select li.import_batch_id, li.import_source_row_index, li.title, li.media_type, 'inserted', li.id
  from public.list_items li
  join public.media_import_batches b on b.id=li.import_batch_id
  where b.legacy_cohort in ('KJWoodsEMH-goodreads-20251021','HeidiIsConsumed-goodreads-20251022','KJWoodsEMH-netflix-20251029')
    and li.import_source_row_index is not null
  on conflict (batch_id,source_row_index) do nothing;
end $$;