-- Create prediction_comments table
CREATE TABLE IF NOT EXISTS public.prediction_comments (
  id BIGSERIAL PRIMARY KEY,
  pool_id UUID NOT NULL REFERENCES public.prediction_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id BIGINT REFERENCES public.prediction_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create prediction_likes table
CREATE TABLE IF NOT EXISTS public.prediction_likes (
  id BIGSERIAL PRIMARY KEY,
  pool_id UUID NOT NULL REFERENCES public.prediction_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(pool_id, user_id)
);

-- Create prediction_comment_likes table
CREATE TABLE IF NOT EXISTS public.prediction_comment_likes (
  id BIGSERIAL PRIMARY KEY,
  comment_id BIGINT NOT NULL REFERENCES public.prediction_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_prediction_comments_pool_id ON public.prediction_comments(pool_id);
CREATE INDEX IF NOT EXISTS idx_prediction_comments_user_id ON public.prediction_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_comments_parent_id ON public.prediction_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_prediction_likes_pool_id ON public.prediction_likes(pool_id);
CREATE INDEX IF NOT EXISTS idx_prediction_likes_user_id ON public.prediction_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_comment_likes_comment_id ON public.prediction_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_prediction_comment_likes_user_id ON public.prediction_comment_likes(user_id);

-- Enable RLS
ALTER TABLE public.prediction_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_comment_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for prediction_comments (allow users to read all, write their own)
CREATE POLICY "Anyone can read prediction comments" 
  ON public.prediction_comments 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own prediction comments" 
  ON public.prediction_comments 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prediction comments" 
  ON public.prediction_comments 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prediction comments" 
  ON public.prediction_comments 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for prediction_likes (allow users to manage their own)
CREATE POLICY "Anyone can read prediction likes" 
  ON public.prediction_likes 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own prediction likes" 
  ON public.prediction_likes 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prediction likes" 
  ON public.prediction_likes 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for prediction_comment_likes
CREATE POLICY "Anyone can read prediction comment likes" 
  ON public.prediction_comment_likes 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own prediction comment likes" 
  ON public.prediction_comment_likes 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prediction comment likes" 
  ON public.prediction_comment_likes 
  FOR DELETE 
  USING (auth.uid() = user_id);
