-- ============================================================
-- CONSUMED - Supabase Security Fixes
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- PART 1: Fix Security Definer Views
-- These views run as the view creator, bypassing RLS.
-- Setting security_invoker=on makes them run as the querying user.
-- ============================================================

ALTER VIEW public.social_posts_with_usernames SET (security_invoker = on);
ALTER VIEW public.trivia_user_points SET (security_invoker = on);
ALTER VIEW public.public_feed SET (security_invoker = on);
ALTER VIEW public.user_last_activity SET (security_invoker = on);


-- ============================================================
-- PART 2: Enable RLS + Policies on all flagged tables
-- Strategy:
--   Reference/lookup tables  → public read
--   Social content           → public read, authenticated write own
--   User-owned data          → read/write own only
--   Admin-only tables        → no policies (service role bypasses RLS)
-- ============================================================


-- REFERENCE / LOOKUP TABLES (anyone can read, no direct user writes)
ALTER TABLE public.media_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.media_types;
CREATE POLICY "Public read" ON public.media_types FOR SELECT USING (true);

ALTER TABLE public.media_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.media_tags;
CREATE POLICY "Public read" ON public.media_tags FOR SELECT USING (true);

ALTER TABLE public.media_tag_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.media_tag_links;
CREATE POLICY "Public read" ON public.media_tag_links FOR SELECT USING (true);

ALTER TABLE public.media_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.media_statuses;
CREATE POLICY "Public read" ON public.media_statuses FOR SELECT USING (true);

ALTER TABLE public.trivia_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.trivia_questions;
CREATE POLICY "Public read" ON public.trivia_questions FOR SELECT USING (true);

ALTER TABLE public.beta_survey_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.beta_survey_questions;
CREATE POLICY "Public read" ON public.beta_survey_questions FOR SELECT USING (true);

ALTER TABLE public.dna_moments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.dna_moments;
CREATE POLICY "Public read" ON public.dna_moments FOR SELECT USING (true);

ALTER TABLE public.seen_it_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.seen_it_sets;
CREATE POLICY "Public read" ON public.seen_it_sets FOR SELECT USING (true);

ALTER TABLE public.seen_it_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.seen_it_items;
CREATE POLICY "Public read" ON public.seen_it_items FOR SELECT USING (true);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.polls;
DROP POLICY IF EXISTS "Authenticated insert" ON public.polls;
CREATE POLICY "Public read" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Authenticated insert" ON public.polls FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- SOCIAL CONTENT (public read, users manage their own)
ALTER TABLE public.social_post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.social_post_comments;
DROP POLICY IF EXISTS "Users manage own" ON public.social_post_comments;
CREATE POLICY "Public read" ON public.social_post_comments FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.social_post_comments FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.social_post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.social_post_likes;
DROP POLICY IF EXISTS "Users manage own" ON public.social_post_likes;
CREATE POLICY "Public read" ON public.social_post_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.social_post_likes FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.reviews;
DROP POLICY IF EXISTS "Users manage own" ON public.reviews;
CREATE POLICY "Public read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.reviews FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.predictions;
DROP POLICY IF EXISTS "Users manage own" ON public.predictions;
CREATE POLICY "Public read" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.predictions FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.prediction_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.prediction_comments;
DROP POLICY IF EXISTS "Users manage own" ON public.prediction_comments;
CREATE POLICY "Public read" ON public.prediction_comments FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.prediction_comments FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.prediction_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.prediction_likes;
DROP POLICY IF EXISTS "Users manage own" ON public.prediction_likes;
CREATE POLICY "Public read" ON public.prediction_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.prediction_likes FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.prediction_comment_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.prediction_comment_likes;
DROP POLICY IF EXISTS "Users manage own" ON public.prediction_comment_likes;
CREATE POLICY "Public read" ON public.prediction_comment_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.prediction_comment_likes FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.prediction_comment_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.prediction_comment_votes;
DROP POLICY IF EXISTS "Users manage own" ON public.prediction_comment_votes;
CREATE POLICY "Public read" ON public.prediction_comment_votes FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.prediction_comment_votes FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.strands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.strands;
DROP POLICY IF EXISTS "Authenticated write" ON public.strands;
CREATE POLICY "Public read" ON public.strands FOR SELECT USING (true);
CREATE POLICY "Authenticated write" ON public.strands FOR ALL WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.strand_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.strand_media;
DROP POLICY IF EXISTS "Authenticated write" ON public.strand_media;
CREATE POLICY "Public read" ON public.strand_media FOR SELECT USING (true);
CREATE POLICY "Authenticated write" ON public.strand_media FOR ALL WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.strand_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.strand_likes;
DROP POLICY IF EXISTS "Users manage own" ON public.strand_likes;
CREATE POLICY "Public read" ON public.strand_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.strand_likes FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.strand_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.strand_comments;
DROP POLICY IF EXISTS "Users manage own" ON public.strand_comments;
CREATE POLICY "Public read" ON public.strand_comments FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.strand_comments FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.friends_trivia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.friends_trivia;
DROP POLICY IF EXISTS "Authenticated write" ON public.friends_trivia;
CREATE POLICY "Public read" ON public.friends_trivia FOR SELECT USING (true);
CREATE POLICY "Authenticated write" ON public.friends_trivia FOR ALL WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.ratings;
DROP POLICY IF EXISTS "Users manage own" ON public.ratings;
CREATE POLICY "Public read" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.ratings FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.profiles;
DROP POLICY IF EXISTS "Users manage own" ON public.profiles;
CREATE POLICY "Public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.profiles FOR ALL USING (auth.uid() = id);


-- USER-OWNED DATA (users access their own records only)
ALTER TABLE public.login_streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own" ON public.login_streaks;
CREATE POLICY "Users manage own" ON public.login_streaks FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own" ON public.user_activity;
CREATE POLICY "Users manage own" ON public.user_activity FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.user_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.user_lists;
DROP POLICY IF EXISTS "Users manage own" ON public.user_lists;
CREATE POLICY "Public read" ON public.user_lists FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.user_lists FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.trivia_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.trivia_results;
DROP POLICY IF EXISTS "Users manage own" ON public.trivia_results;
CREATE POLICY "Public read" ON public.trivia_results FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.trivia_results FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.trivia_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own" ON public.trivia_sessions;
CREATE POLICY "Users manage own" ON public.trivia_sessions FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.trivia_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own" ON public.trivia_answers;
CREATE POLICY "Users manage own" ON public.trivia_answers FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.media_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.media_ratings;
DROP POLICY IF EXISTS "Users manage own" ON public.media_ratings;
CREATE POLICY "Public read" ON public.media_ratings FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.media_ratings FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.user_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.user_predictions;
DROP POLICY IF EXISTS "Users manage own" ON public.user_predictions;
CREATE POLICY "Public read" ON public.user_predictions FOR SELECT USING (true);
CREATE POLICY "Users manage own" ON public.user_predictions FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.user_prediction_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own" ON public.user_prediction_stats;
CREATE POLICY "Users manage own" ON public.user_prediction_stats FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.points_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own" ON public.points_log;
DROP POLICY IF EXISTS "Authenticated insert" ON public.points_log;
CREATE POLICY "Users read own" ON public.points_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated insert" ON public.points_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated insert" ON public.activity_logs;
CREATE POLICY "Users read own" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated insert" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.user_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own" ON public.user_recommendations;
CREATE POLICY "Users manage own" ON public.user_recommendations FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.cached_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read" ON public.cached_recommendations;
DROP POLICY IF EXISTS "Authenticated manage" ON public.cached_recommendations;
CREATE POLICY "Public read" ON public.cached_recommendations FOR SELECT USING (true);
CREATE POLICY "Authenticated manage" ON public.cached_recommendations FOR ALL WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.dna_moment_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own" ON public.dna_moment_responses;
CREATE POLICY "Users manage own" ON public.dna_moment_responses FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.seen_it_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own" ON public.seen_it_responses;
CREATE POLICY "Users manage own" ON public.seen_it_responses FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.seen_it_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own" ON public.seen_it_completions;
CREATE POLICY "Users manage own" ON public.seen_it_completions FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own" ON public.beta_feedback;
DROP POLICY IF EXISTS "Authenticated insert" ON public.beta_feedback;
CREATE POLICY "Users read own" ON public.beta_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated insert" ON public.beta_feedback FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ADMIN-ONLY TABLES
-- These are only accessed via edge functions using the service role key.
-- Service role bypasses RLS entirely, so enabling RLS with no policies
-- blocks all direct API access while keeping edge functions working.
ALTER TABLE public.scheduled_persona_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_post_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_signal_reports ENABLE ROW LEVEL SECURITY;
