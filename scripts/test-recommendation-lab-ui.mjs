// Browser-only contract test. Authentication and API transport are mocked in an
// isolated temporary Vite server; the real application/auth are never bypassed.
import assert from "node:assert/strict";
import { mkdtemp,mkdir,writeFile,rm } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import { actorId,managementStore,EVIDENCE } from "./lib/recommendation-lab-admin.ts";
import { SOURCES } from "../supabase/functions/_shared/recommendation-lab-manifest.ts";
import { rankLab } from "../supabase/functions/_shared/recommendation-lab-ranking.ts";

const root=process.cwd();
await mkdir(path.join(root,"node_modules/.cache"),{recursive:true});
await mkdir(EVIDENCE,{recursive:true});
const temp=await mkdtemp(path.join(root,"node_modules/.cache/lab-ui-"));
const actor=await actorId(),state=await managementStore(actor)("dataset");
state.sources=SOURCES;state.viewer_id=actor;state.stage="automated_ui_fixture";
state.ledger.progress.preparation_complete=true;
const source=state.items.find(w=>w.verification.source_key==="animals-film");
assert.ok(source,"Prepare a verified source before running this UI test");
if(!state.runs.length){
  const structured=rankLab(source,state.items,false),semantic=rankLab(source,state.items,true);
  state.runs=[{id:"00000000-0000-4000-8000-000000000001",created_by:actor,source_item_id:source.id,
    label:"AUTOMATED UI FIXTURE — not a CURRENT capture",configuration:{sourceKey:"animals-film"},
    diagnostics:{baseline_generated:[]},evaluations:{},status:"complete",
    results:{current:structured.slice(0,2).map(r=>({...r,score:null})),structured,semantic}}];
}
await writeFile(`${temp}/auth.ts`,`export const useAuth=()=>(${JSON.stringify({user:{id:actor},session:{user:{id:actor},access_token:"test-only-not-a-session"},loading:false})});`);
await writeFile(`${temp}/supabase.ts`,`
const chain={select(){return this},eq(){return this},abortSignal(){return this},maybeSingle:async()=>({data:{id:${JSON.stringify(actor)},is_admin:true},error:null})};
export const supabase={from:()=>chain,functions:{invoke:async(_name,options)=>{const r=await fetch("/test-lab-api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(options.body)});const data=await r.json();return r.ok?{data,error:null}:{data:null,error:{message:data.error}}}}};`);
await writeFile(`${temp}/index.html`,'<html><head></head><body><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>');
await writeFile(`${temp}/entry.tsx`,`
import React from "react";import{createRoot}from"react-dom/client";import{QueryClient,QueryClientProvider}from"@tanstack/react-query";
import Page from ${JSON.stringify(path.join(root,"client/src/pages/admin-recommendation-lab.tsx"))};
import ${JSON.stringify(path.join(root,"client/src/index.css"))};
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Page/></QueryClientProvider>);`);
const actions=[];let failNext=false;
const server=await createServer({configFile:false,root:temp,cacheDir:`${temp}/.vite`,
optimizeDeps:{include:["react","react-dom/client","react/jsx-dev-runtime","@tanstack/react-query","wouter","lucide-react"]},
plugins:[react(),{name:"test-transport",configureServer(vite){
  vite.middlewares.use("/test-lab-api",(req,res)=>{
    let body="";req.on("data",chunk=>{body+=chunk;});req.on("end",()=>{
      const input=JSON.parse(body);actions.push(input.action);res.setHeader("Content-Type","application/json");
      if(input.action==="state"){res.end(JSON.stringify(state));return;}
      if(input.action==="evaluate"){
        if(failNext){failNext=false;res.statusCode=400;res.end('{"error":"Deliberate failed save"}');return;}
        const run=state.runs.find(r=>r.id===input.runId);assert.ok(run);
        run.evaluations[`${input.variant}:${input.candidateId}:${actor}`]={...input,reviewer_id:actor,updated_at:new Date().toISOString()};
        res.end('{"saved":true}');return;
      }
      res.statusCode=400;res.end('{"error":"Unexpected paid/preparation request in browser test"}');
    });
  });
}}],resolve:{alias:[
  {find:"@/lib/auth",replacement:`${temp}/auth.ts`},{find:"@/lib/supabase",replacement:`${temp}/supabase.ts`},
  {find:"@",replacement:path.join(root,"client/src")},{find:"@shared",replacement:path.join(root,"shared")},
]},css:{postcss:root},server:{host:"127.0.0.1",port:5125,strictPort:true,fs:{allow:[root]}}});
let browser;
try{
  await server.listen();browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:5125");
  await page.getByText("Same source. Different evidence paths.").waitFor().catch(async e=>{
    console.log("Browser errors:",errors,"Visible:",(await page.locator("body").innerText()).slice(0,2000));
    throw e;
  });
  assert.deepEqual([...new Set(actions)],["state"],"Mount must not trigger paid/preparation calls");
  assert.ok(await page.getByRole("button",{name:"Preparation complete",exact:true}).isDisabled());
  assert.equal(await page.locator("h3").filter({hasText:/CURRENT|Structured \/ provider|Semantic scoring/}).count(),3);
  await page.getByRole("button",{name:"Inspect scoring trace"}).first().click();
  await page.getByText("Contribution breakdown",{exact:true}).first().waitFor();
  await page.getByRole("button",{name:"Great",exact:true}).first().click();
  await page.getByRole("button",{name:"surprising/great connection",exact:true}).first().click();
  await page.getByPlaceholder("What makes this feel connected, or not?").first().fill("Browser-test note, never written to live feedback.");
  await page.getByRole("button",{name:/Save evaluation|Save changes/}).first().click();
  await page.getByText("Saved for this reviewer within the private admin lab.").first().waitFor();
  const run=state.runs.find(r=>r.configuration.sourceKey==="animals-film");
  assert.ok(Object.values(run.evaluations).some(e=>e.verdict==="Great"&&e.note.includes("Browser-test")));
  failNext=true;await page.getByRole("button",{name:"Bad",exact:true}).first().click();
  await page.getByRole("button",{name:/Save evaluation|Save changes/}).first().click();
  await page.getByText("Deliberate failed save",{exact:true}).waitFor();
  assert.ok(Object.values(run.evaluations).some(e=>e.verdict==="Great"),"A failed save must not alter persisted feedback");
  assert.equal(await page.locator('a[href^="/media/"]').count(),0,"Lab must not launch consumer enrichment");
  await page.screenshot({path:`${EVIDENCE}/desktop-ui.jpg`});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Mobile overflow");
  await page.screenshot({path:`${EVIDENCE}/mobile-ui.jpg`});
  assert.deepEqual(errors,[]);console.log("PASS browser UI: comparison, evidence, save/failure, read-only mount, provider links, mobile layout. Auth/API mocked; lab data read from live storage.");
}finally{await browser?.close();await server.close();await rm(temp,{recursive:true,force:true});}
