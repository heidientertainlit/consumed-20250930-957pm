-- ============================================================
-- CONSUMED — RLS Security Fix (exact schema, April 2026)
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mahpgcogwpawvviapqza/sql/new
-- ============================================================

-- ── binge_battles ───────────────────────────────────────────
-- Enable RLS
ALTER TABLE binge_battles ENABLE ROW LEVEL SECURITY;

-- Anyone can read battles (needed for feed cards and profile)
CREATE POLICY "Public read"
  ON binge_battles FOR SELECT
  USING (true);

-- Only the challenger can create a battle
CREATE POLICY "Challenger insert"
  ON binge_battles FOR INSERT
  WITH CHECK (auth.uid()::text = challenger_id);

-- Either participant can update progress / accept / resolve
CREATE POLICY "Participant update"
  ON binge_battles FOR UPDATE
  USING (
    auth.uid()::text = challenger_id
    OR auth.uid()::text = opponent_id
  );

-- Either participant can cancel/delete their own battle
CREATE POLICY "Participant delete"
  ON binge_battles FOR DELETE
  USING (
    auth.uid()::text = challenger_id
    OR auth.uid()::text = opponent_id
  );

-- ── login_streaks ────────────────────────────────────────────
-- REQUIRED for streak display in the app.
-- The edge function (service role) writes streaks fine, but the
-- frontend's direct SELECT queries need this policy to read them.
-- Without it, the streak counter always shows null after playing.
--
-- Run this if login_streaks does not already have a SELECT policy:
CREATE POLICY "Users read own streak"
  ON login_streaks FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- Also add play_completed_date column if it doesn't exist:
ALTER TABLE login_streaks
  ADD COLUMN IF NOT EXISTS play_completed_date date;

-- Verify
SELECT tablename, rowsecurity,
  (SELECT count(*) FROM pg_policies p
   WHERE p.schemaname = 'public' AND p.tablename = t.tablename) AS policy_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN ('binge_battles', 'login_streaks')
ORDER BY tablename;
