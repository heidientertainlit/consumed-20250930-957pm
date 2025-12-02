-- RUN THIS SQL IN YOUR SUPABASE DASHBOARD (SQL Editor)
-- Go to: https://supabase.com/dashboard/project/mahpgcogwpawvviapqza/sql
-- Paste this entire script and click "Run"

-- 1. Create prediction_comments table
CREATE TABLE IF NOT EXISTS public.prediction_comments (
  id BIGSERIAL PRIMARY KEY,
  pool_id UUID NOT NULL REFERENCES public.prediction_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  parent_comment_id BIGINT REFERENCES public.prediction_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create prediction_likes table
CREATE TABLE IF NOT EXISTS public.prediction_likes (
  id BIGSERIAL PRIMARY KEY,
  pool_id UUID NOT NULL REFERENCES public.prediction_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(pool_id, user_id)
);

-- 3. Create prediction_comment_likes table
CREATE TABLE IF NOT EXISTS public.prediction_comment_likes (
  id BIGSERIAL PRIMARY KEY,
  comment_id BIGINT NOT NULL REFERENCES public.prediction_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_prediction_comments_pool_id ON public.prediction_comments(pool_id);
CREATE INDEX IF NOT EXISTS idx_prediction_comments_user_id ON public.prediction_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_comments_parent_id ON public.prediction_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_prediction_likes_pool_id ON public.prediction_likes(pool_id);
CREATE INDEX IF NOT EXISTS idx_prediction_likes_user_id ON public.prediction_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_comment_likes_comment_id ON public.prediction_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_prediction_comment_likes_user_id ON public.prediction_comment_likes(user_id);

-- Done! After running this, comments and likes on predictions should work.
