# Consumed — Database Reference (Live as of May 2026)

> **RULE FOR AI AGENTS**: Never describe what a table "should" contain. Always query the database first.
> ```bash
> curl -s -X POST "https://api.supabase.com/v1/projects/mahpgcogwpawvviapqza/database/query" \
>   -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
>   -H "Content-Type: application/json" \
>   -d '{"query": "YOUR SQL HERE"}'
> ```

---

## Row Counts (Live — queried May 2026)

| Table | Rows | Status |
|---|---|---|
| `user_sessions` | 9,250 | Active |
| `user_dna_signals` | 2,394 | Active — core behavioral signal store |
| `list_items` | 2,289 | Active — tracked media items |
| `media_engagements` | 1,279 | Active |
| `user_creator_stats` | 1,025 | Active |
| `lists` | 931 | Active |
| `user_predictions` | 820 | Active — **all game answers live here** |
| `social_posts` | 796 | Active |
| `notifications` | 506 | Active |
| `media_ratings` | 415 | Active |
| `edna_responses` | 344 | Active |
| `prediction_pools` | 343 | Active — **all questions/pools live here** |
| `awards_picks` | 249 | Active |
| `awards_nominees` | 235 | Active |
| `social_post_likes` | 229 | Active |
| `seen_it_responses` | 199 | Active |
| `users` | 191 | Active — includes personas |
| `trivia_poll_drafts` | 187 | Active — Today's Play drafts |
| `dna_moment_responses` | 165 | Active |
| `user_recommendations` | 159 | Active |
| `friendships` | 140 | Active |
| `rank_items` | 133 | Active |
| `social_post_comments` | 129 | Active |
| `seen_it_items` | 113 | Active |
| `dna_profiles` | 50 | Active — 50 users have DNA profiles |
| `user_points` | 31 | Active |
| `login_streaks` | 25 | Active |
| `pools` | 7 | Active — Rooms |
| `binge_battles` | 3 | Active |
| `bets` | 3 | Active |
| `app_settings` | 1 | Active |

### Dead / Empty Tables — Never Query or Write To

| Table | Rows | Notes |
|---|---|---|
| `trivia_user_points` | 0 | Orphan — drop candidate |
| `trivia_results` | 0 | Old system, replaced |
| `trivia_sessions` | 0 | Old system, replaced |
| `trivia_answers` | 0 | Old system, replaced |
| `predictions` | 0 | Replaced by `user_predictions` |
| `prediction_likes` | 0 | Unused |
| `prediction_comment_likes` | 0 | Unused |
| `reviews` | 0 | Unused |
| `friend_invitations` | 0 | Unused |
| `strands` / `strand_*` | 0 | Feature never shipped |
| `ratings` | 0 | Replaced by `media_ratings` |
| `profiles` | 0 | Replaced by `users` + `dna_profiles` |
| `user_activity` | 0 | Unused |
| `user_lists` | 0 | Replaced by `lists` |
| `points_log` | 0 | Unused |
| `activity_logs` | 0 | Unused |
| `entertainment_dna` | 0 | Replaced by `user_dna_signals` + `dna_profiles` |
| `hot_take_votes` / `hot_take_passes` | 0 | Feature never shipped |
| `friend_cast_responses` | 0 | Unused |
| `post_votes` | 0 | Unused |
| `user_prediction_stats` | 0 | Unused |
| `pool_answers` | 0 | Unused |
| `user_blocks` | 0 | Unused |
| `prediction_comments` | 0 | Unused |
| `daily_challenge_responses` | 0 | Unused |
| `user_media` / `user_media_items` | 0 | Unused |
| `celebrity_dna` | 0 | Unused |
| `media_tag_links` / `media_tags` | 0 | Unused |
| `user_profiles` | 0 | Unused |

---

## Core Tables — Full Column Reference

### `users` (191 rows)
Primary user table. Real users + 20 AI personas.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key — this is the `anon_id` in all exports |
| `email` | text | |
| `user_name` | text | **NOT `username`** — must use `user_name` in queries |
| `display_name` | text | |
| `password` | text | |
| `avatar` | text | |
| `bio` | text | |
| `is_admin` | boolean | |
| `is_persona` | boolean | True for 20 AI bot accounts |
| `persona_config` | jsonb | Persona settings |
| `first_name` / `last_name` | text | |
| `computed_favorite_media_types` | jsonb | |
| `computed_favorite_genres` | jsonb | |
| `created_at` | timestamptz | |

**Filter real users:** `WHERE is_persona IS NULL OR is_persona = false`

---

### `prediction_pools` (343 rows)
Every question in the app — trivia, polls, predictions, Daily Call, Today's Play.

| Column | Type | Notes |
|---|---|---|
| `id` | text | Primary key |
| `title` | text | The question text |
| `type` | text | `trivia` / `poll` / `predict` |
| `status` | text | `open` / `closed` / `resolved` |
| `options` | jsonb | Array of answer choices |
| `correct_answer` | text | Only populated for trivia |
| `featured_date` | date | **Set = Today's Play question for that day. NULL = not a daily featured** |
| `category` | text | TV / Movies / Books / Music / Pop Culture |
| `show_tag` | text | Specific show/franchise name |
| `media_tags` | array | |
| `media_type` | text | tv / movie / book / music |
| `media_external_id` | text | TMDB / Spotify / Open Library ID |
| `media_external_source` | varchar | tmdb / spotify / openlibrary |
| `origin_type` | text | `consumed` (platform content) / `user` (UGC) |
| `partner_tag` | text | Room scoping for partner content |
| `difficulty` | text | easy / medium / hard |
| `points_reward` | integer | Usually 10 |
| `participants` | integer | Response count |
| `inline` | boolean | Shows inline in feed |
| `publish_at` | timestamptz | Scheduled publish time |
| `resolved_at` | timestamptz | When resolved |
| `created_at` | timestamptz | |

**Today's Play query:** `WHERE featured_date IS NOT NULL ORDER BY featured_date DESC`

---

### `user_predictions` (820 rows)
Every answer every user has ever given — trivia, polls, predictions, Daily Call.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK → `users.id` |
| `pool_id` | text | FK → `prediction_pools.id` |
| `prediction` | text | The exact option they chose |
| `points_earned` | integer | 10 = correct (trivia) / 0 = wrong / 20 = prediction points |
| `is_winner` | boolean | |
| `created_at` | timestamptz | |

**Key fact:** This is the single source of truth for deduplication (users never see a question twice), leaderboards, and DNA signal building.

**Today's Play responses query:**
```sql
SELECT up.*, pp.title, pp.type, pp.featured_date, pp.show_tag, pp.category
FROM user_predictions up
JOIN prediction_pools pp ON up.pool_id = pp.id
WHERE pp.featured_date IS NOT NULL
ORDER BY pp.featured_date DESC;
```

---

### `dna_profiles` (50 rows)
AI-generated personality profiles for users who have completed enough activity.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK → `users.id` |
| `label` | text | **DNA archetype name** e.g. "Chronicle-Driven Connector" |
| `tagline` | text | One-liner description |
| `flavor_notes` | array | Personality descriptors |
| `favorite_genres` | array | e.g. ["Action", "Drama", "Comedy"] |
| `favorite_media_types` | array | |
| `profile_text` | text | Full AI-generated profile text |
| `is_private` | boolean | |
| `created_at` / `updated_at` | timestamptz | |

**50 of 191 users have DNA profiles.** Others haven't completed enough activity to generate one.

---

### `user_dna_signals` (2,394 rows)
Aggregated behavioral signals per user. The engine behind DNA profiles and recommendations.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK → `users.id` |
| `signal_type` | varchar | `media_type` / `genre` / `creator` / `show` / `engagement` |
| `signal_value` | varchar | e.g. "tv", "Drama", "Breaking Bad", "trivia_attempts" |
| `strength` | numeric | 0–1 score |
| `source_count` | integer | Raw event count |
| `sources` | jsonb | `{tracked: N, rated: N, rated_high: N, trivia_correct: N, ...}` |
| `last_signal_at` | timestamp | |
| `updated_at` | timestamp | |

**Signal types in use:**
- `media_type` → tv / movie / book / music / podcast / game
- `genre` → TMDB genre names
- `creator` → creator names
- `show` → specific show/franchise
- `engagement` → trivia_attempts / trivia_correct / poll_votes / ratings_given / items_tracked / dna_moments

---

### `user_points` (31 rows)
Running lifetime point totals per user.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | |
| `reviews_written` | integer | |
| `ratings_given` | integer | |
| `books_read` | integer | |
| `tv_shows_watched` | integer | |
| `movies_watched` | integer | |
| `predictions_right` | integer | |
| `trivia_points` | integer | Lifetime trivia points — use `increment_trivia_points()` to update |
| `login_streak` | integer | |
| `app_engagement` | integer | |
| `all_time` | integer | Auto-calculated by trigger |
| `joined_app` | integer | |

**⚠️ NO `total_points` column.** The `increment_user_points` RPC references `total_points` which doesn't exist — it silently fails. Use `increment_trivia_points` for trivia only.

---

### `list_items` (2,289 rows)
Every piece of media tracked by every user.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `list_id` | uuid | FK → `lists.id` |
| `user_id` | uuid | FK → `users.id` |
| `title` | text | |
| `type` | text | media type |
| `creator` | text | |
| `image_url` | text | |
| `external_id` | text | TMDB/Spotify/etc ID |
| `external_source` | text | tmdb / spotify / openlibrary |
| `progress` | integer | |
| `total` | integer | |
| `progress_mode` | varchar | percent / page / episode / track |
| `season_number` / `episode_number` | numeric | |
| `created_at` | timestamp | |

---

### `lists` (931 rows)
User lists (Watched, Want to Watch, DNF, Favorites, custom lists, ranks).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | |
| `title` | text | |
| `media_type` | text | |
| `is_private` / `is_public` | boolean | |
| `is_default` | boolean | One of the 5 system lists |
| `is_pinned` | boolean | |
| `origin_type` | text | `consumed` (platform) / `user` (UGC) |
| `visibility` | text | |
| `share_id` | text | |

---

### `media_ratings` (415 rows)
Star ratings per user per media item.

| Column | Type | Notes |
|---|---|---|
| `id` | integer | |
| `user_id` | uuid | |
| `media_external_id` | text | |
| `media_external_source` | text | |
| `media_title` | text | |
| `media_type` | text | |
| `rating` | numeric | 1–5 stars |
| `created_at` / `updated_at` | timestamp | |

---

### `social_posts` (796 rows)
All posts in the activity feed.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | |
| `content` | text | |
| `post_type` | text | rate-review / track / prediction / poll / cast_approved / game_moment / etc |
| `rating` | real | |
| `media_title` / `media_type` / `media_creator` | text | |
| `media_external_id` / `media_external_source` | text | |
| `origin_type` | text | `consumed` (platform/persona) / `user` |
| `room_id` | text | Set for room-scoped posts |
| `prediction_pool_id` | text | Links to a pool |
| `rank_id` | uuid | Links to a rank |
| `visibility` | text | |
| `contains_spoilers` | boolean | |
| `likes_count` / `comments_count` | integer | |

---

### `login_streaks` (25 rows)

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | PK |
| `last_login` | date | |
| `current_streak` | integer | |
| `longest_streak` | integer | |
| `play_completed_date` | text | |

---

### `trivia_poll_drafts` (187 rows)
Staging table for Today's Play Generator.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `content_type` | text | `trivia` / `poll` / `featured_play` |
| `title` | text | Question text |
| `options` | jsonb | Answer choices |
| `correct_answer` | text | |
| `category` | text | |
| `show_tag` | text | |
| `media_type` | text | |
| `status` | text | `draft` / `approved` / `published` / `rejected` |
| `featured_date` | text | Assigned publish date |
| `rejection_reason` | text | Fed back to AI on next generation |
| `media_external_id` / `media_external_source` | text | |
| `media_tags` | array | |

---

### `dna_moment_responses` (165 rows)
Quick binary questions answered in the feed that build DNA signals.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | |
| `moment_id` | uuid | FK → `dna_moments.id` |
| `answer` | text | |
| `points_earned` | integer | |
| `created_at` | timestamp | |

---

### `pools` (7 rows) — Rooms
Official and user-created rooms.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | text | |
| `host_id` | uuid | |
| `is_official` | boolean | Platform rooms vs user rooms |
| `room_category` | text | |
| `media_type` | text | |
| `series_tag` | text | |
| `pool_type` | text | |
| `status` | text | |

---

### `ranks` (28 rows) / `rank_items` (133 rows)
Ranked lists (user-created and platform "Debate the Rank" content).

| Column | Type | Notes |
|---|---|---|
| `ranks.origin_type` | text | `consumed` (platform) / `user` |
| `ranks.status` | text | `draft` / `scheduled` / `published` |
| `ranks.scheduled_date` | timestamptz | |
| `rank_items.position` | integer | |
| `rank_items.year` | text | |
| `rank_items.up_vote_count` / `down_vote_count` | integer | |

---

## Key Joins for Common Queries

### "Who answered Today's Play and what did they vote?"
```sql
SELECT
  pp.featured_date, pp.title, pp.type, pp.show_tag, pp.category,
  up.user_id AS anon_id, up.prediction, up.points_earned, up.created_at,
  dp.label AS dna_archetype, dp.favorite_genres
FROM user_predictions up
JOIN prediction_pools pp ON up.pool_id = pp.id
LEFT JOIN dna_profiles dp ON dp.user_id = up.user_id
LEFT JOIN users u ON u.id = up.user_id
WHERE pp.featured_date IS NOT NULL
  AND (u.is_persona IS NULL OR u.is_persona = false)
ORDER BY pp.featured_date DESC;
```

### "What are the aggregate results for a question?"
```sql
SELECT prediction, COUNT(*) as votes
FROM user_predictions
WHERE pool_id = 'THE_POOL_ID'
GROUP BY prediction
ORDER BY votes DESC;
```

### "What's a user's DNA signal strength by media type?"
```sql
SELECT signal_value, strength, source_count, sources
FROM user_dna_signals
WHERE user_id = 'USER_ID' AND signal_type = 'media_type'
ORDER BY strength DESC;
```

### "Trivia leaderboard"
```sql
SELECT up.user_id, SUM(up.points_earned) AS total_trivia_points
FROM user_predictions up
JOIN prediction_pools pp ON up.pool_id = pp.id
WHERE pp.type = 'trivia'
GROUP BY up.user_id
ORDER BY total_trivia_points DESC;
```

---

## Export Files & What They Pull From

| Export File | Tables Used | anon_id? |
|---|---|---|
| `consumed_master.csv` | `users`, `user_dna_signals`, `dna_profiles`, `list_items`, `media_ratings`, `user_predictions`, `prediction_pools`, `login_streaks`, `social_posts`, `dna_moment_responses` | ✅ `user_id` |
| `consumed_media_detail.csv` | `list_items`, `lists`, `media_ratings`, `users` | ✅ `user_id` |
| `consumed_poll_responses.csv` | `user_predictions`, `prediction_pools` (type=poll only) | ✅ `anon_id` |
| `consumed_todays_play_responses.csv` | `user_predictions`, `prediction_pools` (featured_date IS NOT NULL), `dna_profiles`, `users` | ✅ `anon_id` |
| `consumed_room_engagement.csv` | `pools`, `pool_members`, `room_takes`, `room_take_replies`, `room_take_votes`, `users` | ✅ `anon_id` |

All exports join on the same anonymous UUID. Drop them all into Google Sheets and `VLOOKUP` on `anon_id` to enrich any export with any other.

---

## Edge Functions (canonical — do not re-invent)

| Function | Purpose | Auth |
|---|---|---|
| `get-leaderboards?category=trivia&scope=global` | Trivia rank/percentile | Bearer session token |
| `get-user-stats?user_id={id}` | User stats (posts, predictions, streak, consumption) | Bearer session token |
| `social-feed` | Activity feed | Bearer session token |
| `extract-dna-signals` | Rebuild all DNA signals for a user from scratch | Service role or user JWT |
| `rebuild-recommendations` | Generate AI recommendations | Service role |
| `generate-trivia-polls` | Create/publish Today's Play questions | Bearer session token |
| `media-search` | Unified search (TMDB, Spotify, Open Library, YouTube) | Bearer session token |

---

*Last updated: May 2026. Re-run the row count query to refresh numbers.*
