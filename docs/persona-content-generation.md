# Persona Bot Content Generation Guide

## Overview

This guide helps you generate monthly content batches for persona accounts using ChatGPT. The generated content will be uploaded to the `scheduled_persona_posts` table and automatically posted by the scheduler.

---

## Step 1: Create Persona Accounts

First, create user accounts in your database for each persona. Note their `user_id` values.

```sql
-- Example: Create a persona account
INSERT INTO users (id, user_name, email, is_persona, persona_config)
VALUES (
  gen_random_uuid(),
  'CinephileSarah',
  'persona_sarah@consumed.app',
  true,
  '{"bio": "Film school dropout. Horror obsessed. Will fight you about A24.", "interests": ["horror", "indie", "A24"], "tone": "snarky but knowledgeable"}'
);
```

---

## Step 2: ChatGPT Prompt Template

Use this prompt in ChatGPT to generate a month's worth of content for each persona:

---

### PROMPT START

I need you to generate social media posts for a persona bot on an entertainment tracking app called "Consumed". The posts should feel authentic, opinionated, and engaging.

**Persona Profile:**
- Name: [PERSONA_NAME]
- Bio: [PERSONA_BIO]
- Interests: [INTERESTS]
- Tone: [TONE - e.g., "snarky but knowledgeable", "wholesome enthusiast", "controversial take machine"]
- Favorite shows/movies: [LIST]
- Topics to avoid: [ANY SENSITIVE TOPICS]

**Post Types to Generate:**
1. **rate_review** - Rating and brief review of media (include rating 1-5)
2. **hot_take** - Bold, debatable entertainment opinion
3. **update** - General entertainment thoughts/reactions

**Output Format (CSV with these exact columns):**
```
post_type,content,rating,media_title,media_type,media_external_id,media_external_source,scheduled_for
```

**Rules:**
- Generate 60-90 posts (2-3 per day for a month)
- Spread scheduled_for dates across the month (use random hours between 8am-11pm)
- Rating should only be included for rate_review posts (1-5 scale)
- media_type: movie, tv, book, podcast, or music
- media_external_source: tmdb (for movies/tv), spotify (for music/podcasts), openlibrary (for books)
- media_external_id: Leave blank unless you know the exact ID
- Keep posts under 280 characters
- Mix post types: ~40% rate_review, ~30% hot_take, ~30% update
- Be opinionated, not generic
- Reference specific shows/movies/books by name
- Occasionally reference trending or new releases

**Example Output:**
```csv
post_type,content,rating,media_title,media_type,media_external_id,media_external_source,scheduled_for
rate_review,Finally watched The Substance. Demi Moore absolutely unhinged. Horror fans eating GOOD this year.,4.5,The Substance,movie,,tmdb,2025-02-01T14:30:00Z
hot_take,Unpopular opinion: The Bear season 3 was better than season 2. Fight me in the comments.,,The Bear,tv,,tmdb,2025-02-02T19:15:00Z
update,Three episodes into Severance S2 and I've already forgotten what sunlight looks like,,,,,2025-02-03T21:00:00Z
rate_review,Fourth Wing finally clicked for me on chapter 12. Now I get the hype.,4,Fourth Wing,book,,openlibrary,2025-02-04T10:45:00Z
```

Generate content for the month of [MONTH YEAR], starting from [START_DATE].

### PROMPT END

---

## Step 3: Upload to Database

After ChatGPT generates the CSV:

1. Copy the CSV output
2. Open Supabase Dashboard → Table Editor → `scheduled_persona_posts`
3. Click "Insert" → "Import from CSV"
4. Add the `persona_user_id` column with the correct user ID
5. Import

Or use this SQL template:

```sql
INSERT INTO scheduled_persona_posts 
(persona_user_id, post_type, content, rating, media_title, media_type, media_external_id, media_external_source, scheduled_for)
VALUES
('YOUR_PERSONA_USER_ID', 'rate_review', 'Finally watched The Substance...', 4.5, 'The Substance', 'movie', '', 'tmdb', '2025-02-01T14:30:00Z'),
-- ... more rows
;
```

---

## Step 4: Run the Scheduler

The `post-scheduled-content` edge function checks for due posts and publishes them. 

**Manual trigger:**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/post-scheduled-content \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**For automatic scheduling:** Set up a cron job (pg_cron or external) to call this function every 15-30 minutes.

---

## Tips for Authentic Content

1. **Vary posting frequency** - Some days 1 post, some days 4
2. **Reference current events** - New releases, award shows, viral moments
3. **Create mini-arcs** - "Started watching X" → "3 episodes in" → "Finished X, here's my take"
4. **React to each other** - If you have multiple personas, occasionally reference what another said
5. **Seasonal content** - Halloween horror recommendations, summer blockbuster takes, etc.

---

## Persona Archetypes to Consider

| Persona | Tone | Interests |
|---------|------|-----------|
| The Film Snob | Pretentious but self-aware | Arthouse, directors, cinematography |
| The Binge Queen | Enthusiastic, loves drama | Reality TV, true crime, dating shows |
| The Horror Head | Dark humor, encyclopedic | Horror across all decades |
| The Podcast Addict | Chatty, recommendation-heavy | True crime, comedy, interview pods |
| The Book Worm | Thoughtful, literary | Fantasy, literary fiction, romance |
| The Music Nerd | Passionate, genre-fluid | Album drops, live music, deep cuts |

---

## Monitoring

Check what's scheduled:
```sql
SELECT * FROM scheduled_persona_posts 
WHERE posted = false 
ORDER BY scheduled_for 
LIMIT 20;
```

Check what's been posted:
```sql
SELECT spp.*, sp.created_at as actual_post_time
FROM scheduled_persona_posts spp
JOIN social_posts sp ON spp.resulting_post_id = sp.id
WHERE spp.posted = true
ORDER BY spp.posted_at DESC
LIMIT 20;
```
