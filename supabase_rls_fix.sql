-- ============================================================
-- CONSUMED — RLS Security Fix
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mahpgcogwpawvviapqza/sql
-- ============================================================

-- STEP 1: Enable RLS on all unprotected tables
ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE binge_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumption_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenge_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dna_moment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE dna_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dna_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dna_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnf_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE edna_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE edna_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE followed_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_cast_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_cast_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_casts ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_trivia_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_post_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_item_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_persona_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE seen_it_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE seen_it_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seen_it_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE seen_it_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE seen_it_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_prediction_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rank_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Also enable on any other tables that may exist
ALTER TABLE IF EXISTS trivia_poll_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS login_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 2: Public content — readable by everyone
-- ============================================================
CREATE POLICY "Public read" ON prediction_pools FOR SELECT USING (true);
CREATE POLICY "Public read" ON dna_moments FOR SELECT USING (true);
CREATE POLICY "Public read" ON daily_challenges FOR SELECT USING (true);
CREATE POLICY "Public read" ON media_items FOR SELECT USING (true);
CREATE POLICY "Public read" ON poll_options FOR SELECT USING (true);
CREATE POLICY "Public read" ON edna_questions FOR SELECT USING (true);
CREATE POLICY "Public read" ON conversation_topics FOR SELECT USING (true);
CREATE POLICY "Public read" ON pool_prompts FOR SELECT USING (true);
CREATE POLICY "Public read" ON prediction_results FOR SELECT USING (true);
CREATE POLICY "Public read" ON seen_it_challenges FOR SELECT USING (true);
CREATE POLICY "Public read" ON seen_it_items FOR SELECT USING (true);
CREATE POLICY "Public read" ON beta_survey_questions FOR SELECT USING (true);
CREATE POLICY "Public read" ON seen_it_sets FOR SELECT USING (true);
CREATE POLICY "Public read" ON friend_casts FOR SELECT USING (true);

-- Admin-only tables: authenticated read only
CREATE POLICY "Auth read" ON persona_post_drafts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth read" ON scheduled_persona_posts FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- STEP 3: Social feed — public read, users write their own
-- ============================================================
CREATE POLICY "Public read" ON social_posts FOR SELECT USING (true);
CREATE POLICY "Own insert" ON social_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON social_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own delete" ON social_posts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public read" ON social_post_comments FOR SELECT USING (true);
CREATE POLICY "Own insert" ON social_post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON social_post_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own delete" ON social_post_comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public read" ON social_comment_likes FOR SELECT USING (true);
CREATE POLICY "Own insert" ON social_comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own delete" ON social_comment_likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public read" ON social_comment_votes FOR SELECT USING (true);
CREATE POLICY "Own insert" ON social_comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON social_comment_votes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Public read" ON media_ratings FOR SELECT USING (true);
CREATE POLICY "Own insert" ON media_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON media_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own delete" ON media_ratings FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public read" ON prediction_comment_votes FOR SELECT USING (true);
CREATE POLICY "Own insert" ON prediction_comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON prediction_comment_votes FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- STEP 4: Lists, ranks, DNA
-- ============================================================
CREATE POLICY "Public read" ON ranks FOR SELECT USING (true);
CREATE POLICY "Own insert" ON ranks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON ranks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own delete" ON ranks FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public read" ON rank_items FOR SELECT USING (true);
CREATE POLICY "Own insert" ON rank_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON rank_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own delete" ON rank_items FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public read" ON rank_item_votes FOR SELECT USING (true);
CREATE POLICY "Own insert" ON rank_item_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "Own delete" ON rank_item_votes FOR DELETE USING (auth.uid() = voter_id);

CREATE POLICY "Public read" ON user_rank_orders FOR SELECT USING (true);
CREATE POLICY "Own insert" ON user_rank_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON user_rank_orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own delete" ON user_rank_orders FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public read" ON dna_profiles FOR SELECT USING (true);
CREATE POLICY "Own insert" ON dna_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON dna_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Public read" ON dna_moment_responses FOR SELECT USING (true);
CREATE POLICY "Own insert" ON dna_moment_responses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read" ON dna_survey_responses FOR SELECT USING (true);
CREATE POLICY "Own insert" ON dna_survey_responses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read" ON edna_responses FOR SELECT USING (true);
CREATE POLICY "Own insert" ON edna_responses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read" ON followed_creators FOR SELECT USING (true);
CREATE POLICY "Own insert" ON followed_creators FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own delete" ON followed_creators FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- STEP 5: Private user data
-- ============================================================
CREATE POLICY "Own read" ON consumption_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own insert" ON consumption_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON consumption_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own delete" ON consumption_logs FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Own read" ON user_notification_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own insert" ON user_notification_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON user_notification_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Public read" ON user_prediction_stats FOR SELECT USING (true);
CREATE POLICY "Own insert" ON user_prediction_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON user_prediction_stats FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Own read" ON user_recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own insert" ON user_recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON user_recommendations FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Own read" ON cached_recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own insert" ON cached_recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON cached_recommendations FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Public read" ON daily_challenge_responses FOR SELECT USING (true);
CREATE POLICY "Own insert" ON daily_challenge_responses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read" ON daily_runs FOR SELECT USING (true);
CREATE POLICY "Own insert" ON daily_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON daily_runs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Own read" ON dnf_reasons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own insert" ON dnf_reasons FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- STEP 6: Pools, binge battles, friend features, seen-it
-- ============================================================
CREATE POLICY "Public read" ON pools FOR SELECT USING (true);
CREATE POLICY "Own insert" ON pools FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Own update" ON pools FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Public read" ON pool_members FOR SELECT USING (true);
CREATE POLICY "Own insert" ON pool_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own delete" ON pool_members FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public read" ON pool_answers FOR SELECT USING (true);
CREATE POLICY "Own insert" ON pool_answers FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read" ON binge_battles FOR SELECT USING (true);
CREATE POLICY "Participant insert" ON binge_battles FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "Participant update" ON binge_battles FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE POLICY "Auth read" ON friend_casts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Own insert" ON friend_casts FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Own update" ON friend_casts FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Own delete" ON friend_casts FOR DELETE USING (auth.uid() = creator_id);

CREATE POLICY "Auth read" ON friend_cast_responses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Own insert" ON friend_cast_responses FOR INSERT WITH CHECK (auth.uid() = responder_id);

CREATE POLICY "Auth read" ON friend_cast_comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Own insert" ON friend_cast_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own delete" ON friend_cast_comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Auth read" ON friend_trivia_challenges FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Participant insert" ON friend_trivia_challenges FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "Participant update" ON friend_trivia_challenges FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

CREATE POLICY "Own insert" ON seen_it_sets FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Public read" ON seen_it_completions FOR SELECT USING (true);
CREATE POLICY "Own insert" ON seen_it_completions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read" ON seen_it_responses FOR SELECT USING (true);
CREATE POLICY "Own insert" ON seen_it_responses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Own insert" ON beta_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own read" ON beta_feedback FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Auth read" ON conversations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Own insert" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read" ON bets FOR SELECT USING (true);
CREATE POLICY "Own insert" ON bets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- STEP 7: Users table
-- ============================================================
CREATE POLICY "Public read" ON users FOR SELECT USING (true);
CREATE POLICY "Own insert" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Own update" ON users FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- STEP 7b: lists / list_items — already had RLS but only SELECT
-- policies. Add write policies so users can manage their own.
-- ============================================================
CREATE POLICY "Own insert" ON lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own delete" ON lists FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Own insert" ON list_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own update" ON list_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own delete" ON list_items FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- STEP 8: Additional tables that may exist
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='trivia_poll_drafts') THEN
    ALTER TABLE trivia_poll_drafts ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "Auth read" ON trivia_poll_drafts FOR SELECT USING (auth.uid() IS NOT NULL)';
    EXECUTE 'CREATE POLICY "Auth insert" ON trivia_poll_drafts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
    EXECUTE 'CREATE POLICY "Auth update" ON trivia_poll_drafts FOR UPDATE USING (auth.uid() IS NOT NULL)';
    EXECUTE 'CREATE POLICY "Auth delete" ON trivia_poll_drafts FOR DELETE USING (auth.uid() IS NOT NULL)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='app_settings') THEN
    ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "Auth read" ON app_settings FOR SELECT USING (auth.uid() IS NOT NULL)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='login_streaks') THEN
    ALTER TABLE login_streaks ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "Public read" ON login_streaks FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "Own insert" ON login_streaks FOR INSERT WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Own update" ON login_streaks FOR UPDATE USING (auth.uid() = user_id)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='notifications') THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "Own read" ON notifications FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END $$;

