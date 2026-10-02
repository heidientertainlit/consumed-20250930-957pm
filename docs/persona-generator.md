# Persona generator changes

## Scope and safety

The planner chooses verified media, an internal writing mode and an optional five-star
rating before asking the model to write. Modes describe behavior, not reusable text.
Public posts still use the existing `review` type. Approval, scheduling and publishing
functions are unchanged; generation does not approve or publish anything.

The admin preview uses a capability check and a distinct request shape:

```json
{
  "action": "dry-run",
  "previewPersonaIds": ["persona-uuid"],
  "previewPostsPerPersona": 2,
  "useTrending": true
}
```

The old handler receives no `personaIds` and rejects this request instead of ignoring
a new preview flag and saving drafts. The new handler authorizes all actions before
accessing data. Preview only reads Supabase data and read-only provider APIs; it does
not insert, update, schedule or publish records. Regular generation still saves drafts.

## Files

| File | Change |
| --- | --- |
| `supabase/functions/generate-persona-content/index.ts` | Authorized settings/voice/preview actions, bounded history reads, orchestration and draft-only persistence |
| `supabase/functions/_shared/persona-generation.ts` | Modes, default weights, voice derivation, weighted planning, prompts, authoritative rating substitutions, validation and admin metadata |
| `supabase/functions/_shared/persona-media-candidates.ts` | AI title suggestions followed by read-only provider verification; persona fit and optional trending candidates |
| `supabase/functions/_shared/persona-generation-engine.ts` | Shuffled round-robin batch writing with media/mode/phrase awareness and a validation repair attempt |
| `client/src/pages/admin-personas.tsx` | Integrates controls/debug notes and displays partial generation errors; keeps existing review workflow |
| `client/src/components/admin/persona-generation-controls.tsx` | Global weights, individual voice settings and protected non-persisting previews |
| `client/src/components/admin/draft-generation-metadata.tsx` | Admin-only mode/source/recent-use/voice metadata, with legacy notes preserved |
| `supabase/functions/_shared/persona-generation.test.ts` | Planner, rating, source-size, mode-shape and validation tests |
| `supabase/functions/_shared/persona-generation-endpoint.test.ts` | Actual handler tests with isolated adapters: authorization, zero-write preview, draft-only generation and config preservation |
| `scripts/test-persona-generator-dry-run.ts` | Local sample runner using fictional checked-in persona definitions, the real writing API and read-only providers |
| `reports/persona-generator-test-batch.html` | Readable full review batch, including persona, media, mode, rating, content and metadata |
| `reports/persona-generator-test-batch.json` | Structured review batch and generation errors |

## Schema and configuration

**No schema migration, new table, new column or new secret is required.**

- Global mode weights are stored in the existing `app_settings` row with
  `key = persona_generation_mode_weights` and a JSON-encoded string `value`.
  If the row is absent, defaults are used. The row is only written on an explicit
  admin save.
- Individual overrides are stored in `users.persona_config.social_voice`.
  Saving voice settings preserves the other existing configuration fields. Without
  an override, voice tendencies are derived from the existing identity and examples.
- Admin generation metadata is JSON inside the existing `persona_post_drafts.ai_notes`.
  The unchanged approval function does not copy this field into public posts.
- Existing `OPENAI_API_KEY`, `TMDB_API_KEY`, `GOOGLE_BOOKS_API_KEY` and `RAWG_API_KEY`
  are used where configured. No values were changed. iTunes/Open Library GET lookups
  supply additional music/podcast/book candidates.

Default relative weights:

| Mode | Weight |
| --- | ---: |
| Thoughtful reaction | 30 |
| Micro reaction | 10 |
| Casual thought | 15 |
| Rating + quick thought | 10 |
| Conversation starter | 10 |
| Specific reaction | 8 |
| Hot take / opinion | 8 |
| Low-energy reaction | 9 |

These are probabilities, not fixed quotas. Voice preferences and recent batch shapes
modify them. Media sources are balanced by candidate count so a large trending pool
does not outweigh stronger favorites solely by size. Recent titles receive soft
penalties, not absolute bans.

## History and failure behavior

The handler reads up to 500 pending drafts, 500 unposted scheduled posts and 500 persona
publications within the previous 30 days, across up to 200 persona accounts. Repeated
representations of the same persona/title/type are merged. Recent rejected-draft feedback
continues to inform writing. History-query failure stops generation rather than pretending
the history is empty.

Candidate preparation is bounded to four simultaneous jobs. Writing sees each prior
completed post. A writing-time budget returns partial results and explicit errors rather
than silently claiming the requested count was met. The model may repair invalid content
once; a repeated validation failure is reported, not persisted.

Provider verification excludes known unreleased TMDB entries and derivative summary/
study-guide book editions. Detailed episode/season references require supplied evidence.
This reduces unsupported specifics; manual review remains necessary.

## Verification and samples

```sh
npm run check
node --import tsx --test supabase/functions/_shared/persona-generation*.test.ts
npm run build
node --import tsx scripts/test-persona-generator-dry-run.ts
```

The delivered report contains 20 actual AI-written posts across 10 fictional personas.
It uses checked-in configurations, not live voice overrides or live posting history.
Its requests performed no Supabase writes. Reports are saved only as local review files.

The signed-in live admin UI was not verified: the preview browser correctly returned
the sign-in screen. The function has not been deployed and production configuration/data
has not been changed. Settings and preview controls remain unavailable against the old
function until the updated function is deployed.