
-- Create friendships table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Prevent duplicate friendships and self-friendships
    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);
CREATE INDEX IF NOT EXISTS idx_friendships_user_status ON public.friendships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_status ON public.friendships(friend_id, status);

-- Enable Row Level Security
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
CREATE POLICY "Users can view their own friendships" ON public.friendships
    FOR SELECT USING (
        auth.uid() = user_id OR auth.uid() = friend_id
    );

CREATE POLICY "Users can create friendships involving themselves" ON public.friendships
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR auth.uid() = friend_id
    );

CREATE POLICY "Users can update their own friendships" ON public.friendships
    FOR UPDATE USING (
        auth.uid() = user_id OR auth.uid() = friend_id
    );

CREATE POLICY "Users can delete their own friendships" ON public.friendships
    FOR DELETE USING (
        auth.uid() = user_id OR auth.uid() = friend_id
    );

-- Create function to handle friendship updates
CREATE OR REPLACE FUNCTION handle_friendship_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_friendships_updated_at
    BEFORE UPDATE ON public.friendships
    FOR EACH ROW
    EXECUTE FUNCTION handle_friendship_updated();
