-- Add columns to prediction_pools for collaborative user-driven predictions
ALTER TABLE prediction_pools ADD COLUMN IF NOT EXISTS invited_user_id VARCHAR;
ALTER TABLE prediction_pools ADD COLUMN IF NOT EXISTS media_external_id TEXT;
ALTER TABLE prediction_pools ADD COLUMN IF NOT EXISTS media_external_source VARCHAR;

-- Add foreign key for invited_user_id
ALTER TABLE prediction_pools ADD CONSTRAINT fk_invited_user 
  FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Ensure user_predictions has proper timestamps and points tracking
ALTER TABLE user_predictions ADD COLUMN IF NOT EXISTS points_earned INTEGER;
ALTER TABLE user_predictions ADD COLUMN IF NOT EXISTS is_winner BOOLEAN;
ALTER TABLE user_predictions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Add index for faster queries on collaborative predictions
CREATE INDEX IF NOT EXISTS idx_prediction_pools_invited_user ON prediction_pools(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_pools_origin_user ON prediction_pools(origin_user_id);
CREATE INDEX IF NOT EXISTS idx_user_predictions_user_pool ON user_predictions(user_id, pool_id);

-- Add unique constraint to prevent duplicate predictions
ALTER TABLE user_predictions ADD CONSTRAINT uq_user_prediction 
  UNIQUE (user_id, pool_id) DEFERRABLE INITIALLY DEFERRED;
