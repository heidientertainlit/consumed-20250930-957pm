-- Content Moderation System
-- Tables for reporting and moderating user-generated content

-- Content Reports - users can report inappropriate content
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'hot_take', 'list', 'review')),
  content_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'misinformation', 'inappropriate', 'spoiler', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Moderation Actions - log of all moderation decisions
CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES content_reports(id) ON DELETE SET NULL,
  moderator_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('remove', 'hide', 'warn', 'ban', 'dismiss', 'restore')),
  reason TEXT,
  target_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Warnings/Bans tracking
CREATE TABLE IF NOT EXISTS user_moderation_status (
  user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  warning_count INTEGER DEFAULT 0,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  banned_until TIMESTAMPTZ,
  banned_at TIMESTAMPTZ,
  banned_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_content ON content_reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON content_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_content ON moderation_actions(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_moderator ON moderation_actions(moderator_id);

-- RLS Policies
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_moderation_status ENABLE ROW LEVEL SECURITY;

-- Users can create reports
CREATE POLICY "Users can create reports" ON content_reports
  FOR INSERT WITH CHECK (true);

-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON content_reports
  FOR SELECT USING (reporter_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Admins can view all reports
CREATE POLICY "Admins can view all reports" ON content_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_id = current_setting('request.jwt.claims', true)::json->>'sub' AND is_admin = true)
  );

-- Admins can update reports
CREATE POLICY "Admins can update reports" ON content_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_id = current_setting('request.jwt.claims', true)::json->>'sub' AND is_admin = true)
  );

-- Only admins can view moderation actions
CREATE POLICY "Admins can view moderation actions" ON moderation_actions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_id = current_setting('request.jwt.claims', true)::json->>'sub' AND is_admin = true)
  );

-- Users can view their own moderation status
CREATE POLICY "Users can view own moderation status" ON user_moderation_status
  FOR SELECT USING (
    user_id = (SELECT id FROM profiles WHERE auth_id = current_setting('request.jwt.claims', true)::json->>'sub')
  );

-- Admins can manage moderation status
CREATE POLICY "Admins can manage moderation status" ON user_moderation_status
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE auth_id = current_setting('request.jwt.claims', true)::json->>'sub' AND is_admin = true)
  );
