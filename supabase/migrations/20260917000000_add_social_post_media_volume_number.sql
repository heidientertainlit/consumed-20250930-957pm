-- Preserve the selected book-series volume on feed posts.
-- Nullable keeps existing posts and non-book media unchanged.
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS media_volume_number integer;