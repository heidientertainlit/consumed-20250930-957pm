-- The previous migration inferred confirmation for established accounts.
-- Product policy now requires every person to explicitly confirm once.
-- Existing names, usernames, DNA, ratings, and all other profile data remain intact.
UPDATE public.users
SET identity_confirmed_at = NULL
WHERE identity_confirmed_at IS NOT NULL;