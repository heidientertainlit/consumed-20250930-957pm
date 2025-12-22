-- Add missing columns to social_posts for Hot Take voting and Ranks
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS rank_id varchar;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS fire_votes integer DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS ice_votes integer DEFAULT 0;
