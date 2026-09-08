-- Preserve owner additions and public community contributions, while preventing
-- an item owned by the caller from being inserted into someone else's private rank.
ALTER POLICY "Users can insert rank items"
ON public.rank_items
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.ranks AS parent_rank
    WHERE parent_rank.id = rank_items.rank_id
      AND (
        parent_rank.user_id = auth.uid()
        OR parent_rank.visibility = 'public'
      )
  )
);