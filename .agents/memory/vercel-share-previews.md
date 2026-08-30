---
name: Vercel share previews
description: How production share links deliver crawler-visible metadata despite the static SPA deployment.
---

Production at the custom app domain is served as a static Vercel SPA. React metadata and Express-only Open Graph routes do not reach link-preview crawlers unless Vercel explicitly rewrites crawler requests to the serverless OG handler.

**Why:** The static catch-all returned only the generic app shell, so Messages displayed the hostname and “consumed” even though contextual Open Graph resolution existed in the Express server.

**How to apply:** Keep crawler rewrites ahead of the static index fallback, preserve a branded 1200×630 fallback image in the initial HTML, and verify with a crawler user agent against the actual production host after Vercel deploys.

Invite actions should share `/invite/:userId`, not `/u/:userId`; profile URLs are for viewing a profile, while invite URLs carry action-oriented invitation metadata.