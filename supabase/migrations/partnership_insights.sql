-- ========================================
-- PARTNERSHIP INSIGHTS
-- Analytics for Netflix, Goodreads, Barnes & Noble, etc.
-- ========================================

-- ========================================
-- 1. CROSS-PLATFORM ENGAGEMENT
-- "Users who watch Netflix also listen to..."
-- ========================================

CREATE OR REPLACE FUNCTION get_cross_platform_engagement()
RETURNS TABLE (
  primary_media_type TEXT,
  secondary_media_type TEXT,
  overlap_users BIGINT,
  overlap_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH user_media_types AS (
    SELECT 
      user_id,
      media_type
    FROM list_items
    WHERE media_type IS NOT NULL
    GROUP BY user_id, media_type
  ),
  media_type_pairs AS (
    SELECT 
      umt1.media_type as primary_type,
      umt2.media_type as secondary_type,
      COUNT(DISTINCT umt1.user_id) as overlap_count,
      (SELECT COUNT(DISTINCT user_id) FROM user_media_types WHERE media_type = umt1.media_type) as primary_total
    FROM user_media_types umt1
    INNER JOIN user_media_types umt2 
      ON umt1.user_id = umt2.user_id 
      AND umt1.media_type != umt2.media_type
    GROUP BY umt1.media_type, umt2.media_type
  )
  SELECT 
    primary_type as primary_media_type,
    secondary_type as secondary_media_type,
    overlap_count as overlap_users,
    ROUND((overlap_count::NUMERIC / NULLIF(primary_total, 0)) * 100, 1) as overlap_percentage
  FROM media_type_pairs
  WHERE overlap_count > 0
  ORDER BY overlap_count DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 1B. CROSS-PLATFORM AFFINITY ANALYSIS
-- "Netflix viewers also read X books, Taylor Swift fans watch Y movies"
-- ========================================

CREATE OR REPLACE FUNCTION get_platform_affinity_insights()
RETURNS TABLE (
  source_name TEXT,
  source_type TEXT,
  source_category TEXT,
  target_title TEXT,
  target_creator TEXT,
  target_type TEXT,
  affinity_count BIGINT,
  affinity_percentage NUMERIC,
  insight_text TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Popular creators (for creator-based affinities)
  popular_creators AS (
    SELECT 
      creator,
      media_type,
      COUNT(DISTINCT user_id) as user_count
    FROM list_items
    WHERE creator IS NOT NULL 
      AND creator != ''
      AND LENGTH(creator) > 2
    GROUP BY creator, media_type
    HAVING COUNT(DISTINCT user_id) >= 3
    ORDER BY user_count DESC
    LIMIT 20
  ),
  -- Popular platforms (Netflix, Spotify, etc via external_source)
  popular_platforms AS (
    SELECT 
      CASE 
        WHEN external_source LIKE '%netflix%' THEN 'Netflix'
        WHEN external_source LIKE '%spotify%' THEN 'Spotify'
        WHEN external_source LIKE '%hulu%' THEN 'Hulu'
        WHEN external_source LIKE '%disney%' THEN 'Disney+'
        WHEN external_source LIKE '%hbo%' THEN 'HBO'
        WHEN external_source LIKE '%amazon%' THEN 'Prime Video'
        ELSE external_source
      END as platform_name,
      media_type,
      COUNT(DISTINCT user_id) as user_count
    FROM list_items
    WHERE external_source IS NOT NULL
    GROUP BY 
      CASE 
        WHEN external_source LIKE '%netflix%' THEN 'Netflix'
        WHEN external_source LIKE '%spotify%' THEN 'Spotify'
        WHEN external_source LIKE '%hulu%' THEN 'Hulu'
        WHEN external_source LIKE '%disney%' THEN 'Disney+'
        WHEN external_source LIKE '%hbo%' THEN 'HBO'
        WHEN external_source LIKE '%amazon%' THEN 'Prime Video'
        ELSE external_source
      END,
      media_type
    HAVING COUNT(DISTINCT user_id) >= 3
  ),
  -- Creator affinity: Users who like Creator X also like Content Y
  creator_affinities AS (
    SELECT 
      pc.creator as source_name,
      pc.media_type as source_type,
      'creator' as source_category,
      li2.title as target_title,
      li2.creator as target_creator,
      li2.media_type as target_type,
      COUNT(DISTINCT li1.user_id) as affinity_count,
      ROUND((COUNT(DISTINCT li1.user_id)::NUMERIC / pc.user_count) * 100, 1) as affinity_percentage,
      CONCAT(
        'Fans of ', pc.creator, ' also enjoy ',
        CASE 
          WHEN li2.media_type = 'book' THEN 'reading'
          WHEN li2.media_type = 'music' THEN 'listening to'
          WHEN li2.media_type IN ('movie', 'tv') THEN 'watching'
          ELSE 'enjoying'
        END,
        ' "', li2.title, '"',
        CASE WHEN li2.creator IS NOT NULL AND li2.creator != '' 
          THEN CONCAT(' by ', li2.creator)
          ELSE ''
        END
      ) as insight
    FROM popular_creators pc
    INNER JOIN list_items li1 ON li1.creator = pc.creator AND li1.media_type = pc.media_type
    INNER JOIN list_items li2 
      ON li2.user_id = li1.user_id 
      AND li2.media_type != pc.media_type
      AND li2.title IS NOT NULL
      AND li2.title != ''
    GROUP BY pc.creator, pc.media_type, pc.user_count, li2.title, li2.creator, li2.media_type
    HAVING COUNT(DISTINCT li1.user_id) >= 2
    ORDER BY affinity_count DESC
    LIMIT 30
  ),
  -- Platform affinity: Netflix viewers also read X books
  platform_affinities AS (
    SELECT 
      pp.platform_name as source_name,
      pp.media_type as source_type,
      'platform' as source_category,
      li2.title as target_title,
      li2.creator as target_creator,
      li2.media_type as target_type,
      COUNT(DISTINCT li1.user_id) as affinity_count,
      ROUND((COUNT(DISTINCT li1.user_id)::NUMERIC / pp.user_count) * 100, 1) as affinity_percentage,
      CONCAT(
        pp.platform_name, ' viewers also ',
        CASE 
          WHEN li2.media_type = 'book' THEN 'read'
          WHEN li2.media_type = 'music' THEN 'listen to'
          WHEN li2.media_type IN ('movie', 'tv') THEN 'watch'
          ELSE 'enjoy'
        END,
        ' "', li2.title, '"',
        CASE WHEN li2.creator IS NOT NULL AND li2.creator != '' 
          THEN CONCAT(' by ', li2.creator)
          ELSE ''
        END
      ) as insight
    FROM popular_platforms pp
    INNER JOIN list_items li1 
      ON CASE 
        WHEN pp.platform_name = 'Netflix' THEN li1.external_source LIKE '%netflix%'
        WHEN pp.platform_name = 'Spotify' THEN li1.external_source LIKE '%spotify%'
        WHEN pp.platform_name = 'Hulu' THEN li1.external_source LIKE '%hulu%'
        WHEN pp.platform_name = 'Disney+' THEN li1.external_source LIKE '%disney%'
        WHEN pp.platform_name = 'HBO' THEN li1.external_source LIKE '%hbo%'
        WHEN pp.platform_name = 'Prime Video' THEN li1.external_source LIKE '%amazon%'
        ELSE li1.external_source = pp.platform_name
      END
      AND li1.media_type = pp.media_type
    INNER JOIN list_items li2 
      ON li2.user_id = li1.user_id 
      AND li2.media_type != pp.media_type
      AND li2.title IS NOT NULL
      AND li2.title != ''
    GROUP BY pp.platform_name, pp.media_type, pp.user_count, li2.title, li2.creator, li2.media_type
    HAVING COUNT(DISTINCT li1.user_id) >= 2
    ORDER BY affinity_count DESC
    LIMIT 30
  )
  -- Combine all affinities
  SELECT * FROM creator_affinities
  UNION ALL
  SELECT * FROM platform_affinities
  ORDER BY affinity_count DESC, affinity_percentage DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. TRENDING CONTENT (Last 7 Days)
-- What's hot right now
-- ========================================

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
  WITH recent_adds AS (
    SELECT 
      list_items.media_type as item_media_type,
      list_items.title as item_title,
      list_items.creator as item_creator,
      list_items.external_id as item_external_id,
      list_items.external_source as item_external_source,
      COUNT(*) as adds
    FROM list_items
    WHERE list_items.added_at >= NOW() - INTERVAL '7 days'
      AND list_items.title IS NOT NULL
      AND list_items.title != ''
    GROUP BY list_items.media_type, list_items.title, list_items.creator, list_items.external_id, list_items.external_source
  ),
  recent_posts AS (
    SELECT 
      social_posts.media_type as post_media_type,
      social_posts.media_title as post_title,
      social_posts.media_creator as post_creator,
      social_posts.media_external_id as post_external_id,
      social_posts.media_external_source as post_external_source,
      COUNT(*) as posts
    FROM social_posts
    WHERE social_posts.created_at >= NOW() - INTERVAL '7 days'
      AND social_posts.media_title IS NOT NULL
    GROUP BY social_posts.media_type, social_posts.media_title, social_posts.media_creator, social_posts.media_external_id, social_posts.media_external_source
  )
  SELECT 
    COALESCE(ra.item_media_type, rp.post_media_type) as media_type,
    COALESCE(ra.item_title, rp.post_title) as title,
    COALESCE(ra.item_creator, rp.post_creator) as creator,
    COALESCE(ra.item_external_id, rp.post_external_id) as external_id,
    COALESCE(ra.item_external_source, rp.post_external_source) as external_source,
    COALESCE(ra.adds, 0) as adds_count,
    COALESCE(rp.posts, 0) as posts_count,
    COALESCE(ra.adds, 0) + COALESCE(rp.posts, 0) as total_engagement
  FROM recent_adds ra
  FULL OUTER JOIN recent_posts rp 
    ON ra.item_external_id = rp.post_external_id 
    AND ra.item_external_source = rp.post_external_source
  ORDER BY total_engagement DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. ENTERTAINMENT DNA CLUSTERS
-- Personality-based content preferences
-- ========================================

CREATE OR REPLACE FUNCTION get_dna_clusters()
RETURNS TABLE (
  cluster_label TEXT,
  user_count BIGINT,
  top_genres TEXT[],
  top_media_types TEXT[],
  avg_items_tracked NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH dna_users AS (
    SELECT 
      COALESCE(dp.label, 'Uncategorized') as label,
      dp.user_id,
      dp.favorite_genres,
      dp.favorite_media_types
    FROM dna_profiles dp
  ),
  user_tracking AS (
    SELECT 
      user_id,
      COUNT(*) as items_tracked
    FROM list_items
    GROUP BY user_id
  )
  SELECT 
    du.label as cluster_label,
    COUNT(DISTINCT du.user_id) as user_count,
    (SELECT ARRAY_AGG(DISTINCT genre) FROM UNNEST(du.favorite_genres) AS genre LIMIT 5) as top_genres,
    (SELECT ARRAY_AGG(DISTINCT media_type) FROM UNNEST(du.favorite_media_types) AS media_type LIMIT 3) as top_media_types,
    ROUND(AVG(COALESCE(ut.items_tracked, 0)), 1) as avg_items_tracked
  FROM dna_users du
  LEFT JOIN user_tracking ut ON du.user_id = ut.user_id
  GROUP BY du.label
  ORDER BY user_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. COMPLETION RATES BY MEDIA TYPE
-- What % of content do users finish
-- ========================================

CREATE OR REPLACE FUNCTION get_completion_rates()
RETURNS TABLE (
  media_type TEXT,
  total_items BIGINT,
  avg_progress NUMERIC,
  items_completed BIGINT,
  completion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    li.media_type,
    COUNT(*) as total_items,
    ROUND(AVG(COALESCE(li.progress, 0)), 1) as avg_progress,
    COUNT(*) FILTER (WHERE li.progress >= 100) as items_completed,
    ROUND((COUNT(*) FILTER (WHERE li.progress >= 100)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 1) as completion_rate
  FROM list_items li
  WHERE li.media_type IS NOT NULL
    AND li.progress_mode = 'percent'
  GROUP BY li.media_type
  ORDER BY total_items DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. VIRAL CONTENT (Social Sharing)
-- What drives shares and engagement
-- ========================================

CREATE OR REPLACE FUNCTION get_viral_content()
RETURNS TABLE (
  media_type TEXT,
  title TEXT,
  creator TEXT,
  posts_count BIGINT,
  likes_count BIGINT,
  comments_count BIGINT,
  virality_score BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.media_type,
    sp.media_title as title,
    sp.media_creator as creator,
    COUNT(DISTINCT sp.id) as posts_count,
    SUM(sp.likes_count) as likes_count,
    SUM(sp.comments_count) as comments_count,
    (COUNT(DISTINCT sp.id) * 10) + SUM(sp.likes_count) + (SUM(sp.comments_count) * 2) as virality_score
  FROM social_posts sp
  WHERE sp.media_title IS NOT NULL
    AND sp.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY sp.media_type, sp.media_title, sp.media_creator
  ORDER BY virality_score DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. CREATOR INFLUENCE
-- Which creators drive the most engagement
-- ========================================

CREATE OR REPLACE FUNCTION get_creator_influence()
RETURNS TABLE (
  creator_name TEXT,
  creator_role TEXT,
  followers_count BIGINT,
  media_tracked BIGINT,
  social_posts BIGINT,
  influence_score BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH creator_follows AS (
    SELECT 
      creator_name,
      creator_role,
      COUNT(DISTINCT user_id) as followers
    FROM followed_creators
    GROUP BY creator_name, creator_role
  ),
  creator_tracking AS (
    SELECT 
      creator,
      COUNT(*) as tracked_count
    FROM list_items
    WHERE creator IS NOT NULL
    GROUP BY creator
  ),
  creator_posts AS (
    SELECT 
      media_creator,
      COUNT(*) as post_count
    FROM social_posts
    WHERE media_creator IS NOT NULL
    GROUP BY media_creator
  )
  SELECT 
    cf.creator_name,
    cf.creator_role,
    cf.followers as followers_count,
    COALESCE(ct.tracked_count, 0) as media_tracked,
    COALESCE(cp.post_count, 0) as social_posts,
    (cf.followers * 5) + COALESCE(ct.tracked_count, 0) + (COALESCE(cp.post_count, 0) * 2) as influence_score
  FROM creator_follows cf
  LEFT JOIN creator_tracking ct ON cf.creator_name = ct.creator
  LEFT JOIN creator_posts cp ON cf.creator_name = cp.media_creator
  ORDER BY influence_score DESC
  LIMIT 30;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 7. PLATFORM ENGAGEMENT BY TIME
-- When are users most active
-- ========================================

CREATE OR REPLACE FUNCTION get_platform_engagement_timeline()
RETURNS TABLE (
  hour_of_day INTEGER,
  day_of_week TEXT,
  action_count BIGINT,
  unique_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH all_actions AS (
    SELECT user_id, created_at FROM list_items WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT user_id, created_at FROM social_posts WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT user_id, created_at FROM user_predictions WHERE created_at >= NOW() - INTERVAL '30 days'
  )
  SELECT 
    EXTRACT(HOUR FROM created_at)::INTEGER as hour_of_day,
    TO_CHAR(created_at, 'Day') as day_of_week,
    COUNT(*) as action_count,
    COUNT(DISTINCT user_id) as unique_users
  FROM all_actions
  GROUP BY hour_of_day, day_of_week
  ORDER BY action_count DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 8. PARTNERSHIP SUMMARY
-- Executive overview for partners
-- ========================================

CREATE OR REPLACE FUNCTION get_partnership_summary()
RETURNS TABLE (
  total_content_tracked BIGINT,
  total_social_posts BIGINT,
  avg_completion_rate NUMERIC,
  top_trending_title TEXT,
  top_trending_engagement BIGINT,
  most_viral_title TEXT,
  most_viral_score BIGINT
) AS $$
DECLARE
  trending_title TEXT;
  trending_engagement BIGINT;
  viral_title TEXT;
  viral_score BIGINT;
BEGIN
  -- Get top trending
  SELECT title, total_engagement INTO trending_title, trending_engagement
  FROM get_trending_content()
  LIMIT 1;

  -- Get most viral
  SELECT title, virality_score INTO viral_title, viral_score
  FROM get_viral_content()
  LIMIT 1;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM list_items) as total_content_tracked,
    (SELECT COUNT(*) FROM social_posts) as total_social_posts,
    (SELECT ROUND(AVG(completion_rate), 1) FROM get_completion_rates()) as avg_completion_rate,
    trending_title,
    trending_engagement,
    viral_title,
    viral_score;
END;
$$ LANGUAGE plpgsql;
