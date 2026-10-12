---
name: YouTube media type
description: YouTube is a first-class media type (channels + videos), no longer lumped with TV
---
- media_type `youtube`, distinguished by `media_subtype`: `'channel'` vs `'video'` (produced by media-search and get-media-details, persisted in `list_items.media_subtype` — column added July 2026).
- Channel vs video ID: channel IDs match `/^UC[\w-]{22}$/`; get-media-details uses this to pick the channels vs videos endpoint (falls back to video lookup if channel lookup fails).
- Adding a YouTube channel to a list ALSO auto-follows it in `followed_creators` (role `YouTuber`) — fire-and-forget from quick-add-list-sheet, keyed on the UC-id regex.
- Never map youtube source → 'tv' in client type resolution (feed.tsx used to; fixed). TMDB poster fallback in add-media-to-list must skip youtube.
- **Why:** YouTube taste (creators followed) is a distinct DNA signal; lumping it with TV polluted both. Channel = followable parent, video = atomic unit — this is the template for future TV seasons/episodes work.

Leave YouTube out of Trending Now and trending content for this version.

**Why:** The user decided to skip it after discussing limited official chart coverage, unverified third-party ranking methodology, and content-safety concerns.

**How to apply:** Do not add YouTube trending unless the user changes this decision. This does not remove existing YouTube search or tracking.
