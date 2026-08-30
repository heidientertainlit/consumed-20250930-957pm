-- Keep completed receipts mathematically self-consistent, while allowing a
-- processing/interrupted batch to retain partial evidence for recovery.
alter table public.media_import_batches
  add constraint media_import_batches_row_reconciliation_check
  check (
    status in ('processing', 'interrupted', 'failed')
    or is_legacy
    or (
      source_rows = parsed_rows + rejected_count
      and parsed_rows = inserted_count + skipped_existing_count + skipped_duplicate_count + failed_count
      and unique_rows = parsed_rows - skipped_duplicate_count
      and completed_at is not null
    )
  );

do $$
declare
  v_batches integer;
  v_batch_rows integer;
  v_points integer;
  v_row_receipts integer;
  v_provenance_rows integer;
  v_policy_count integer;
begin
  select count(*), coalesce(sum(inserted_count), 0), coalesce(sum(imported_points), 0)
  into v_batches, v_batch_rows, v_points
  from public.media_import_batches
  where legacy_cohort in (
    'KJWoodsEMH-goodreads-20251021',
    'HeidiIsConsumed-goodreads-20251022',
    'KJWoodsEMH-netflix-20251029'
  );

  if v_batches <> 3 or v_batch_rows <> 1359 or v_points <> 20120 then
    raise exception 'Historical import batch verification failed: batches %, rows %, points %',
      v_batches, v_batch_rows, v_points;
  end if;

  select count(*)
  into v_row_receipts
  from public.media_import_rows r
  join public.media_import_batches b on b.id = r.batch_id
  where b.legacy_cohort in (
    'KJWoodsEMH-goodreads-20251021',
    'HeidiIsConsumed-goodreads-20251022',
    'KJWoodsEMH-netflix-20251029'
  );

  select count(*)
  into v_provenance_rows
  from public.list_items li
  join public.media_import_batches b on b.id = li.import_batch_id
  where b.legacy_cohort in (
    'KJWoodsEMH-goodreads-20251021',
    'HeidiIsConsumed-goodreads-20251022',
    'KJWoodsEMH-netflix-20251029'
  )
    and li.import_source_row_index is not null;

  if v_row_receipts <> 1359 or v_provenance_rows <> 1359 then
    raise exception 'Historical import provenance verification failed: receipts %, linked rows %',
      v_row_receipts, v_provenance_rows;
  end if;

  select count(*)
  into v_policy_count
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'media_import_batches_owner_or_admin_select',
      'media_import_rows_owner_or_admin_select'
    );

  if v_policy_count <> 2 then
    raise exception 'Media import ledger RLS verification failed: expected 2 policies, found %',
      v_policy_count;
  end if;
end $$;