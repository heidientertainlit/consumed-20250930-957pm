-- Make deadlines optional in prediction_pools table
-- Run this FIRST, then run the games insert SQL

ALTER TABLE prediction_pools 
ALTER COLUMN deadline DROP NOT NULL;

-- Now deadline is optional and can be NULL