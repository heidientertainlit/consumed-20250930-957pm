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

## Release handoff — NOT executed

No schema push, Edge Function deployment, cron activation, live generation,
public posting, or Git network operations were performed for implementation.
Local fixture verification does not prove compatibility with every installed
production trigger or constraint; verify against an authorized disposable
staging copy of the live schema before release.

After **separate explicit release authorization**:

1. Back up/check the target schema. Confirm UUID `social_posts.id`, bigint
   comment IDs, canonical alias tables, moderation triggers and deletion rules.
   Apply only `20261009000000_persona_social_conversations.sql`. This project's
   remote migration history differs from local history: use an isolated
   Supabase workdir with remote-history placeholders. A dry run must list
   **only this migration**, never replay unrelated historical migrations.
2. Deploy `admin-persona-conversations`, `deliver-persona-conversations`,
   updated `social-feed` and `social-feed-comments`, then the frontend. Verify
   the **active** function version/source hash, not just successful CLI output.
   Do not deploy or change the existing standalone generation/scheduling
   functions. Verify authorization/RLS using staging fixtures before live use.
3. A supported scheduling option is Supabase **Cron (`pg_cron`) + `pg_net`**
   invoking the new service-only worker once per minute. Store the approved
   project URL/service credential in Supabase Vault using its secure setup
   flow, never source code/browser configuration. Ensure this key belongs to
   the actual app project; the workspace's service key may target another
   project. Keep this job **inactive** until separately authorized.
4. Have the user handle Git operations manually. Review a private staging
   thread on both desktop/mobile before authorizing live content separately.

Illustrative activation SQL, to run **only after explicit job authorization**,
assuming the corresponding Vault secrets/extensions have been securely set up:

```sql
-- TEMPLATE ONLY; not a migration and not executed during this task.
select cron.schedule('persona-social-conversations', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'consumed_supabase_url')
           || '/functions/v1/deliver-persona-conversations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret
        from vault.decrypted_secrets where name = 'consumed_service_role')),
    body := '{}'::jsonb,
    timeout_milliseconds := 50000
  );
$job$);
-- Stop job delivery: select cron.unschedule('persona-social-conversations');
-- Pausing/cancelling an individual run also prevents its unreleased messages.
```
