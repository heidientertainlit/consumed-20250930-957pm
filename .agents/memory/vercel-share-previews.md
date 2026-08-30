---
name: Vercel share previews
description: How production share links deliver crawler-visible metadata despite the static SPA deployment.
---

Production at the custom app domain is served as a static Vercel SPA. React metadata and Express-only Open Graph routes do not reach link-preview crawlers unless Vercel explicitly rewrites shareable routes to the serverless OG handler.

**Why:** The static catch-all returned only the generic app shell, so Messages displayed the hostname and “consumed” even though contextual Open Graph resolution existed in the Express server.

**How to apply:** Route known shareable paths through the OG handler for every user agent rather than trying to identify crawlers. Bundle the built app shell with the handler so human taps still load the SPA. Keep these rewrites ahead of the static fallback, preserve a branded 1200×630 image, and verify against production after Vercel deploys.

Invite actions should share `/invite/:userId`, not `/u/:userId`; profile URLs are for viewing a profile, while invite URLs carry action-oriented invitation metadata.