-- Migration: Consolidate polls from 3 tables to 2 tables (match prediction_pools pattern)
-- This adds options as JSONB to polls table and migrates data from poll_options

-- Step 1: Add options column to polls table
ALTER TABLE polls 
ADD COLUMN IF NOT EXISTS options JSONB;

-- Step 2: Migrate poll_options data into polls.options as JSONB array
UPDATE polls p
SET options = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', po.id,
      'label', po.label,
      'description', po.description,
      'imageUrl', po.image_url,
      'orderIndex', po.order_index,
      'metadata', po.metadata
    ) ORDER BY po.order_index
  )
  FROM poll_options po
  WHERE po.poll_id = p.id
)
WHERE EXISTS (
  SELECT 1 FROM poll_options po2 WHERE po2.poll_id = p.id
);

-- Step 3: Verify migration (run this to check)
SELECT 
  p.id,
  p.question,
  jsonb_array_length(p.options) as option_count,
  p.options
FROM polls p
WHERE p.status = 'active'
ORDER BY p.id;

-- Step 4: OPTIONAL - Drop poll_options table after verifying migration
-- IMPORTANT: Only run this after confirming all polls have options populated!
-- DROP TABLE IF EXISTS poll_options CASCADE;

-- Step 5: Update poll_responses to remove FK constraint to poll_options
-- The optionId column will now just store the ID without a foreign key
-- (Already done by removing the FK in the schema)
