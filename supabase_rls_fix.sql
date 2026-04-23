-- ============================================================
-- CONSUMED — RLS Security Fix (exact schema, April 2026)
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mahpgcogwpawvviapqza/sql/new
--
-- Only binge_battles has RLS disabled. Everything else is fine.
-- ============================================================

-- 1. Enable RLS
ALTER TABLE binge_battles ENABLE ROW LEVEL SECURITY;

-- 2. Anyone can read battles (needed for feed cards and profile)
CREATE POLICY "Public read"
  ON binge_battles FOR SELECT
  USING (true);

-- 3. Only the challenger can create a battle
CREATE POLICY "Challenger insert"
  ON binge_battles FOR INSERT
  WITH CHECK (auth.uid()::text = challenger_id);

-- 4. Either participant can update progress / accept / resolve
CREATE POLICY "Participant update"
  ON binge_battles FOR UPDATE
  USING (
    auth.uid()::text = challenger_id
    OR auth.uid()::text = opponent_id
  );

-- 5. Either participant can cancel/delete their own battle
CREATE POLICY "Participant delete"
  ON binge_battles FOR DELETE
  USING (
    auth.uid()::text = challenger_id
    OR auth.uid()::text = opponent_id
  );

-- Verify
SELECT tablename, rowsecurity,
  (SELECT count(*) FROM pg_policies p
   WHERE p.schemaname = 'public' AND p.tablename = t.tablename) AS policy_count
FROM pg_tables t
WHERE schemaname = 'public' AND tablename = 'binge_battles';
