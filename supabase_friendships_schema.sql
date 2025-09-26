
-- Create friendships table for friend connections
CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, friend_id)
);

-- Enable RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- RLS policies for friendships
CREATE POLICY "view_friendships" ON friendships
  FOR SELECT USING (
    auth.uid()::text = user_id OR auth.uid()::text = friend_id
  );

CREATE POLICY "create_friendship_requests" ON friendships
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id
  );

CREATE POLICY "update_friendships" ON friendships
  FOR UPDATE USING (
    auth.uid()::text = friend_id OR auth.uid()::text = user_id
  );

CREATE POLICY "delete_friendships" ON friendships
  FOR DELETE USING (
    auth.uid()::text = user_id OR auth.uid()::text = friend_id
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- Prevent users from friending themselves
ALTER TABLE friendships ADD CONSTRAINT no_self_friendship CHECK (user_id != friend_id);
