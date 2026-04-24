-- ============================================================
-- CONSUMED — Category Mislabeling Fix (April 2026)
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mahpgcogwpawvviapqza/sql/new
--
-- prediction_pools schema confirmed: NO media_type column.
-- Columns used here: category, title, show_tag, type.
--
-- ALWAYS run the SELECT preview first, then the UPDATE.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- STEP 1: PREVIEW — what podcast questions are mislabeled?
-- ──────────────────────────────────────────────────────────────
SELECT id, title, category AS current_category, show_tag, media_external_source
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
)
AND category != 'Podcasts'
AND type IN ('trivia', 'vote')
ORDER BY created_at DESC;


-- ──────────────────────────────────────────────────────────────
-- STEP 2: FIX — update category only (no media_type column)
-- ──────────────────────────────────────────────────────────────
UPDATE prediction_pools
SET category = 'Podcasts'
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
)
AND category != 'Podcasts'
AND type IN ('trivia', 'vote');


-- ──────────────────────────────────────────────────────────────
-- STEP 3: PREVIEW — gaming questions mislabeled?
-- ──────────────────────────────────────────────────────────────
SELECT id, title, category AS current_category, show_tag
FROM prediction_pools
WHERE (
  title    ILIKE '%video game%'
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
-- STEP 4: FIX — gaming questions
-- ──────────────────────────────────────────────────────────────
UPDATE prediction_pools
SET category = 'Gaming'
WHERE (
  title    ILIKE '%video game%'
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
-- STEP 5: Final count by category — confirm everything looks right
-- ──────────────────────────────────────────────────────────────
SELECT category, COUNT(*) AS total
FROM prediction_pools
WHERE type IN ('trivia', 'vote')
GROUP BY category
ORDER BY total DESC;
