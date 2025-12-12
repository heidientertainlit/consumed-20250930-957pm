-- Badges System Schema
-- Run this in Supabase SQL Editor to create the badges tables

-- Badge type enum
CREATE TYPE badge_type AS ENUM ('status', 'achievement', 'community');

-- Badges definition table
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT,
  badge_type badge_type NOT NULL DEFAULT 'status',
  theme_color TEXT NOT NULL DEFAULT '#d97706',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User badges assignment table
CREATE TABLE user_badges (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  awarded_by UUID REFERENCES auth.users(id),
  notes TEXT,
  PRIMARY KEY (user_id, badge_id)
);

-- Indexes for efficient querying
CREATE INDEX user_badges_user_idx ON user_badges(user_id);
CREATE INDEX user_badges_badge_idx ON user_badges(badge_id);
CREATE INDEX badges_slug_idx ON badges(slug);

-- Enable RLS
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Badges are readable by everyone (public info)
CREATE POLICY "Badges are viewable by everyone" ON badges
  FOR SELECT USING (true);

-- User badges are readable by everyone (displayed on profiles)
CREATE POLICY "User badges are viewable by everyone" ON user_badges
  FOR SELECT USING (true);

-- Only service role can insert/update badges
CREATE POLICY "Only service role can manage badges" ON badges
  FOR ALL USING (auth.role() = 'service_role');

-- Only service role can grant/revoke badges
CREATE POLICY "Only service role can grant badges" ON user_badges
  FOR ALL USING (auth.role() = 'service_role');

-- Seed the initial badges
INSERT INTO badges (slug, name, emoji, description, badge_type, theme_color) VALUES
  ('og', 'OG', '🏆', 'Original supporter - with us from the beginning', 'status', '#d97706'),
  ('streak-star', 'Streak Star', '🔥', 'Logged activity for 7+ days in a row', 'achievement', '#ef4444'),
  ('leaderboard-legend', 'Leaderboard Legend', '👑', 'Held #1 spot on a leaderboard for 7+ days', 'achievement', '#eab308'),
  ('prediction-pro', 'Prediction Pro', '🎯', 'Correctly predicted 10+ outcomes', 'achievement', '#10b981'),
  ('trivia-titan', 'Trivia Titan', '🧠', 'Won 25+ trivia games or hit 90%+ accuracy', 'achievement', '#8b5cf6');

-- Query to find all users with a specific badge (for email campaigns):
-- SELECT u.email, u.id, ub.awarded_at 
-- FROM auth.users u 
-- JOIN user_badges ub ON u.id = ub.user_id 
-- JOIN badges b ON ub.badge_id = b.id 
-- WHERE b.slug = 'og';

-- Grant a badge to a user (example):
-- INSERT INTO user_badges (user_id, badge_id)
-- SELECT 'user-uuid-here', id FROM badges WHERE slug = 'og';
