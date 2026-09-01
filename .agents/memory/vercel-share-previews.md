---
name: Vercel share previews
description: How production share links deliver crawler-visible metadata despite the static SPA deployment.
---

Production at the custom app domain is served as a static Vercel SPA. React metadata and Express-only Open Graph routes do not reach link-preview crawlers unless Vercel explicitly rewrites shareable routes to the serverless OG handler.

**Why:** The static catch-all returned only the generic app shell, so Messages displayed the hostname and “consumed” even though contextual Open Graph resolution existed in the Express server.

**How to apply:** Route known shareable paths through the OG handler for every user agent rather than trying to identify crawlers. Bundle the built app shell with the handler so human taps still load the SPA. Keep these rewrites ahead of the static fallback, preserve a branded 1200×630 image, and verify against production after Vercel deploys.

Never call an Open Graph change fixed after checking only the development server. Verify the custom production domain returns the intended metadata, then download its referenced image and compare it with the intended asset. If an image URL cannot change, version the shared page URL so preview clients do not reuse the old page cache.

**Why:** The development crawler response showed the new asset while Vercel still served the old image containing a second CTA.

**How to apply:** Test both the final share URL and its `og:image` on the production domain after the Vercel build completes. A local build or `.replit.dev` response is not production evidence.

Replacing an existing static Open Graph image can make the preview artwork look new while the page metadata and serverless handler remain on an older Vercel deployment. Test the direct `/api/og/...` URL: if it returns `index.html`, the function/rewrite is not active in production.

**Why:** A narrow image replacement updated the visible preview, but production continued returning generic homepage metadata for every share route.

**How to apply:** Treat artwork bytes, crawler metadata, and the direct serverless route as three separate production checks.

For this Vite/static-SPA deployment, use one explicit `api/og.ts` function and pass public share paths through a rewrite query parameter. Do not rely on a nested catch-all function filename. Imports from the function into project TypeScript must use the emitted `.js` extension under Node ESM.

**Why:** The nested catch-all was omitted from production routing; after switching to an explicit function, Vercel compiled it to ESM but an extensionless project import crashed at invocation with `ERR_MODULE_NOT_FOUND`.

**How to apply:** Validate the direct function separately. Static HTML means discovery/routing failed; `FUNCTION_INVOCATION_FAILED` requires runtime logs. Confirm the compiled function locally and production after each Vercel deployment.

Invite actions should share `/invite/:userId`, not `/u/:userId`; profile URLs are for viewing a profile, while invite URLs carry action-oriented invitation metadata.

Private Compare shares use `/edna/:userId?compare=1`: metadata invites the recipient to compare with the sender, but never exposes the existing friend, score, or pairwise result publicly. Keep the preview title action-specific and the description a single direct CTA; do not repeat generic app marketing in both.