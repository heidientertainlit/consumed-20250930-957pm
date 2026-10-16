// Operator-only tools; never imported into the app or run on app startup.
import assert from "node:assert/strict";
import { readFile,mkdir,writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { PROJECT,EVIDENCE,query,consumerHashes,functionMetadata,proofFile,auditSql,digest,actorId,managementStore } from "./lib/recommendation-lab-admin.ts";
import { createRecommendationLab } from "../supabase/functions/_shared/recommendation-lab-engine.ts";
import { SOURCES } from "../supabase/functions/_shared/recommendation-lab-manifest.ts";
const version="20261016020000",name=`${version}_recommendation_lab_checkpoint.sql`;
const migration=await readFile(`supabase/migrations/${name}`,"utf8");
const mode=process.argv[2];
const {setup,assertion}=await auditSql();
const begin="begin isolation level repeatable read; set local statement_timeout='120s'; set local lock_timeout='3s';";
if(mode==="preflight"){
  const tables=await query("select count(*)::int as count from pg_tables where schemaname='public' and tablename like 'recommendation_lab_%'");
  assert.equal(tables[0].count,2);
  const absent=await query(`select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as applied,
    to_regprocedure('public.recommendation_lab_worker(text,uuid,jsonb)') is not null as worker`);
  assert.equal(absent[0].applied,false);assert.equal(absent[0].worker,false);
  await proofFile("before",{project:PROJECT,migration_sha256:digest(migration),
    consumer_hashes:await consumerHashes(),functions:await functionMetadata()});
  const snap=await query(`${begin}${setup} select current_setting('recommendation_lab.scope_before')::jsonb as snapshot; rollback;`,false);
  await proofFile("production-before",snap[0].snapshot);
  console.log("PASS preflight: two existing lab tables; isolated target absent; consumer, Edge and production baselines retained.");
}else if(mode==="test"){
  const tests=await readFile("supabase/tests/recommendation_lab_checkpoint.sql","utf8");
  const result=await query(`${begin}${setup}${migration}${tests}${assertion}
    select jsonb_build_object('passed',true,'production_tables',cardinality(current_setting('recommendation_lab.scope_names')::text[])) as result;
    rollback;`,false);
  assert.equal(result[0]?.result?.passed,true);
  await proofFile("tests",{migration_sha256:digest(migration),result});
  console.log("PASS live-schema rollback tests",JSON.stringify(result));
}else if(mode==="apply"){
  const before=JSON.parse(await readFile(`${EVIDENCE}/before.json`,"utf8"));
  const tests=JSON.parse(await readFile(`${EVIDENCE}/tests.json`,"utf8"));
  assert.equal(before.migration_sha256,digest(migration));assert.equal(tests.migration_sha256,digest(migration));
  assert.deepEqual(await consumerHashes(),before.consumer_hashes);
  assert.deepEqual(await functionMetadata(),before.functions);
  const workdir=`${EVIDENCE}/isolated`;
  await mkdir(`${workdir}/supabase/migrations`,{recursive:true});
  await writeFile(`${workdir}/supabase/config.toml`,`project_id = "${PROJECT}"\n`);
  for(const row of await query("select version from supabase_migrations.schema_migrations order by version")){
    assert.match(row.version,/^\d+$/);
    await writeFile(`${workdir}/supabase/migrations/${row.version}_recorded.sql`,"-- Already applied; never replay.\n");
  }
  await writeFile(`${workdir}/supabase/migrations/${name}`,migration);
  for(const args of [["link","--project-ref",PROJECT],["db","push","--linked","--dry-run"]]){
    const p=spawnSync("npx",["--no-install","supabase",...args,"--workdir",workdir],{encoding:"utf8",maxBuffer:4e6,env:{...process.env,NO_COLOR:"1"}});
    await writeFile(`${EVIDENCE}/${args[0]}-output.txt`,p.stdout+p.stderr);
    assert.equal(p.status,0,`Isolated ${args[0]} failed`);
    if(args[0]==="db"){
      const proposed=[...(p.stdout+p.stderr).matchAll(/\b(\d{14}_[a-z0-9_]+\.sql)\b/g)].map(m=>m[1]);
      assert.ok(proposed.includes(name)&&proposed.every(n=>n===name),"Unrelated migration proposed");
    }
  }
  const encoded=Buffer.from(migration).toString("base64");
  const result=await query(`${begin}${setup}${migration}${assertion}
    insert into supabase_migrations.schema_migrations(version,name,statements)
      values('${version}','recommendation_lab_checkpoint',array[convert_from(decode('${encoded}','base64'),'UTF8')]);
    select jsonb_build_object('applied',true,'production_tables',cardinality(current_setting('recommendation_lab.scope_names')::text[])) as result;
    commit;`,false);
  await proofFile("applied",result);console.log("PASS exact isolated migration",JSON.stringify(result));
}else if(mode==="prepare"||mode==="compare"||mode==="state"){
  const actor=await actorId(),store=managementStore(actor);
  const engine=createRecommendationLab(store,k=>process.env[k],actor);
  if(mode==="state"){
    const state=await engine.state();
    console.log(JSON.stringify({ledger:state.ledger,sources:state.sources.map(s=>({key:s.key,title:s.title,
      ready:state.items.some(i=>i.verification.source_key===s.key)})),runs:state.runs.length},null,2));
  }else if(mode==="prepare"){
    // Explicit one-checkpoint operator batch; never called by the UI.
    for(let i=0;i<80;i++){
      const result=await engine.step();console.log(JSON.stringify(result));
      if(result.complete)break;
      if(i===79)throw new Error("Preparation did not terminate within its bound");
    }
  }else{
    for(const source of SOURCES){
      try{console.log(source.key,JSON.stringify(await engine.compare(source.key)));}
      catch(e){console.log(source.key,"UNAVAILABLE:",(e as Error).message);}
    }
  }
}else if(mode==="verify"){
  const before=JSON.parse(await readFile(`${EVIDENCE}/before.json`,"utf8"));
  assert.deepEqual(await consumerHashes(),before.consumer_hashes);
  assert.deepEqual(await functionMetadata(),before.functions);
  const snap=await query(`${begin}${setup} select current_setting('recommendation_lab.scope_before')::jsonb as snapshot; rollback;`,false);
  const original=JSON.parse(await readFile(`${EVIDENCE}/production-before.json`,"utf8"));
  const changed=Object.keys(original).filter(k=>JSON.stringify(original[k])!==JSON.stringify(snap[0].snapshot[k]));
  await proofFile("production-after",snap[0].snapshot);
  const state=await managementStore(await actorId())("state");
  const usage=await query(`select value->>'kind' as kind,count(*)::int as calls,
    sum(coalesce((value->>'actual')::numeric,0)) as usage_cost_usd,
    sum(coalesce((value->'usage'->>'prompt_tokens')::bigint,0)) as input_tokens,
    sum(coalesce((value->'usage'->>'completion_tokens')::bigint,0)) as output_tokens,
    sum(coalesce((value->'usage'->>'total_tokens')::bigint,0)) as total_tokens,
    sum(coalesce((value->'usage'->'prompt_tokens_details'->>'cached_tokens')::bigint,0)) as cached_input_tokens
    from public.recommendation_lab_runs r,jsonb_each(r.diagnostics->'calls')
    where r.experiment_key='small-lab-1' and r.label='Checkpoint ledger' group by value->>'kind' order by kind`);
  const liveBody=await query("select prosrc from pg_proc where oid='public.recommendation_lab_worker(text,uuid,jsonb)'::regprocedure");
  assert.equal(liveBody[0].prosrc,migration.match(/as \$\$([\s\S]*?)\$\$;/)?.[1],"Live worker differs from tested migration");
  const summary={production_digest_differences:changed,consumer_code_unchanged:true,existing_edge_functions_unchanged:true,
    items:state.items.length,embedded:state.items.filter((i:any)=>i.status==="embedded").length,runs:state.runs.length,
    usage,ledger:state.ledger};
  await proofFile("verified",summary);
  console.log(JSON.stringify({...summary,ledger:{spent:state.ledger.spent,reserved:state.ledger.reserved,cap:state.ledger.cap}},null,2));
  if(changed.length)console.log("NOTE: Cross-time production differences need attribution; rollback-only same-snapshot scope tests remain authoritative for worker/migration noninterference.");
}else throw new Error("Choose preflight, test, apply, prepare, compare, state, or verify; no implicit writes.");
