---
name: Baseline template polls (media pages & rooms)
description: How every media detail page and room Play tab gets guaranteed polls, and the partner_tag scoping rules that keep them from leaking between surfaces.
---

# Baseline template polls

Two template tables in Supabase hold fill-in-the-blank poll questions:
- `media_poll_templates` — `{title}` placeholder, title-specific opinion polls.
- `room_poll_templates` — `{room}` placeholder, genre/community-flavored polls.

Edge fns `ensure-media-polls` / `ensure-room-polls` stamp 3 templates as real
`prediction_pools` rows (type=vote, origin_type=consumed) the first time a Play
tab loads. Deterministic hash of the title/room key picks which 3, so each page
gets a consistent but varied mix. The ensure call happens inside the client
queryFn (polls-carousel mediaFilter branch; room-play queryFn) before querying.

**play_context scoping rules (the important part):**
- Media baselines get `play_context='media'` → excluded from feed carousels
  (which filter `play_context IS NULL` and `partner_tag IS NULL`) AND explicitly skipped by room-play's
  tagMatch + genre-match layers. Without this, rooms pull in title polls via
  genre matching (Odyssey polls appeared in Action & Thriller — user complaint).
- Room baselines get `play_context=<normalized room key>` → room-only; feed
  excludes them, room tagMatch picks them up via roomName.includes(ctx).

**Why:** Heidi wants every Play tab non-empty, but title polls must never show
in rooms and room polls must never show in the feed.

**How to apply:** any new poll-creation path must decide its play_context
deliberately; the media detail Play tab reuses the feed's PollsCarousel
(mediaFilter prop) so results UI stays identical — don't build a separate
results renderer. Templates are editable table rows; no code change to reword.
Media page tabs are Takes/Play/Explore (room-style tab bar); Explore holds the
"You Might Also Like" section moved out of Takes.

Note: play content uses the dedicated `play_context` column (user request);
`partner_tag` is reserved for real partner content. Unique partial index
(play_context,title) on consumed vote pools prevents duplicate stamping races.
prediction_pools has NO default id — every insert needs crypto.randomUUID().
