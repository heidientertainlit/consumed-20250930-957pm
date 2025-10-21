-- Verify polls table has all required columns including options JSONB

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'polls'
ORDER BY ordinal_position;

-- Also verify we have active polls with options data
SELECT 
  id, 
  question, 
  type,
  CASE 
    WHEN options IS NULL THEN 'NULL - MISSING OPTIONS!'
    ELSE jsonb_array_length(options)::text || ' options'
  END as options_check,
  status
FROM polls 
WHERE status = 'active'
ORDER BY id;
