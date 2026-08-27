insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public avatar images are viewable" on storage.objects;
create policy "Public avatar images are viewable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "Authenticated users can upload their avatars" on storage.objects;

drop policy if exists "Authenticated users can update their avatars" on storage.objects;

drop policy if exists "Authenticated users can delete their avatars" on storage.objects;