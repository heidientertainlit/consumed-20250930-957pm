import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
export const PROJECT = "mahpgcogwpawvviapqza";
export const EVIDENCE = "/tmp/recommendation-lab-checkpoint";
export async function management(route:string,body?:any){
  if(!process.env.SUPABASE_ACCESS_TOKEN)throw new Error("Management credential unavailable");
  const r=await fetch(`https://api.supabase.com/v1/projects/${PROJECT}${route}`,{
    method:body?"POST":"GET",headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,"Content-Type":"application/json"},
    ...(body?{body:JSON.stringify(body)}:{}),
  });
  const data=await r.json();
  if(!r.ok)throw new Error(`Management HTTP ${r.status}: ${String(data?.message||"Request failed").split("\n")[0].slice(0,400)}`);
  return data;
}
export const query=(sql:string,readOnly=true)=>management("/database/query",{query:sql,read_only:readOnly});
export const digest=(s:string|Buffer)=>createHash("sha256").update(s).digest("hex");
export async function auditSql(){
  const original=await readFile("scripts/verify-recommendation-lab-foundation.mjs","utf8");
  // Reuse the same already-tested production scope snapshot, excluding only
  // the two deliberately writable lab tables.
  const setup=original.match(/const auditSetup = `([\s\S]*?)`;/)?.[1];
  const assertion=original.match(/const auditAssert = `([\s\S]*?)`;/)?.[1];
  if(!setup||!assertion)throw new Error("Scope audit unavailable");
  return {setup:setup.replace("create function pg_temp","create or replace function pg_temp")
    .replace("c.relkind in ('r','p');","c.relkind in ('r','p') and c.relname not in ('recommendation_lab_items','recommendation_lab_runs');")
    .replace("p.prokind='f';","p.prokind='f' and p.proname<>'recommendation_lab_worker';"),
    assertion};
}
const consumerPaths=[
  "client/src/pages/media-detail.tsx","client/src/lib/similar-media.ts","client/src/hooks/use-similar-media.ts",
  "client/src/components/more-like-this.tsx","supabase/functions/conversational-search/index.ts",
  "supabase/functions/media-search/index.ts","supabase/functions/rebuild-recommendations/index.ts",
  "supabase/functions/get-recommendations/index.ts","supabase/functions/_shared/canonical-media.ts",
  "supabase/functions/_shared/media-fingerprint.ts",
];
export async function consumerHashes(){
  return Object.fromEntries(await Promise.all(consumerPaths.map(async p=>[p,digest(await readFile(p))])));
}
export async function functionMetadata(){
  return (await management("/functions")).filter((f:any)=>f.slug!=="admin-recommendation-lab")
    .map((f:any)=>({id:f.id,slug:f.slug,version:f.version,status:f.status,verify_jwt:f.verify_jwt}))
    .sort((a:any,b:any)=>a.slug.localeCompare(b.slug));
}
export async function proofFile(name:string,data:any){
  await mkdir(EVIDENCE,{recursive:true});
  await writeFile(`${EVIDENCE}/${name}.json`,JSON.stringify(data,null,2));
}
export async function actorId(){
  const rows=await query("select id from public.users where is_admin is true and coalesce(is_persona,false) is false order by created_at,id limit 1");
  if(!rows[0]?.id)throw new Error("No human admin available");
  return rows[0].id as string;
}
export function managementStore(actor:string){
  if(!/^[a-f0-9-]{36}$/i.test(actor))throw new Error("Invalid actor");
  return async(action:string,payload:Record<string,any>={})=>{
    if(!/^[a-z_]+$/.test(action))throw new Error("Invalid action");
    // Base64 contains no SQL metacharacters, regardless of profile/feedback text.
    const encoded=Buffer.from(JSON.stringify(payload)).toString("base64");
    const result=await query(`select public.recommendation_lab_worker('${action}','${actor}'::uuid,
      convert_from(decode('${encoded}','base64'),'UTF8')::jsonb) as result`,false);
    return result[0].result;
  };
}
