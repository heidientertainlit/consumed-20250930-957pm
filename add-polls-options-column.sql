-- Add options column to polls table (simple JSONB column)
ALTER TABLE polls 
ADD COLUMN IF NOT EXISTS options JSONB;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'polls' 
AND column_name = 'options';
