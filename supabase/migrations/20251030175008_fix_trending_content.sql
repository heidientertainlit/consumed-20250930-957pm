-- Fix Trending Content to show ONLY real media titles
-- Focuses on list_items (what users actually track) with strict garbage filters

CREATE OR REPLACE FUNCTION get_trending_content()
RETURNS TABLE (
  media_type TEXT,
  title TEXT,
  creator TEXT,
  external_id TEXT,
  external_source TEXT,
  adds_count BIGINT,
  posts_count BIGINT,
  total_engagement BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Recent adds from list_items (what users are tracking)
  recent_adds AS (
    SELECT 
      list_items.media_type,
      list_items.title,
      list_items.creator,
      list_items.external_id,
      list_items.external_source,
      COUNT(*) as add_count
    FROM list_items
    WHERE list_items.added_at >= NOW() - INTERVAL '7 days'
      AND list_items.title IS NOT NULL
      AND list_items.title != ''
      -- Strict filters to exclude garbage
      AND LENGTH(list_items.title) >= 2
      AND list_items.title !~ '^[0-9:\.]+$'          -- No timestamps like "00:00:04"
      AND list_items.title NOT LIKE '%@%'             -- No emails
      AND list_items.title NOT ILIKE '%gmail%'        -- No email domains
      AND list_items.title NOT ILIKE '%yahoo%'
      AND list_items.title NOT ILIKE '%hotmail%'
      AND list_items.title != 'undefined'
      AND list_items.title != 'null'
      AND list_items.external_id IS NOT NULL          -- Must have external ID (real content)
    GROUP BY list_items.media_type, list_items.title, list_items.creator, list_items.external_id, list_items.external_source
    HAVING COUNT(*) >= 2  -- At least 2 users added it
  ),
  -- Posts about this media (social engagement)
  post_engagement AS (
    SELECT 
      social_posts.media_external_id as external_id,
      social_posts.media_external_source as external_source,
      COUNT(*) as post_count
    FROM social_posts
    WHERE social_posts.created_at >= NOW() - INTERVAL '7 days'
      AND social_posts.media_external_id IS NOT NULL
    GROUP BY social_posts.media_external_id, social_posts.media_external_source
  )
  SELECT 
    ra.media_type::TEXT,
    ra.title::TEXT,
    ra.creator::TEXT,
    ra.external_id::TEXT,
    ra.external_source::TEXT,
    ra.add_count as adds_count,
    COALESCE(pe.post_count, 0) as posts_count,
    ra.add_count + COALESCE(pe.post_count, 0) as total_engagement
  FROM recent_adds ra
  LEFT JOIN post_engagement pe 
    ON ra.external_id = pe.external_id 
    AND ra.external_source = pe.external_source
  ORDER BY total_engagement DESC, ra.add_count DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;
