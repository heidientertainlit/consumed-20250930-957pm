// Explicitly invoked external-Supabase operations; never imported by the app.
// Tokens stay in request headers. Test data/claims never leave a rollback.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const project = "mahpgcogwpawvviapqza";
const version = "20261016010000";
const migrationName = `${version}_recommendation_lab_foundation.sql`;
const migration = await readFile(`supabase/migrations/${migrationName}`, "utf8");
const rollback = (await readFile("supabase/operations/recommendation-lab-foundation.rollback.sql", "utf8"))
  .replace(/^begin;\s*$/mi, "").replace(/^commit;\s*$/mi, "");
const tests = await readFile("supabase/tests/recommendation_lab_foundation.sql", "utf8");
const evidence = "/tmp/recommendation-lab-foundation";
const mode = process.argv[2];
await mkdir(evidence, { recursive: true });

async function api(route, body) {
  assert.ok(process.env.SUPABASE_ACCESS_TOKEN, "Management credential unavailable");
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}${route}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    // Database diagnostics may echo SQL, but this script's SQL contains no
    // credentials or personal data. Never echo arbitrary API error bodies.
    const detail = route === "/database/query" ? (await response.text()).slice(0, 3500) : "";
    throw new Error(`Management request ${route}: HTTP ${response.status} ${detail}`);
  }
  return response.json();
}
const query = (sql, readOnly = true) => api("/database/query", { query: sql, read_only: readOnly });
const digest = text => createHash("sha256").update(text).digest("hex");
async function consumerHashes() {
  const paths = [
    "client/src/pages/media-detail.tsx", "client/src/lib/similar-media.ts",
    "client/src/hooks/use-similar-media.ts", "client/src/components/more-like-this.tsx",
    "supabase/functions/conversational-search/index.ts",
    "supabase/functions/media-search/index.ts", "supabase/functions/rebuild-recommendations/index.ts",
    "supabase/functions/get-recommendations/index.ts",
    "supabase/functions/_shared/canonical-media.ts", "supabase/functions/_shared/media-fingerprint.ts",
    "client/src/App.tsx", "client/src/pages/admin.tsx", "supabase/config.toml",
  ];
  return Object.fromEntries(await Promise.all(paths.map(async p => [p, digest(await readFile(p))])));
}
async function functionsMetadata() {
  const functions = await api("/functions");
  return functions.map(f => ({ id: f.id, slug: f.slug, version: f.version, status: f.status, verify_jwt: f.verify_jwt }))
    .sort((a,b) => a.slug.localeCompare(b.slug));
}

// Scope verification runs before/after in ONE repeatable-read transaction.
// Concurrent production activity is not mistaken for writes by this migration.
// Only digests/counts are retained; existing row contents are never exported.
const auditSetup = `
create function pg_temp.lab_scope_snapshot(p_names text[], p_functions oid[])
returns jsonb language plpgsql as $audit$
declare n text; data_digest text; rows_count bigint; output jsonb := '{}'::jsonb; schema_rows jsonb;
begin
  foreach n in array p_names loop
    execute format('select count(*), md5(coalesce(string_agg(h, '''' order by h), '''')) from (select md5(to_jsonb(t)::text) h from public.%I t) x',n)
      into rows_count,data_digest;
    select jsonb_build_object(
      'relation', (select to_jsonb(c) from pg_class c where c.oid=format('public.%I',n)::regclass),
      'columns', (select jsonb_agg(to_jsonb(a) order by attnum) from pg_attribute a where attrelid=format('public.%I',n)::regclass and attnum>0 and not attisdropped),
      'constraints', (select jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid)) order by conname) from pg_constraint where conrelid=format('public.%I',n)::regclass),
      'indexes', (select jsonb_agg(jsonb_build_array(indexname,indexdef) order by indexname) from pg_indexes where schemaname='public' and tablename=n),
      'policies', (select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename=n),
      'triggers', (select jsonb_agg(pg_get_triggerdef(oid) order by tgname) from pg_trigger where tgrelid=format('public.%I',n)::regclass)
    ) into schema_rows;
    -- Relation statistics (reltuples/relpages/allvisible) can change externally;
    -- capture identity, ownership, ACL and RLS, not planner/storage statistics.
    schema_rows := jsonb_set(schema_rows,'{relation}',
      (schema_rows->'relation') - array['reltuples','relpages','relallvisible','relfrozenxid','relminmxid','relfilenode']);
    output := output || jsonb_build_object(n,jsonb_build_object('rows',rows_count,'data',data_digest,'schema',md5(schema_rows::text)));
  end loop;
  output := output || jsonb_build_object('__existing_functions',
    (select md5(coalesce(string_agg(pg_get_functiondef(oid),'' order by oid),'')) from pg_proc where oid=any(p_functions)));
  return output;
end;
$audit$;
do $audit$
declare names text[]; functions oid[];
begin
  select array_agg(c.relname order by c.relname) into names from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p');
  select array_agg(p.oid order by p.oid) into functions from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f';
  perform set_config('recommendation_lab.scope_names',names::text,true);
  perform set_config('recommendation_lab.scope_functions',functions::text,true);
  perform set_config('recommendation_lab.scope_before',pg_temp.lab_scope_snapshot(names,functions)::text,true);
end;
$audit$;
`;
const auditAssert = `
do $audit$
declare current_snapshot jsonb;
begin
  current_snapshot := pg_temp.lab_scope_snapshot(
    current_setting('recommendation_lab.scope_names')::text[],
    current_setting('recommendation_lab.scope_functions')::oid[]);
  if current_snapshot <> current_setting('recommendation_lab.scope_before')::jsonb then
    raise exception 'Existing production relation/data/function changed: %',
      (select jsonb_agg(key) from jsonb_each(current_snapshot) where value is distinct from current_setting('recommendation_lab.scope_before')::jsonb->key);
  end if;
end;
$audit$;
`;
const transactionStart = "begin isolation level repeatable read; set local lock_timeout='3s'; set local statement_timeout='120s';";
const tableAbsentAssert = `
do $$ begin
  if to_regclass('public.recommendation_lab_items') is not null
     or to_regclass('public.recommendation_lab_runs') is not null
     or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
               where n.nspname='public' and p.proname like 'recommendation_lab_%')
     or exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then
    raise exception 'Foundation already exists or conflicts; stop';
  end if;
end $$;`;

if (mode === "preflight") {
  const state = await query(`select jsonb_build_object(
    'items',to_regclass('public.recommendation_lab_items'),
    'runs',to_regclass('public.recommendation_lab_runs'),
    'vector_installed',exists(select 1 from pg_extension where extname='vector'),
    'history',exists(select 1 from supabase_migrations.schema_migrations where version='${version}')
  ) as state`);
  assert.deepEqual(state[0].state, { items:null, runs:null, vector_installed:false, history:false });
  await writeFile(path.join(evidence,"before.json"),JSON.stringify({
    project, migration_sha256:digest(migration), consumer_hashes:await consumerHashes(),
    functions:await functionsMetadata(), state:state[0].state,
  },null,2));
  console.log("PASS preflight: exact external project; no lab objects or pgvector; consumer/function baselines saved.");
} else if (mode === "test") {
  // Exercise the guarded down script before deletion, then after removing only
  // rollback-only fixtures. Drop the new extension too, all before ROLLBACK.
  const guardBody = rollback.match(/do \$\$([\s\S]*?)\$\$;/i)?.[1];
  assert.ok(guardBody);
  const rollbackRefusal = `do $test$ begin
    begin
      do $guard$ ${guardBody} $guard$;
      raise exception 'Rollback unexpectedly permitted nonempty tables' using errcode='XX000';
    exception when raise_exception then null; end;
  end $test$;`;
  const result=await query(`${transactionStart}${tableAbsentAssert}${auditSetup}${migration}${tests}
    ${rollbackRefusal}
    delete from public.recommendation_lab_runs;
    delete from public.recommendation_lab_items;
    ${rollback}
    drop extension vector restrict;
    ${auditAssert}
    select jsonb_build_object('passed',true,'existing_tables_verified',
      cardinality(current_setting('recommendation_lab.scope_names')::text[]),
      'checks','real-role admin/nonadmin/guest/service permissions; forged/absent subject; validation; vector provenance/dimensions; disabled capabilities; rollback refusal and full rollback') as foundation_result;
    rollback;`,false);
  assert.equal(result[0]?.foundation_result?.passed,true);
  await writeFile(path.join(evidence,"test.json"),JSON.stringify(result,null,2));
  console.log("PASS rollback-only live-schema tests:",JSON.stringify(result));
} else if (mode === "apply") {
  const before=JSON.parse(await readFile(path.join(evidence,"before.json"),"utf8"));
  assert.equal(digest(migration),before.migration_sha256,"Migration changed since preflight");
  assert.deepEqual(await consumerHashes(),before.consumer_hashes);
  assert.deepEqual(await functionsMetadata(),before.functions);
  const testResult=JSON.parse(await readFile(path.join(evidence,"test.json"),"utf8"));
  assert.equal(testResult[0]?.foundation_result?.passed,true,"Run rollback-only tests first");
  const history=await query("select version from supabase_migrations.schema_migrations order by version");
  const isolated=path.join(evidence,"isolated");
  await mkdir(path.join(isolated,"supabase/migrations"),{recursive:true});
  await mkdir(path.join(isolated,"supabase/.temp"),{recursive:true});
  await writeFile(path.join(isolated,"supabase/config.toml"),`project_id = "${project}"\n`);
  await writeFile(path.join(isolated,"supabase/.temp/project-ref"),project);
  for(const row of history) {
    assert.match(row.version,/^\d+$/);
    await writeFile(path.join(isolated,"supabase/migrations",`${row.version}_recorded.sql`),"-- Already recorded remotely; never replay.\n");
  }
  await writeFile(path.join(isolated,"supabase/migrations",migrationName),migration);
  // Link only the disposable workdir so the CLI resolves an IPv4 pooler rather
  // than its legacy IPv6 database host. Never alter the project's own config.
  const linkProcess=spawnSync("npx",["--no-install","supabase","link","--project-ref",project,"--workdir",isolated],{
    encoding:"utf8",maxBuffer:4*1024*1024,env:{...process.env,NO_COLOR:"1"},
  });
  assert.equal(linkProcess.status,0,"Could not link isolated migration workdir");
  const dryRunProcess=spawnSync("npx",["--no-install","supabase","db","push","--linked","--dry-run","--workdir",isolated],{
    encoding:"utf8",maxBuffer:4*1024*1024,env:{...process.env,NO_COLOR:"1"},
  });
  const dryRun=dryRunProcess.stdout+dryRunProcess.stderr;
  await writeFile(path.join(evidence,"dry-run.txt"),dryRun);
  assert.equal(dryRunProcess.status,0,`Isolated migration dry-run failed; inspect ${evidence}/dry-run.txt`);
  const proposed=[...dryRun.matchAll(/\b(\d{14}_[a-z0-9_]+\.sql)\b/g)].map(m=>m[1]);
  assert.ok(proposed.includes(migrationName),"Dry run did not list intended migration");
  assert.ok(proposed.every(name=>name===migrationName),"Unrelated migration proposed");
  const result=await query(`${transactionStart}${tableAbsentAssert}${auditSetup}${migration}${auditAssert}
    insert into supabase_migrations.schema_migrations(version,name,statements)
      values ('${version}','recommendation_lab_foundation',array[$migration$${migration}$migration$]);
    select jsonb_build_object('applied',true,'existing_tables_verified',
      cardinality(current_setting('recommendation_lab.scope_names')::text[]),
      'items',(select count(*) from public.recommendation_lab_items),
      'runs',(select count(*) from public.recommendation_lab_runs)) as foundation_result;
    commit;`,false);
  assert.equal(result[0]?.foundation_result?.applied,true);
  await writeFile(path.join(evidence,"applied.json"),JSON.stringify(result,null,2));
  console.log("PASS isolated additive apply:",JSON.stringify(result));
} else if (mode === "verify") {
  const before=JSON.parse(await readFile(path.join(evidence,"before.json"),"utf8"));
  assert.deepEqual(await consumerHashes(),before.consumer_hashes,"Consumer source changed");
  assert.deepEqual(await functionsMetadata(),before.functions,"Existing Edge Function metadata changed");
  const result=await query(`select jsonb_build_object(
    'items',(select count(*) from public.recommendation_lab_items),
    'runs',(select count(*) from public.recommendation_lab_runs),
    'vector_version',(select extversion from pg_extension where extname='vector'),
    'history_rows',(select count(*) from supabase_migrations.schema_migrations where version='${version}'),
    'lab_tables',(select count(*) from pg_tables where schemaname='public' and tablename like 'recommendation_lab_%'),
    'rls_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('recommendation_lab_items','recommendation_lab_runs') and c.relrowsecurity),
    'lab_functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'recommendation_lab_%'),
    'read_policies',(select count(*) from pg_policies where schemaname='public' and tablename in ('recommendation_lab_items','recommendation_lab_runs') and cmd='SELECT'),
    'hardened_functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname like 'recommendation_lab_%' and p.prosecdef
      and p.proconfig=array['search_path=pg_catalog']::text[]
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and has_function_privilege('authenticated',p.oid,'EXECUTE')),
    'admin_direct_write',has_table_privilege('authenticated','public.recommendation_lab_runs','INSERT'),
    'guest_read',has_table_privilege('anon','public.recommendation_lab_runs','SELECT'),
    'service_direct_write',has_table_privilege('service_role','public.recommendation_lab_runs','INSERT')
  ) as state`);
  const s=result[0].state;
  assert.equal(s.items,0); assert.equal(s.runs,0); assert.ok(s.vector_version);
  assert.equal(s.history_rows,1); assert.equal(s.lab_tables,2); assert.equal(s.rls_tables,2);
  assert.equal(s.lab_functions,3); assert.equal(s.read_policies,2);
  assert.equal(s.hardened_functions,3);
  assert.equal(s.admin_direct_write,false); assert.equal(s.guest_read,false); assert.equal(s.service_direct_write,false);
  await writeFile(path.join(evidence,"verified.json"),JSON.stringify(result,null,2));
  console.log("PASS verified foundation:",JSON.stringify(s));
  console.log("PASS current recommendation, routing, shared search, identity source hashes and all existing Edge Function metadata unchanged.");
} else {
  throw new Error("Choose preflight, test, apply, or verify. No implicit write mode.");
}
