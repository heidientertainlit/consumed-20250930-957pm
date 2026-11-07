// This command targets the external Supabase production database, never Replit's.
// preflight is read-only. verify-rollback writes DISPOSABLE rows in a transaction
// and rolls back; invoke it only after explicit production approval.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const project = 'mahpgcogwpawvviapqza';
const mode = process.argv[2];
if (!['preflight', 'verify-rollback'].includes(mode)) {
  throw new Error('Usage: node scripts/verify-delete-own-library-media-live.mjs preflight|verify-rollback');
}
const migration = await readFile('supabase/migrations/20261107050000_delete_own_library_media.sql','utf8');
const expectedBody = migration.match(/as \$\$([\s\S]*?)\$\$;/i)?.[1];
assert.ok(expectedBody, 'Expected exact migration body');
const digest = (text) => createHash('sha256').update(text).digest('hex');

async function query(sql, readOnly = true) {
  if (!process.env.SUPABASE_ACCESS_TOKEN) throw new Error('Supabase management access unavailable');
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql, read_only: readOnly }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.json();
  if (!response.ok || !Array.isArray(body)) {
    // Do not echo a response that might include SQL, IDs, or credentials.
    throw new Error(`Database verification request failed (HTTP ${response.status})`);
  }
  return body;
}

const functions = await query(`select p.prosrc,p.prosecdef,p.proconfig,
  has_function_privilege('authenticated'::regrole,p.oid,'EXECUTE') as authenticated_can_execute,
  has_function_privilege('anon'::regrole,p.oid,'EXECUTE') as anon_can_execute
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='delete_own_library_media'
  and pg_get_function_identity_arguments(p.oid)='p_item_id uuid'`);
const history = await query(`select version from supabase_migrations.schema_migrations
  where version='20261107050000'`);
if (mode === 'preflight') {
  assert.equal(functions.length, 0, 'Deletion function already installed; inspect before applying anything');
  assert.equal(history.length, 0, 'Migration already recorded; inspect before applying anything');
  console.log(JSON.stringify({ project, migration_sha256:digest(migration),
    functionAbsent:true, migrationAbsent:true, readOnly:true }));
  process.exit(0);
}

assert.equal(history.length, 1, 'Expected the one approved migration to be recorded');
assert.equal(functions.length, 1, 'Expected exactly one deletion function');
assert.equal(functions[0].prosrc, expectedBody, 'Production function differs from tested source');
assert.equal(functions[0].prosecdef, true, 'Function is not security definer');
assert.ok(functions[0].proconfig?.includes('search_path='), 'Search path is not locked down');
assert.equal(functions[0].authenticated_can_execute, true);
assert.equal(functions[0].anon_can_execute, false);

const marker = randomUUID();
const template = await readFile('supabase/tests/delete_own_library_media_live.sql','utf8');
assert.equal((template.match(/__MARKER__/g) || []).length, 2);
const sql = template.replaceAll('__MARKER__', marker);
assert.ok(sql.trimEnd().endsWith('rollback;'), 'Live fixture must roll back');
const results = await query(sql, false);
const proof = results.find(row => row?.deletion_verification)?.deletion_verification;
assert.equal(proof?.passed,true,'Rollback transaction did not prove deletion');
const leftovers = await query(`select jsonb_build_object(
    'lists',(select count(*) from public.list_items where external_source='deletion_fixture' and external_id like '${marker}%'),
    'posts',(select count(*) from public.social_posts where media_external_source='deletion_fixture' and media_external_id like '${marker}%'),
    'ratings',(select count(*) from public.media_ratings where media_external_source='deletion_fixture' and media_external_id like '${marker}%'),
    'progress',(select count(*) from public.media_progress_events where media_external_source='deletion_fixture' and media_external_id like '${marker}%')
  ) as counts`);
assert.deepEqual(leftovers[0]?.counts, { lists:0, posts:0, ratings:0, progress:0 },
  'Fixture rows persisted after rollback; inspect immediately');
console.log(JSON.stringify({
  project, migration_sha256:digest(migration), exactFunction:true, ownerOnly:true,
  controlsPreserved:true, rollbackVerified:true, fixturesPersisted:false,
}));
