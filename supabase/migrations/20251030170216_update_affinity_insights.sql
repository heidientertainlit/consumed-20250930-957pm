-- Enhanced Cross-Platform Affinity Analysis with DNA and Recommendations
-- Adds DNA-based and recommendation-based affinity insights

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
      pc.creator::TEXT as source_name,
      pc.media_type::TEXT as source_type,
      'creator'::TEXT as source_category,
      li2.title::TEXT as target_title,
      li2.creator::TEXT as target_creator,
      li2.media_type::TEXT as target_type,
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
      pp.platform_name::TEXT as source_name,
      pp.media_type::TEXT as source_type,
      'platform'::TEXT as source_category,
      li2.title::TEXT as target_title,
      li2.creator::TEXT as target_creator,
      li2.media_type::TEXT as target_type,
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
  ),
  -- DNA-based affinity: Users with similar Entertainment DNA profiles
  dna_affinities AS (
    SELECT 
      dp.label::TEXT as source_name,
      COALESCE(genre, 'mixed')::TEXT as source_type,
      'dna'::TEXT as source_category,
      li.title::TEXT as target_title,
      li.creator::TEXT as target_creator,
      li.media_type::TEXT as target_type,
      COUNT(DISTINCT dp.user_id) as affinity_count,
      ROUND((COUNT(DISTINCT dp.user_id)::NUMERIC / NULLIF(COUNT(DISTINCT dp2.user_id), 0)) * 100, 1) as affinity_percentage,
      CONCAT(
        'Users with "', dp.label, '" DNA who love ', genre, ' also enjoy ',
        CASE 
          WHEN li.media_type = 'book' THEN 'reading'
          WHEN li.media_type = 'music' THEN 'listening to'
          WHEN li.media_type IN ('movie', 'tv') THEN 'watching'
          ELSE 'enjoying'
        END,
        ' "', li.title, '"',
        CASE WHEN li.creator IS NOT NULL AND li.creator != '' 
          THEN CONCAT(' by ', li.creator)
          ELSE ''
        END
      ) as insight
    FROM dna_profiles dp
    CROSS JOIN LATERAL jsonb_array_elements_text(dp.favorite_genres) genre
    INNER JOIN list_items li ON li.user_id = dp.user_id
    INNER JOIN dna_profiles dp2 ON dp2.label = dp.label
    WHERE dp.label IS NOT NULL
      AND dp.label != ''
      AND li.title IS NOT NULL
      AND li.title != ''
    GROUP BY dp.label, genre, li.title, li.creator, li.media_type
    HAVING COUNT(DISTINCT dp.user_id) >= 2
    ORDER BY affinity_count DESC
    LIMIT 20
  ),
  -- Recommendation-based affinity: Users who liked similar recommendations
  recommendation_affinities AS (
    SELECT 
      rec_item->>'title' as source_name,
      rec_item->>'media_type' as source_type,
      'recommendation'::TEXT as source_category,
      li.title::TEXT as target_title,
      li.creator::TEXT as target_creator,
      li.media_type::TEXT as target_type,
      COUNT(DISTINCT ur.user_id) as affinity_count,
      ROUND((COUNT(DISTINCT ur.user_id)::NUMERIC / NULLIF(COUNT(DISTINCT ur2.user_id), 0)) * 100, 1) as affinity_percentage,
      CONCAT(
        'Users who received recommendations for "', rec_item->>'title', '" also ',
        CASE 
          WHEN li.media_type = 'book' THEN 'read'
          WHEN li.media_type = 'music' THEN 'listen to'
          WHEN li.media_type IN ('movie', 'tv') THEN 'watch'
          ELSE 'enjoy'
        END,
        ' "', li.title, '"',
        CASE WHEN li.creator IS NOT NULL AND li.creator != '' 
          THEN CONCAT(' by ', li.creator)
          ELSE ''
        END
      ) as insight
    FROM user_recommendations ur
    CROSS JOIN LATERAL jsonb_array_elements(ur.recommendations) rec_item
    INNER JOIN list_items li ON li.user_id = ur.user_id AND li.media_type != rec_item->>'media_type'
    INNER JOIN user_recommendations ur2 ON ur2.user_id != ur.user_id
    CROSS JOIN LATERAL jsonb_array_elements(ur2.recommendations) rec_item2
    WHERE rec_item->>'title' = rec_item2->>'title'
      AND li.title IS NOT NULL
      AND li.title != ''
      AND rec_item->>'title' IS NOT NULL
    GROUP BY rec_item->>'title', rec_item->>'media_type', li.title, li.creator, li.media_type
    HAVING COUNT(DISTINCT ur.user_id) >= 2
    ORDER BY affinity_count DESC
    LIMIT 20
  )
  -- Combine all affinities
  SELECT * FROM creator_affinities
  UNION ALL
  SELECT * FROM platform_affinities
  UNION ALL
  SELECT * FROM dna_affinities
  UNION ALL
  SELECT * FROM recommendation_affinities
  ORDER BY affinity_count DESC, affinity_percentage DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;
