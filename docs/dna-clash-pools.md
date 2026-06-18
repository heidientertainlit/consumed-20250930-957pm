# Consumed — DNA Clash Pools

> Moved out of `replit.md` to keep it lean. This is a hard rule, not a guideline.
>
> **RULE**: Never guess about schema or data. Query the hosted Supabase project first via the Management API (see `replit.md` → "Database — CRITICAL").

---

## ⚠️ DNA Clash pools — REAL RATINGS ONLY, NO EXCEPTIONS

`prediction_pools` rows with `type='clash'` MUST use ratings that are verified to exist in `media_ratings`. Before creating or updating any clash pool:

1. Query `media_ratings` to confirm both users have actually rated the media title.
2. Confirm the rating values match exactly what is in `media_ratings`.

- NEVER manually type in a star rating.
- NEVER invent a quote, DNA label, or display name.
- DNA labels come from `dna_profiles.label`.
- Display names come from `users.display_name`.
- The `options` JSON must store `posterUrl` on the first option object (no `poster_url` column exists on `prediction_pools`). The feed card reads `o1.posterUrl || o2.posterUrl`.
- There is NO hardcoded fallback array in `feed.tsx` — if `clashPools` is empty the card simply doesn't render.
