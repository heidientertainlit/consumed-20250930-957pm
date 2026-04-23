-- ============================================================
-- CONSUMED — RLS Security Fix (safe / idempotent version)
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mahpgcogwpawvviapqza/sql/new
--
-- Every statement uses IF EXISTS / exception handling so that:
--   • Tables that don't exist in YOUR db are silently skipped
--   • Policies that already exist are silently skipped
-- ============================================================

-- Helper: lets us create policies without crashing on duplicates
-- or missing tables. Dropped at the end.
CREATE OR REPLACE FUNCTION _rls_policy(p text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p;
EXCEPTION
  WHEN duplicate_object  THEN NULL;  -- policy already exists
  WHEN undefined_table   THEN NULL;  -- table doesn't exist
  WHEN undefined_object  THEN NULL;
END;
$$;

-- ============================================================
-- STEP 1: Enable RLS (IF EXISTS = skip if table not present)
-- ============================================================
ALTER TABLE IF EXISTS beta_feedback              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS beta_survey_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bets                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS binge_battles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cached_recommendations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS consumption_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversation_topics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_challenge_responses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_challenges           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_runs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dna_moment_responses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dna_moments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dna_profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dna_survey_responses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dnf_reasons                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS edna_questions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS edna_responses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS followed_creators          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS friend_cast_comments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS friend_cast_responses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS friend_casts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS friend_trivia_challenges   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS list_items                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lists                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS media_items                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS media_ratings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS persona_post_drafts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS poll_options               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pool_answers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pool_members               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pool_prompts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pools                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS prediction_comment_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS prediction_pools           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS prediction_results         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rank_item_votes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rank_items                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ranks                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scheduled_persona_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seen_it_challenges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seen_it_completions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seen_it_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seen_it_responses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seen_it_sets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS social_comment_likes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS social_comment_votes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS social_post_comments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS social_posts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trivia_poll_drafts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_prediction_stats      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_rank_orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_recommendations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app_settings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS login_streaks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications              ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 2: Public content — readable by everyone
-- ============================================================
SELECT _rls_policy('CREATE POLICY "Public read" ON prediction_pools FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Public read" ON dna_moments FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Public read" ON daily_challenges FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Public read" ON media_items FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Public read" ON poll_options FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Public read" ON edna_questions FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Public read" ON conversation_topics FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Public read" ON pool_prompts FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Public read" ON prediction_results FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Public read" ON seen_it_challenges FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Public read" ON seen_it_items FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Public read" ON beta_survey_questions FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Public read" ON seen_it_sets FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Public read" ON friend_casts FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Auth read" ON persona_post_drafts FOR SELECT USING (auth.uid() IS NOT NULL)');
SELECT _rls_policy('CREATE POLICY "Auth read" ON scheduled_persona_posts FOR SELECT USING (auth.uid() IS NOT NULL)');
SELECT _rls_policy('CREATE POLICY "Auth read" ON trivia_poll_drafts FOR SELECT USING (auth.uid() IS NOT NULL)');
SELECT _rls_policy('CREATE POLICY "Auth insert" ON trivia_poll_drafts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)');
SELECT _rls_policy('CREATE POLICY "Auth update" ON trivia_poll_drafts FOR UPDATE USING (auth.uid() IS NOT NULL)');
SELECT _rls_policy('CREATE POLICY "Auth delete" ON trivia_poll_drafts FOR DELETE USING (auth.uid() IS NOT NULL)');
SELECT _rls_policy('CREATE POLICY "Auth read" ON app_settings FOR SELECT USING (auth.uid() IS NOT NULL)');

-- ============================================================
-- STEP 3: Social feed
-- ============================================================
SELECT _rls_policy('CREATE POLICY "Public read" ON social_posts FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON social_posts FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON social_posts FOR UPDATE USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON social_posts FOR DELETE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON social_post_comments FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON social_post_comments FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON social_post_comments FOR UPDATE USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON social_post_comments FOR DELETE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON social_comment_likes FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON social_comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON social_comment_likes FOR DELETE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON social_comment_votes FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON social_comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON social_comment_votes FOR UPDATE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON media_ratings FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON media_ratings FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON media_ratings FOR UPDATE USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON media_ratings FOR DELETE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON prediction_comment_votes FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON prediction_comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON prediction_comment_votes FOR UPDATE USING (auth.uid() = user_id)');

-- ============================================================
-- STEP 4: Lists, ranks, DNA
-- ============================================================
SELECT _rls_policy('CREATE POLICY "Public read" ON ranks FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON ranks FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON ranks FOR UPDATE USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON ranks FOR DELETE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON rank_items FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON rank_items FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON rank_items FOR UPDATE USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON rank_items FOR DELETE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON rank_item_votes FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON rank_item_votes FOR INSERT WITH CHECK (auth.uid() = voter_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON rank_item_votes FOR DELETE USING (auth.uid() = voter_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON user_rank_orders FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON user_rank_orders FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON user_rank_orders FOR UPDATE USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON user_rank_orders FOR DELETE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON lists FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON lists FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON lists FOR UPDATE USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON lists FOR DELETE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON list_items FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON list_items FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON list_items FOR UPDATE USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON list_items FOR DELETE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON dna_profiles FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON dna_profiles FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON dna_profiles FOR UPDATE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON dna_moment_responses FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON dna_moment_responses FOR INSERT WITH CHECK (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON dna_survey_responses FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON dna_survey_responses FOR INSERT WITH CHECK (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON edna_responses FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON edna_responses FOR INSERT WITH CHECK (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON followed_creators FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON followed_creators FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON followed_creators FOR DELETE USING (auth.uid() = user_id)');

-- ============================================================
-- STEP 5: Private user data
-- ============================================================
SELECT _rls_policy('CREATE POLICY "Own read" ON consumption_logs FOR SELECT USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON consumption_logs FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON consumption_logs FOR UPDATE USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON consumption_logs FOR DELETE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Own read" ON user_notification_settings FOR SELECT USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON user_notification_settings FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON user_notification_settings FOR UPDATE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON user_prediction_stats FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON user_prediction_stats FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON user_prediction_stats FOR UPDATE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Own read" ON user_recommendations FOR SELECT USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON user_recommendations FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON user_recommendations FOR UPDATE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Own read" ON cached_recommendations FOR SELECT USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON cached_recommendations FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON cached_recommendations FOR UPDATE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON daily_challenge_responses FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON daily_challenge_responses FOR INSERT WITH CHECK (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON daily_runs FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON daily_runs FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON daily_runs FOR UPDATE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Own read" ON dnf_reasons FOR SELECT USING (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON dnf_reasons FOR INSERT WITH CHECK (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON login_streaks FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON login_streaks FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON login_streaks FOR UPDATE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Own read" ON notifications FOR SELECT USING (auth.uid() = user_id)');

-- ============================================================
-- STEP 6: Pools, binge battles, friend features, seen-it
-- ============================================================
SELECT _rls_policy('CREATE POLICY "Public read" ON pools FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON pools FOR INSERT WITH CHECK (auth.uid() = host_id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON pools FOR UPDATE USING (auth.uid() = host_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON pool_members FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON pool_members FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON pool_members FOR DELETE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON pool_answers FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON pool_answers FOR INSERT WITH CHECK (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON binge_battles FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Participant insert" ON binge_battles FOR INSERT WITH CHECK (auth.uid() = challenger_id)');
SELECT _rls_policy('CREATE POLICY "Participant update" ON binge_battles FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = opponent_id)');

SELECT _rls_policy('CREATE POLICY "Auth read" ON friend_cast_responses FOR SELECT USING (auth.uid() IS NOT NULL)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON friend_cast_responses FOR INSERT WITH CHECK (auth.uid() = responder_id)');

SELECT _rls_policy('CREATE POLICY "Auth read" ON friend_cast_comments FOR SELECT USING (auth.uid() IS NOT NULL)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON friend_cast_comments FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own delete" ON friend_cast_comments FOR DELETE USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Auth read" ON friend_trivia_challenges FOR SELECT USING (auth.uid() IS NOT NULL)');
SELECT _rls_policy('CREATE POLICY "Participant insert" ON friend_trivia_challenges FOR INSERT WITH CHECK (auth.uid() = challenger_id)');
SELECT _rls_policy('CREATE POLICY "Participant update" ON friend_trivia_challenges FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = challenged_id)');

SELECT _rls_policy('CREATE POLICY "Own insert" ON seen_it_sets FOR INSERT WITH CHECK (auth.uid() = creator_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON seen_it_completions FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON seen_it_completions FOR INSERT WITH CHECK (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON seen_it_responses FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON seen_it_responses FOR INSERT WITH CHECK (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Own insert" ON beta_feedback FOR INSERT WITH CHECK (auth.uid() = user_id)');
SELECT _rls_policy('CREATE POLICY "Own read" ON beta_feedback FOR SELECT USING (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Auth read" ON conversations FOR SELECT USING (auth.uid() IS NOT NULL)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id)');

SELECT _rls_policy('CREATE POLICY "Public read" ON bets FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON bets FOR INSERT WITH CHECK (auth.uid() = user_id)');

-- ============================================================
-- STEP 7: Users table
-- ============================================================
SELECT _rls_policy('CREATE POLICY "Public read" ON users FOR SELECT USING (true)');
SELECT _rls_policy('CREATE POLICY "Own insert" ON users FOR INSERT WITH CHECK (auth.uid() = id)');
SELECT _rls_policy('CREATE POLICY "Own update" ON users FOR UPDATE USING (auth.uid() = id)');

-- ============================================================
-- Cleanup helper function
-- ============================================================
DROP FUNCTION IF EXISTS _rls_policy(text);
