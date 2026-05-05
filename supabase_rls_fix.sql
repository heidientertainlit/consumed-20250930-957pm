-- ============================================================
-- CONSUMED — RLS Security Fix (exact schema, May 2026)
-- Applied directly via Supabase Management API where noted.
-- For anything still needed: run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mahpgcogwpawvviapqza/sql/new
-- ============================================================

-- ── binge_battles ─────────────────────────────────────── (APPLIED)
ALTER TABLE binge_battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"
  ON binge_battles FOR SELECT
  USING (true);

CREATE POLICY "Challenger insert"
  ON binge_battles FOR INSERT
  WITH CHECK (auth.uid()::text = challenger_id);

CREATE POLICY "Participant update"
  ON binge_battles FOR UPDATE
  USING (
    auth.uid()::text = challenger_id
    OR auth.uid()::text = opponent_id
  );

CREATE POLICY "Participant delete"
  ON binge_battles FOR DELETE
  USING (
    auth.uid()::text = challenger_id
    OR auth.uid()::text = opponent_id
  );

-- ── media_engagements ─────────────────────────────────── (APPLIED May 2026)
-- Legacy/unused table flagged by Supabase security alert.
-- Applied directly via Management API — no action needed.
ALTER TABLE media_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own engagements"
  ON media_engagements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own engagements"
  ON media_engagements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own engagements"
  ON media_engagements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own engagements"
  ON media_engagements FOR DELETE
  USING (auth.uid() = user_id);

-- ── login_streaks ────────────────────────────── (RUN IF NOT APPLIED)
-- Needed for streak display: lets authenticated users read their own row.
-- The edge function (service role) writes streaks fine, but the
-- frontend's direct SELECT queries need this to show the counter.
CREATE POLICY "Users read own streak"
  ON login_streaks FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- Add play_completed_date column if it doesn't already exist:
ALTER TABLE login_streaks
  ADD COLUMN IF NOT EXISTS play_completed_date date;

-- ── Verify all clear ────────────────────────────────────────
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false
ORDER BY tablename;
-- Should return 0 rows.
