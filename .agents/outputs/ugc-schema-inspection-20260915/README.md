# Live UGC schema inspection (read-only)

Inspection timestamp: 2026-09-15T03:29:24Z  
Supabase project: `mahpgcogwpawvviapqza`  
Access path: Supabase Management API database-query endpoint, using the existing management access token from bash. The token was never printed or saved.

## Scope and method

- Metadata-only SQL queries against `pg_class`, `information_schema.columns`, `pg_policies`, `pg_constraint`, `information_schema.triggers`, `pg_proc`, function ACLs, and public view definitions.
- No application rows, accounts, content, report records, or personal data were selected.
- No writes, DDL, migrations, deployments, workflow runs, or local database queries were performed.
- The JSON files in this directory are metadata snapshots only. Function bodies were intentionally not saved.

The live public schema returned 157 relations (including 5 views), 1,480 public columns, 282 policies, 503 constraints, 59 triggers, and 93 public functions.

## UGC table inventory

The following 69 live tables were treated as UGC or user-authored engagement surfaces for this inspection:

**Social/moderation:** `social_posts`, `social_post_comments`, `social_post_likes`, `social_comment_likes`, `social_comment_votes`, `post_reactions`, `post_votes`, `reviews`, `ratings`, `media_ratings`, `content_reports`, `user_blocks`.

**Lists/ranks/collections:** `lists`, `list_items`, `list_collaborators`, `user_lists`, `user_media`, `user_media_items`, `user_highlights`, `ranks`, `rank_items`, `rank_comments`, `rank_item_votes`, `strands`, `strand_media`, `strand_comments`, `strand_likes`.

**Rooms/games/social actions:** `room_takes`, `room_take_replies`, `room_take_votes`, `room_follows`, `room_requests`, `prediction_comments`, `prediction_comment_likes`, `prediction_comment_votes`, `prediction_likes`, `predictions`, `prediction_pools`, `polls`, `poll_responses`, `hot_take_passes`, `hot_take_votes`, `bets`, `binge_battles`, `friend_casts`, `friend_cast_responses`, `followed_creators`.

**User activity and responses:** `user_activity`, `media_engagements`, `media_goals`, `media_history_log`, `media_import_batches`, `media_import_rows`, `media_progress_events`, `media_ratings`, `media_statuses`, `rec_requests`, `seen_it_sets`, `seen_it_items`, `seen_it_responses`, `seen_it_completions`, `daily_challenge_responses`, `dna_moment_responses`, `edna_responses`, `user_predictions`, `user_private_details`, `user_profiles`, `user_recommendations`, `user_reputation_titles`.

All 69 have RLS enabled and `FORCE ROW LEVEL SECURITY` disabled. The exact live columns (including nullability and defaults) are in `ugc-columns-summary.txt` and `columns.json`.

## Verified block schema

`user_blocks`:

- Columns: `id uuid`, `blocker_id uuid`, `blocked_id uuid`, `created_at timestamptz`.
- Primary key: `id`; unique key: `(blocker_id, blocked_id)`.
- No foreign-key constraints were present on either user ID.
- RLS is enabled; no force-RLS.
- Exactly one live policy: `user_blocks_authenticated_owner_select`, `SELECT TO authenticated USING (blocker_id = auth.uid())`.
- No direct INSERT/UPDATE/DELETE policy is present. The intended write path is the service-backed `block-user` function.
- `remove_friendships_on_user_block` is a `SECURITY DEFINER` `BEFORE INSERT` trigger. It rejects self-blocks, takes a pair advisory transaction lock, and deletes both friendship directions. Its live ACL allows `service_role` only among the inspected roles.

This owner-only policy is sufficient for a caller to hydrate blocks they created, but it cannot expose blocks created by the other account. Any server-side UGC filter that must enforce either-direction blocking must use an authorized service path and fail closed on a block lookup error. Direct public UGC policies do not themselves consult `user_blocks`.

## Verified report schema

`content_reports`:

- Columns: `id uuid`, `reporter_id uuid`, `content_type text`, `content_id text`, `reason text`, `description text`, `reported_user_id uuid`, `status text`, `created_at timestamptz`.
- RLS is enabled with zero policies. The table has role grants, but RLS therefore denies anon/authenticated table reads and writes; service-role access is the intended path.
- Checks: `content_type` is limited to `post`, `comment`, `hot_take`, `list`, `review`; `reason` is limited to the seven moderation reasons; status is limited to `pending`, `reviewed`, `resolved`, `dismissed`.
- No foreign keys were present for reporter, reported user, or content ID.
- There is no `updated_at` column.

The local `report-content` function accepts `content_type = "user"`, which the live check constraint rejects. The local moderation queue also expects `content_reports_reporter_id_fkey`, `profiles.id`, `profiles.is_admin`, `profiles.auth_id`, `comments`, and `hot_takes`; those constraints/columns/tables were not present in the live schema. The local moderation action path writes `moderation_actions` and `user_moderation_status`; neither live table exists. This is a verified local/live mismatch, not a deployment claim.

## Verified social UGC policy shape

- `social_posts`: public/own SELECT (`visibility = 'public' OR auth.uid() = user_id`); own INSERT/UPDATE/DELETE.
- `social_post_comments` and `social_post_likes`: public SELECT; own-row management.
- `social_comment_likes`: public SELECT; own INSERT/DELETE.
- `social_comment_votes`: public SELECT; own INSERT/UPDATE/DELETE.
- `reviews`, `ratings`, and `media_ratings`: public SELECT; own-row management.
- `lists` and `list_items` include public-read policies; list item reads also include public-list and accepted-friend paths. Writes are mostly owner-scoped.
- `room_take_replies` and `room_take_votes` have `TO authenticated USING (true) WITH CHECK (true)` for ALL operations.
- `room_takes` has an authenticated UPDATE policy with `USING (true)`.
- `rank_comments` has a public INSERT policy with `USING (true)`.
- `strand_media` has public SELECT and authenticated-write `ALL` with only `auth.uid() IS NOT NULL`.

Therefore, RLS currently protects many owner writes but is not a block-aware UGC filter. Public read policies intentionally make many UGC records directly queryable, including records authored by an account blocked in the application. The approved filtering path must be applied before returning feed/comment/profile data; it must not weaken these policies or rely on client hiding alone. The complete policy expressions are in `policies.json` and `core-ugc-policies.json`.

## Verified admin authorization

- `users` contains `is_admin boolean DEFAULT false`, but also contains `email`, `password`, persona configuration, and identity/privacy fields. Direct anon/authenticated table privileges are currently false; the `users` policy alone does not grant table access.
- `profiles` only has `user_id`, `username`, and `created_at`; it has no `id`, `auth_id`, or `is_admin` columns.
- `admin_user_profiles` is a security-barrier view with authenticated SELECT and an explicit `EXISTS` check requiring `users.id = auth.uid()` and `users.is_admin IS TRUE`. It projects admin/persona metadata.
- `public_user_profiles` is a public security-barrier view projecting only public identity fields.
- `admin_room_conversation_*` tables have RLS enabled, no policies, and no anon/authenticated table privileges.
- The live admin room publishing functions are service-role-only by ACL; the internal function additionally checks `users.id = p_admin_id AND is_admin`, and the wrapper requires a prior approval by the publishing admin.
- Several non-room admin-looking policies are unsafe in their live expressions: `persona_post_drafts` and `scheduled_persona_posts` use only `auth.uid() IS NOT NULL`, and `trivia_poll_drafts` allows any authenticated role. These are schema findings only; no changes were made.

## Trigger/function observations

The live trigger inventory includes social post engagement/canonical-media triggers, comment/like count triggers, list-item completion/canonical-media triggers, prediction/rank/rating/review point triggers, and the user-block friendship-removal trigger. Metadata and ACL snapshots are in `triggers.json`, `functions-metadata.json`, and `functions-acl.json`.

One live `SECURITY DEFINER` analytics trigger function (`notify_posthog`) contains a hard-coded webhook credential in its function body. The value was intentionally omitted and no function-body snapshot was saved. This should be treated as a separate credential-rotation/remediation item; this inspection did not alter it.

## Evidence files

- `relations.json` — live public tables/views, RLS and force-RLS flags.
- `columns.json` / `ugc-columns-summary.txt` — live public column metadata; no rows.
- `policies.json` / `core-ugc-policies.json` — live policy commands, roles, USING, and CHECK expressions.
- `constraints.json` — live PK/unique/check/FK definitions.
- `triggers.json` — live public trigger metadata.
- `functions-metadata.json` / `functions-acl.json` — live public function metadata and role execute privileges; no bodies.
- `views.json` — live public view definitions (metadata only).