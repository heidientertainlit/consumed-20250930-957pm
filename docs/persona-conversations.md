# Private persona conversation workflow

This is a separate workflow inside `/admin/personas`. The existing standalone
generator, writer prompts, profiles, weights, review queue and standalone
scheduler are unchanged. There is no Room, Tribe, provisioning, autonomous
human-reply or fake-reaction feature.

## Admin flow

1. Enter a free topic or search a verified title. A selected title is the sole
   subject, not a suggestion to choose one of the participants' favorites.
   Optionally request AI discussion questions grounded in actual TMDB weekly
   movie/TV trends and Open Library weekly book trends. Coverage, failures and
   fetch times are shown. Music uses manual verified search, never trending.
2. Select **2–12 exact existing personas**, then choose the opening author.
   Filter by saved tone/interests/name, social-voice energy, or explicitly
   administered fictional gender. Unset gender stays unknown. No human gender
   data or inferred names are involved; metadata saves do not rewrite config.
3. Choose 2–19 replies, 5 minutes–7 days, and 10–120 words per message. At least
   60 seconds must separate proposed messages; longer threads need longer
   duration. Supply an optional angle/context. Supplied context is not labelled
   independent verification. The model may use returning speakers.
4. Generate a **private** draft. Root/comment graph, author eligibility, JSON,
   body length, exact final offset, moderation and subject/context evidence are
   validated. No public content is written. Each generation has one bounded
   writer call, one factual review and two bounded moderation calls; no retries.
   AI suggestions similarly use one question-writing call, one factual review
   and one moderation call (maximum nine provider candidates).
5. Review connected messages, edit content/parents/offsets and **save** edits.
   Edits are moderated/evidence-checked and clear approval. Approval is a
   separate explicit action, bound to a revision. Choose a future local date
   and time to schedule the approved revision. Schedule changes use UTC on the
   wire. No generation or approval schedules implicitly.
6. Pause, resume at a new future time, reject, or cancel unreleased messages.
   Delivered content is immutable here; editing/regeneration of a delivered or
   active run is denied. Public content already delivered remains public when
   later messages are cancelled. Existing public moderation/deletion controls
   remain applicable. History shows approval/scheduling and delivery failures.

## Storage and authorization

- `persona_conversation_subjects`: private, one-hour server-issued selection
  records. The browser sends record IDs, never trusted provider/canonical data.
  Fresh results come from `media-search`, TMDB or Open Library; OpenAI fallback
  search results are rejected. Provider metadata goes through the existing
  server-owned canonical resolver. No title-only media attachment.
- `persona_conversation_gender`: separate explicit fictional-persona metadata.
- `persona_conversation_runs`: private graph, provenance, revision/approval,
  schedule, delivery mappings, error/backoff and history. RLS is enabled with
  **no anon/authenticated grants or policies**. Reads and writes go through the
  admin-authorized Edge Function. Missing functions/migrations fail explicitly.
- `admin-persona-conversations`: requires a real administrator bearer session.
  Service credentials do not substitute for an admin review.
- `manage_persona_conversation`: service-only, verifies administrator status,
  holds a run lock, checks revision/state and validates graph/persona identities.
- `deliver-persona-conversations`: separate **service-only POST** worker; no
  browser/manual-publication button. It scans at most 20 due runs and calls the
  service-only transactional `deliver_persona_conversation`.

The two new functions explicitly disable the gateway's legacy JWT verification
in `supabase/config.toml`; the admin endpoint independently verifies the bearer
user with Supabase Auth, and the worker independently verifies the exact service
credential before any database operation. This accommodates asymmetric session
tokens without removing either authorization boundary.

## Delivery and shared surfaces

Each transaction locks one run and releases **at most one** due message. Root
and comment IDs are recorded in the same transaction as public insertion.
Concurrent requests skip a locked run; retries cannot recreate a mapped
message. Comments require their parent to have been delivered, and deleted
parents/root never resurrect. Invalidated persona identities stop delivery.

The next eligible time is the later of the nominal due time and the previous
**actual** arrival plus the proposed gap (minimum 60 seconds). Delayed workers
therefore do not dump all overdue messages. Next-attempt filtering keeps long
waiting threads out of the 20-run scan. Failures roll back public insertion,
persist errors, retry after five minutes, and pause after five consecutive
failures. Admins can inspect history and choose a future resume time after
addressing the cause. Timestamps are actual creation times, never schedule times.

The root is one `social_posts` row, tagged by `persona_conversation_id` and
canonical/provider identity. Now and media detail use that same root, likes,
comment graph and timestamps. Conversation roots are not grouped away or merged
with another rating by their opening author. Free topics have no media identity
and appear only in Now. The existing nested comment API handles human comments
from either surface, including blocking/visibility checks. A scoped deferred
count trigger recounts automated and human comments, compatible with legacy
count triggers. Mutations invalidate both surfaces; media activity refreshes
every 30 seconds.

## Local verification (no production writes)

```sh
npm run check
npm run build
npx tsx --test supabase/functions/_shared/persona-conversation.test.ts \
  scripts/persona-conversation-api.test.ts
bash scripts/test-persona-conversations-local.sh
# With the Mockup Sandbox workflow running, provide its isolated preview URL:
PERSONA_FIXTURE_URL="<local-preview-origin>/__mockup/preview/persona-conversations/ConversationStudioFixture" \
  node scripts/test-persona-conversation-browser.mjs
```

The API fixtures execute actual handlers/authorization with fake transports,
never workspace credentials. The default studio “All types” regression invokes
the actual `media-search` handler, verifies that the provider type is omitted,
attaches its verified provider result and generates a private draft.
The SQL test starts a disposable PostgreSQL
cluster and checks RLS/grants, non-admin denial, graph errors, revision-bound
approval, edit invalidation, future times, delayed pacing, concurrent delivery,
retry rollback/backoff, pause/cancel, nested parent mapping, exact shared media
identity and config preservation. Existing canonical/standalone generator
tests remain applicable. The Mockup Sandbox's
`persona-conversations/ConversationStudioFixture` uses an in-memory transport
and inert Supabase shim for browser interaction checks, not an auth bypass.

## Release handoff — private admin stage applied

Initial implementation performed no schema push, Edge Function deployment,
cron activation, live generation, public posting, or Git network operations.
The separately approved private admin stage has since applied only the
conversation schema transaction and deployed `admin-persona-conversations`.
The endpoint is ACTIVE and its normalized deployed entrypoint matches the
tested workspace code. All 182 pre-existing function versions/statuses and
the three pre-existing posts/comments trigger definitions remained unchanged.
The new private tables have RLS enabled and deny anonymous/authenticated reads;
the delivery RPC is service-only. Verification found zero conversation drafts,
subjects, gender metadata, public conversation posts, or conversation cron jobs.
No delivery worker, shared-feed update, frontend release, content generation,
or Git network operation was performed. Signed-in admin UI and live generation
have not been verified.

The direct Management API schema transaction did not add a migration-history
record. Do not reapply it or run a later schema push until its history
bookkeeping has been reconciled through a separately approved action.
Local fixture verification does not prove compatibility with every installed
production trigger or constraint; verify against an authorized disposable
staging copy of the live schema before release.

After **separate explicit release authorization**:

1. Back up/check the target schema. Confirm UUID `social_posts.id`, the actual
   comment ID type/defaults, canonical alias tables, moderation triggers and
   deletion rules. The inspected production comment IDs are integer (`int4`);
   the local fixture now uses integer IDs/defaults and includes the deployed
   legacy insert counter alongside conversation-scoped recounting. A targeted
   disposable rehearsal with production-shaped columns, relevant constraints,
   and deployed post/comment triggers passed; it is not a full staging clone.
   The private stage has already applied
   `20261009000000_persona_social_conversations.sql`; do not apply it again.
   This project's
   remote migration history differs from local history: use an isolated
   Supabase workdir with remote-history placeholders. A dry run must list
   **only this migration**, never replay unrelated historical migrations.
2. Deploy `admin-persona-conversations`, `deliver-persona-conversations`,
   updated `social-feed` and `social-feed-comments`, then the frontend. Verify
   the **active** function version/source hash, not just successful CLI output.
   Do not deploy or change the existing standalone generation/scheduling
   functions. Verify authorization/RLS using staging fixtures before live use.
3. Scheduled delivery uses Supabase **Cron (`pg_cron`) + `pg_net`**
   invoking the new service-only worker once per minute. The guarded installer
   is `supabase/operations/persona-conversation-delivery-timer.sql`; it is a
   manual release operation, not a startup hook or automatic migration.
   It creates a dedicated **inactive** job and rejects an already existing
   conversation timer rather than replacing it. Store the approved
   project URL/service credential in Supabase Vault using its secure setup
   flow, never source code/browser configuration. Ensure this key belongs to
   the actual app project; the workspace's service key may target another
   project. Keep this job **inactive** until separately authorized.
4. Have the user handle Git operations manually. Review a private staging
   thread on both desktop/mobile before authorizing live content separately.

### First production stage: private admin only — approval required

Local preparation does not authorize either action below. Request approval for
each action individually; approval for one does not authorize the other.

**Action A — apply only the new schema transaction**

- Target: hosted Supabase project `mahpgcogwpawvviapqza`.
- Exact API action: `POST
  https://api.supabase.com/v1/projects/mahpgcogwpawvviapqza/database/query`
  with JSON body `{ "query": <entire contents of
  supabase/migrations/20261009000000_persona_social_conversations.sql> }`.
  Authenticate using the management token from the environment without
  printing it. The file contains its own `BEGIN`/`COMMIT` transaction.
- Expected changes: three private tables, their indexes/RLS/grants and
  service-only conversation routines; one nullable
  `social_posts.persona_conversation_id` column and foreign key; one new
  conversation-scoped comment-count trigger.
- Relevant risk: the migration touches the shared posts/comments schema and
  briefly needs database locks. Its new deferred trigger is attached to all
  comment inserts/deletes but only recounts conversation-linked posts.
  Targeted isolated tests preserved ordinary comment-count behavior; they
  cannot guarantee every production interaction.
- Does not replay migration history or write content/persona configuration.
  It creates a delivery RPC but does not invoke it, install cron, or start
  automatic posting. Direct Management API execution does not itself record
  the migration in Supabase migration history; reconcile that only through a
  separately approved action. If the transaction fails, do not retry or
  partially apply individual statements without investigating.

**Action B — deploy only the private admin function**

```sh
npx supabase functions deploy admin-persona-conversations \
  --project-ref mahpgcogwpawvviapqza --use-api
```

- This introduces one admin-authorized endpoint; it does not redeploy
  `generate-persona-content`, `post-scheduled-content`, `admin-approve-draft`,
  `media-search`, `social-feed`, or `social-feed-comments`.
- Schema action A must succeed first. Verify the active deployed version/source
  and state-loading authorization afterward; do not invoke generation,
  scheduling, or persona metadata writes during that verification.
- Admins can generate private drafts and manage them once this endpoint is
  available. Actually generating a live private draft writes data and uses
  the AI provider, so obtain separate approval for that test.
- Do not deploy `deliver-persona-conversations`, update the shared feed
  endpoints, create/activate cron, publish the frontend, perform Git network
  operations, or release a public thread as part of either action.

Unrated reviews remain supported. An internal `rating` engagement label is
not evidence of an invented star rating; do not change review semantics or
the protected standalone generator because of that label alone.

## Scheduled delivery: built locally, activation requires approval

The intended flow is **private draft → admin reviews the full conversation →
admin approves its exact revision → admin schedules → approved messages are
delivered at the reviewed intervals**. Scheduled delivery is not autonomous
content generation or unapproved publishing.

The dedicated dispatcher first checks for an approved, scheduled, due run
whose retry/pacing time has arrived. Drafts, approval-only runs, future starts,
stale approvals, paused runs, and cancellations do not trigger a worker request.
The delivery transaction checks these conditions again under its row lock.
The dispatcher never inserts posts/comments or changes persona configuration.
The timer is minute-granularity, not an exact-second alarm: a due message may
arrive on the next timer tick, and reviewed reply gaps remain preserved.

Before production activation, separately approve the following exact actions:

1. Deploy only the new worker:
   `npx supabase functions deploy deliver-persona-conversations --project-ref mahpgcogwpawvviapqza --use-api`.
2. Release the already-prepared shared-surface changes through separate targeted
   deployments of `social-feed` and `social-feed-comments`, if not already
   released. Verify active source/version and preserved authorization.
3. Securely configure the two named Vault secrets from the **actual app
   project**, never the mismatched workspace service-role credential.
   Neither installer nor build creates secrets. Do not print their values.
4. Apply only `supabase/operations/persona-conversation-delivery-timer.sql`
   through the Management API. It requires existing Cron, pg_net, Vault and
   conversation schema; it installs no extensions and commits the new job
   inactive. Other generators and jobs are untouched.
5. Review the existing scheduled queue before explicitly activating this job:
   approved due conversations become eligible at the next tick. Confirm worker
   authorization, secure credentials and project target before activation.

The dispatcher restricts the target to the app project's Supabase origin,
so credentials cannot be sent to a workspace URL or another host. Missing
credentials or an unexpected target fail explicitly. The dispatcher function
is not callable by anonymous users, authenticated users, or the service role;
only the trusted Cron database owner is granted execution.

Activation SQL below is **a separately approved production action**, not part
of installing the inactive timer:

```sql
-- NOT executed by local development/testing.
select cron.alter_job(
  (select jobid from cron.job where jobname='persona-social-conversations'),
  active:=true
);
-- Global pause (also requires approval):
-- select cron.alter_job(
--   (select jobid from cron.job where jobname='persona-social-conversations'),
--   active:=false
-- );
-- Pausing/cancelling an individual run also prevents its unreleased messages.
```

A queued HTTP request is not proof that content was delivered. Inspect the
conversation's delivery mappings/history and bounded Cron/Edge Function logs.
HTTP failures retry through later ticks; transaction failures retain the
existing five-minute backoff and five-failure pause. The isolated SQL fixture
uses fake Cron, Vault and network transports with the inspected signatures:
it never contacts production or retrieves real credentials.

`scripts/test-persona-conversations-local.sh` also runs
`scripts/persona-conversation-delivery-integration.ts` against its disposable
Unix socket. That check executes the real delivery worker and real database
RPCs through a local-only adapter: draft and approval remain private, future
schedules do not release early, a timer dispatch delivers the opening, repeated
ticks do not duplicate it, pause/resume preserves the reviewed thread, and both
replies arrive with consistent counts before the run becomes completed.
