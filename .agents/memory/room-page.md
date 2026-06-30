---
name: Room page architecture
description: How rooms are modeled and which page renders them; the single-template decision and the real % match definition.
---

# Rooms = one template for ALL rooms

- A "room" is a `pools` row. Genre/topic is identified by `pools.room_category` ('genre'|'media'|'platform') + `series_tag` (e.g. True Crime: room_category='genre', series_tag='true-crime').
- `/room/:id` renders `client/src/pages/new-room.tsx` (`NewRoom`). The older `pool-detail.tsx` is **retired from routing but kept on disk** as a reference for patterns (vote/composer/notify). Don't delete it without asking.

**Why:** Product decision — ONE room template for every room, no media-specific room variants. New page replaced the old live room.

**How to apply:** When editing room behavior, edit `new-room.tsx`. Reuse existing tables only: discussions = `room_takes` (+`room_take_replies`, `room_take_votes`, `room_follows`). Room load = `get-pool-details` edge fn (GET `?pool_id=`).

## Conventions decided here
- All rooms are **public** — no public/private indicator in the room UI.
- Conversation tag is **optional**. Stored values: Take→'take', Theory→'theory', Question→'question', untagged→null. Legacy 'discussion'/'debate'/'hot_take' map to: hot_take→Take pill, others→no pill. (`room_takes.tag` was made nullable.)
- In-room tracking writes to `user_activity` (`action_type` room_enter/room_post/room_reply/room_vote/room_follow/room_unfollow, `target_type='room'`, `target_id`=room id, `metadata` jsonb). RLS allows an authed user to insert their own rows.

## Real % match (no fabrication)
- Derived from `user_dna_signals` rows where `signal_type='genre'`.
- match% = (user's strongest genre strength whose `signal_value` token-overlaps the room name/series_tag) ÷ (user's overall max genre strength) × 100, capped 100.
- Hidden entirely when the user has no genre signals or none overlap — never show a guessed number.
- **Why:** the old design's "92% Match" was fabricated; the no-fake-data rule forbids it.

## Explore tab
- "Popular Titles" has **no stored genre→media taxonomy** (`media_items` has no genre; `media_tags` are personal). It is populated live from the `media-search` edge fn (GET `?q=<room name>&limit=`), tapping → `/media/:type/:source/:external_id`.
- Play tab is still a static placeholder (trivia/vote cards) — next wiring pass.

## Genre rooms have pool_type = NULL (visibility gotcha)
- Genre rooms (room_category='genre', e.g. "True Crime" eb529882-...) were created with `pool_type = NULL`, unlike media/platform rooms which have `pool_type='room'`.
- `get-user-pools` originally filtered strictly on `pool_type='room'`, so genre rooms NEVER appeared in My Rooms or Discover. Fix: also accept `room_category='genre'` in both membership mapping and the public-rooms `.or('pool_type.eq.room,room_category.eq.genre')` query (incl. the base/fallback path; BASE_POOL_SELECT now carries room_category).
- **Rooms list now shows ONLY genre rooms** (`pools.tsx` filters `room_category==='genre'`) — media/platform rooms (Emma M. Lion, Paradise, Reelz) intentionally hidden "for now" per user. To re-show them, remove that filter.
- **Why:** user wanted only the accurate genre room visible; media/platform rooms are stale.
