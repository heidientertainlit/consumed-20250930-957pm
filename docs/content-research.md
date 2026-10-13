# Admin Content Research

`/admin/content-research` is an in-memory editorial workspace. It does not store
research history, read personal DNA/consumption, or write recommendations,
posts, or schedules.

## Backend prerequisites

The `admin-content-research` Edge Function and
`20261013120000_admin_content_research_limits.sql` must both be present in the
same Supabase project as the app. The function fails closed if the limiter is
unavailable. No remote schema changes are made by the local test suite.

The function uses existing Supabase auth and catalog/trending endpoints plus
`OPENAI_API_KEY`; `TMDB_API_KEY` optionally enriches missing film/TV creators.
Do not substitute the workspace service credential for a signed-in admin.
Service-role callers and persona accounts cannot use this operation.

Limits are atomic, per admin and action, per UTC clock hour: 10 generations,
60 searches, 20 chart loads. Counters contain no research content. A failed
provider request still counts. Cancellation invalidates browser responses and
aborts outgoing requests where supported; it cannot refund an already accepted
provider/model call. Generation allows at most 14 candidates, in groups of 3.

## Trust boundaries

- Catalog identity is not evidence that two works have an official relationship.
- This version only exports editorial similarity. Official relationships are
  excluded rather than promoted from AI claims or unverified URLs.
- Title, type, available creator/year, provider ID and subtype are checked;
  ambiguous matches, AI fallback identities, duplicates and the seed are excluded.
- Edits apply only to subjective rationale, never provider facts or badges.
  Suspected factual-relationship phrases block that pick from export. This
  conservative lexical check is not a general-purpose fact-checker; admins
  remain responsible for reviewing their editorial prose.
- Chart provenance is reloaded server-side, never accepted as factual client
  metadata. Chart state describes the seed, not the recommendations.
- NYT books currently carry ISBNs labeled as Open Library identities. These are
  not Open Library work IDs and are explicitly excluded from chart selection
  with title/source/country/date/status feedback. Admins can select those books
  through catalog search instead, without claiming chart provenance.
- Existing media-search may maintain its shared catalog identity cache. That
  is separate from personal data and recommendation caches.

## Verification

Focused fixtures:

```
npx tsx --test supabase/functions/_shared/content-research.test.ts client/src/lib/content-research.test.ts supabase/functions/_shared/authorization.test.ts client/src/components/media-search-panel.test.ts client/src/components/trending-selection.test.ts
```

These execute the local research handler and the existing downstream media-search
handler with provider fixtures. They do not prove live provider availability,
deployed authorization, or the applied SQL limiter.

Optional live provider check, with configured credentials:

```
npx tsx scripts/check-content-research-live.ts --live
```

This incurs one editorial model call and exercises The White Lotus across all
seven requested types through the local engine and live catalog APIs. Missing
coverage is reported without filler. It does not impersonate an admin or test
the deployed admin function's authorization/rate-limit database.
