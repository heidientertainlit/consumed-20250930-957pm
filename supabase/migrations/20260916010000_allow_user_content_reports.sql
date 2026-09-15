-- Keep the verified five legacy content types and allow reports against users.
-- The original live CHECK values are from the 2026-09-15 UGC schema snapshot.
alter table public.content_reports
  drop constraint content_reports_content_type_check;

alter table public.content_reports
  add constraint content_reports_content_type_check
  check (content_type = any (array[
    'post'::text,
    'comment'::text,
    'hot_take'::text,
    'list'::text,
    'review'::text,
    'user'::text
  ]));