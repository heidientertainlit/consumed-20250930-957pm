-- ============================================================
-- CONSUMED — Category Mislabeling Fix (April 2026)
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mahpgcogwpawvviapqza/sql/new
--
-- Root cause: GPT was generating "TV" for podcast questions because
-- "Podcasts" was missing from the allowed category list in the prompt.
-- Fixed going forward via deterministic guardian in the edge function.
-- This script fixes records already in the database.
--
-- ALWAYS run the SELECT preview first to confirm scope before UPDATE.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- STEP 1: PREVIEW — Podcast questions mislabeled as TV
-- ──────────────────────────────────────────────────────────────
SELECT
  id,
  title,
  category        AS current_category,
  media_type      AS current_media_type,
  show_tag,
  type,
  status
FROM prediction_pools
WHERE (
  title    ILIKE '%podcast%'
  OR show_tag ILIKE '%podcast%'
  OR show_tag ILIKE '%serial%'
  OR show_tag ILIKE '%crime junkie%'
  OR show_tag ILIKE '%hidden brain%'
  OR show_tag ILIKE '%stuff you should know%'
  OR show_tag ILIKE '%the daily%'
  OR show_tag ILIKE '%armchair expert%'
  OR show_tag ILIKE '%call her daddy%'
  OR show_tag ILIKE '%this american life%'
  OR show_tag ILIKE '%how i built this%'
  OR show_tag ILIKE '%my favorite murder%'
  OR show_tag ILIKE '%conan%'
  OR show_tag ILIKE '%smartless%'
  OR show_tag ILIKE '%radiolab%'
  OR show_tag ILIKE '%freakonomics%'
  OR show_tag ILIKE '%morbid%'
  OR show_tag ILIKE '%casefile%'
  OR show_tag ILIKE '%true crime garage%'
  OR media_type = 'podcast'
)
AND category != 'Podcasts'
AND type IN ('trivia', 'vote')
ORDER BY created_at DESC;


-- ──────────────────────────────────────────────────────────────
-- STEP 2: FIX — Podcast questions in prediction_pools
-- (Run only after reviewing Step 1 output above)
-- ──────────────────────────────────────────────────────────────
UPDATE prediction_pools
SET
  category   = 'Podcasts',
  media_type = 'podcast'
WHERE (
  title    ILIKE '%podcast%'
  OR show_tag ILIKE '%podcast%'
  OR show_tag ILIKE '%serial%'
  OR show_tag ILIKE '%crime junkie%'
  OR show_tag ILIKE '%hidden brain%'
  OR show_tag ILIKE '%stuff you should know%'
  OR show_tag ILIKE '%the daily%'
  OR show_tag ILIKE '%armchair expert%'
  OR show_tag ILIKE '%call her daddy%'
  OR show_tag ILIKE '%this american life%'
  OR show_tag ILIKE '%how i built this%'
  OR show_tag ILIKE '%my favorite murder%'
  OR show_tag ILIKE '%conan%'
  OR show_tag ILIKE '%smartless%'
  OR show_tag ILIKE '%radiolab%'
  OR show_tag ILIKE '%freakonomics%'
  OR show_tag ILIKE '%morbid%'
  OR show_tag ILIKE '%casefile%'
  OR show_tag ILIKE '%true crime garage%'
  OR media_type = 'podcast'
)
AND category != 'Podcasts'
AND type IN ('trivia', 'vote');


-- ──────────────────────────────────────────────────────────────
-- STEP 3: PREVIEW — Gaming questions mislabeled
-- ──────────────────────────────────────────────────────────────
SELECT
  id,
  title,
  category        AS current_category,
  media_type      AS current_media_type,
  show_tag,
  type
FROM prediction_pools
WHERE (
  media_type = 'game'
  OR title ILIKE '%video game%'
  OR show_tag ILIKE '%super mario%'
  OR show_tag ILIKE '%zelda%'
  OR show_tag ILIKE '%pokemon%'
  OR show_tag ILIKE '%minecraft%'
  OR show_tag ILIKE '%call of duty%'
  OR show_tag ILIKE '%fortnite%'
  OR show_tag ILIKE '%grand theft auto%'
)
AND category != 'Gaming'
AND type IN ('trivia', 'vote')
ORDER BY created_at DESC;


-- ──────────────────────────────────────────────────────────────
-- STEP 4: FIX — Gaming questions in prediction_pools
-- ──────────────────────────────────────────────────────────────
UPDATE prediction_pools
SET
  category   = 'Gaming',
  media_type = 'game'
WHERE (
  media_type = 'game'
  OR title ILIKE '%video game%'
  OR show_tag ILIKE '%super mario%'
  OR show_tag ILIKE '%zelda%'
  OR show_tag ILIKE '%pokemon%'
  OR show_tag ILIKE '%minecraft%'
  OR show_tag ILIKE '%call of duty%'
  OR show_tag ILIKE '%fortnite%'
  OR show_tag ILIKE '%grand theft auto%'
)
AND category != 'Gaming'
AND type IN ('trivia', 'vote');


-- ──────────────────────────────────────────────────────────────
-- STEP 5: Verify — confirm fixed counts
-- ──────────────────────────────────────────────────────────────
SELECT category, COUNT(*) AS total
FROM prediction_pools
WHERE type IN ('trivia', 'vote')
GROUP BY category
ORDER BY total DESC;
