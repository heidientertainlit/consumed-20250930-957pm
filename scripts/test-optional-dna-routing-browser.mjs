import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import path from "node:path";

// Real access guards, Terms gate, reminder, guest gate and questionnaire.
// Only account/authentication and transport responses are synthetic.
const root = process.cwd();
const temp = await mkdtemp(path.join(tmpdir(), "optional-dna-"));
const outfile = path.join(temp, "fixture.js");
const entry = `
import React, {useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {Route, Switch, useLocation} from 'wouter';
import {ProtectedRoute, IdentityAwareRoute, PublicOnlyRoute} from '@/components/route-guards';
import {TermsAcceptanceGate} from '@/components/terms-consent';
import {OnboardingResumePrompt} from '@/components/onboarding-resume-prompt';
import OnboardingPage from '@/pages/onboarding';
import UserProfile from '@/pages/user-profile';
import LoginPage from '@/pages/login';
import {FriendDNACompareButton} from '@/components/friend-dna-comparison';
import {QueryClientProvider} from '@tanstack/react-query';
import {queryClient} from '@/lib/queryClient';
import {authNavigationIntent as intent} from '@/lib/auth-navigation-intent';
import {LEGAL_TERMS_VERSION} from '@/lib/legal-terms';
const seed=window.__SEED__ || {};
const user={id:'fixture-user',email:'fixture@example.invalid',app_metadata:{provider:seed.provider||'email'},user_metadata:{}};
const listeners=new Set();
window.fx={
 auth:seed.guest?{user:null,session:null,loading:false}:{user,session:{access_token:'synthetic-session',user},loading:false},
 writes:[],reads:[],routes:[],requests:[],
  profile:seed.incomplete?{id:user.id,first_name:null,last_name:null,user_name:null,identity_confirmed_at:null}:
  {id:user.id,first_name:'Fixture',last_name:'User',user_name:'fixture_user',identity_confirmed_at:'2026-01-01'},
 dna:seed.dna?{user_id:user.id,requires_identity_customization:seed.incomplete!==true,label:'Existing DNA',profile_text:'Never change this.'}:null,
 responses:seed.partial?[{question_id:'q2',answer_text:'Movies'},{question_id:'q3',answer_text:'Drama'},{question_id:'q4',answer_text:'Quiet character stories.'},{question_id:'q5',answer_text:'Characters'}]:[],
 acceptance:seed.termsMissing?null:{terms_version:LEGAL_TERMS_VERSION,accepted_at:'2026-01-01'},
  subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},compareClicks:0,
 setAuth:next=>{window.fx.auth=next;listeners.forEach(fn=>fn())},
 login:()=>{intent.begin(window.location.href);intent.observeAccount(user.id,null,window.location.href);window.fx.setAuth({user,session:{access_token:'synthetic-session',user},loading:false})}
};
window.intent=intent;
if(seed.webReturn){
 if(intent.prepareWebOAuthReturn())intent.finishWebOAuthReturn(!seed.sdkError);
 if(window.fx.auth.user)intent.observeAccount(user.id,null,window.location.href);
 history.replaceState(null,'',window.location.pathname+window.location.search);
}
function Fixture(){
 const [location,setLocation]=useLocation();
 React.useEffect(()=>{window.fx.routes.push(location)},[location]);
  return <QueryClientProvider client={queryClient}><TermsAcceptanceGate><Switch>
  <Route path="/login"><PublicOnlyRoute>{seed.realLogin?<LoginPage/>:<button onClick={()=>window.fx.login()}>Authenticate fixture</button>}</PublicOnlyRoute></Route>
 <Route path="/onboarding"><ProtectedRoute><OnboardingPage/></ProtectedRoute></Route>
  <Route path="/profile"><ProtectedRoute>{seed.realProfile?<UserProfile/>:<><h1>DNA page fixture</h1><button onClick={()=>setLocation('/onboarding?resume=dna')}>Finish My DNA</button></>}</ProtectedRoute></Route>
  <Route path="/test-dna-feature"><ProtectedRoute><FriendDNACompareButton friendId="friend-fixture" friendName="Friend" userDnaLevel={seed.dna?(seed.items>=10?2:1):0} userItemCount={seed.items||0} hasSurvey={!!seed.dna} onCompare={()=>{window.fx.compareClicks++}}/></ProtectedRoute></Route>
 <Route path="/activity"><IdentityAwareRoute><h1>NOW fixture</h1><OnboardingResumePrompt userId={window.fx.auth.user?.id}/></IdentityAwareRoute></Route>
 <Route><ProtectedRoute><h1>Destination fixture</h1></ProtectedRoute></Route>
  </Switch></TermsAcceptanceGate></QueryClientProvider>
}
// StrictMode exercises effect replay and one-time redirect consumption.
createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>);
`;
const auth = `
import {useSyncExternalStore} from 'react';
export function useAuth(){const fx=window.fx;return {...useSyncExternalStore(fx.subscribe,()=>fx.auth),startupError:null,retryStartup(){},signOut:async()=>({error:null}),signIn:async()=>({error:null}),signUp:async()=>({error:null}),signInWithOAuth:async()=>({error:null}),resetPassword:async()=>({error:null})}}
`;
const database = `
export const supabase={
 from(table){return query(table)},
 rpc(name){return query(name)},
  auth:{getSession:async()=>({data:{session:window.fx.auth.session},error:null}),getUser:async()=>({data:{user:window.fx.auth.user},error:null}),updateUser:async()=>({data:{user:window.fx.auth.user},error:null})},
  channel(){const channel={on(){return channel},subscribe(){return channel},unsubscribe(){}};return channel},
  removeChannel(){},
 functions:{invoke:async()=>({data:[],error:null})}
};
export const SUPABASE_URL='https://fixture.invalid';
export const SUPABASE_ANON_KEY='fixture-key';
export const getSupabaseFunctionUrl=name=>SUPABASE_URL+'/functions/v1/'+name;
function query(table){
 const state={write:false};
 const proxy=new Proxy({}, {get(_,key){
 if(key==='then')return (resolve,reject)=>{
  const fx=window.fx;
  fx.reads.push(table);
  let data=table==='dna_profiles'?fx.dna:
    ['get_my_account_profile','public_user_profiles','users'].includes(table)?fx.profile:
   table==='account_terms_acceptances'?fx.acceptance:
   table==='user_private_details'?{}:
   table==='edna_responses'?fx.responses:
   table==='edna_questions'?Array.from({length:5},(_,i)=>({id:'q'+(i+1),display_order:i+1,question_text:'Question '+(i+1),options:i===4?['Characters']:[],is_active:true})):
    table==='media_ratings'?[{media_title:'Fixture title',media_type:'movie'}]:state.single?null:[];
  return Promise.resolve({data,error:null}).then(resolve,reject);
 };
  return (...args)=>{if(['single','maybeSingle'].includes(String(key)))state.single=true;if(['insert','upsert','update','delete'].includes(String(key))){window.fx.writes.push({table,operation:key,payload:args[0]})}return proxy}
 }});
 return proxy;
}
`;
let server, browser;
try {
  await build({
    stdin: { contents: entry, resolveDir: root, sourcefile: "optional-dna-fixture.tsx", loader: "tsx" },
    outfile, bundle: true, platform: "browser", format: "esm", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"', "import.meta.env": '{}', "import.meta.env.VITE_SUPABASE_URL": '"https://fixture.invalid"', "import.meta.env.VITE_SUPABASE_ANON_KEY": '"fixture-key"', "import.meta.env.VITE_APP_URL": '"https://fixture.invalid"' },
    loader: { ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl", ".css": "empty" },
    plugins: [{
      name: "isolated-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/(?:auth|supabase)$/ }, args => ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path.endsWith("/auth") ? auth : database, loader: "js", resolveDir: root }));
        builder.onResolve({ filter: /^@\// }, args => {
          const base = path.join(root, "client/src", args.path.slice(2));
          return { path: [base, ...[".ts",".tsx",".js","/index.ts","/index.tsx"].map(ext=>base+ext)].find(existsSync) || base };
        });
      },
    }],
  });
  const js = await readFile(outfile);
  server = createServer((req, res) => {
    if (req.url === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(js); }
    else { res.setHeader("Content-Type", "text/html"); res.end('<div id="root"></div><script type="module" src="/fixture.js"></script>'); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const cases = [];
  async function run(name, seed, start, check) {
    const context = await browser.newContext();
    const errors = [], requests = [];
    await context.addInitScript(value => {
      window.__SEED__ = value;
      if (value.partial || value.dna) localStorage.setItem("consumed_onboarding_progress:fixture-user", JSON.stringify({step:"drivers",updatedAt:"2026-01-01"}));
      if (value.stale) {
        sessionStorage.setItem("returnUrl", "/profile");
        sessionStorage.setItem("identityReturnUrl", "/onboarding");
      }
      if(value.webReturn){
        const revision='fixture-revision';
        localStorage.setItem('consumed_navigation_invalidation',revision);
        sessionStorage.setItem('consumed_auth_navigation_intent',JSON.stringify({
          id:'fixture-attempt',path:'/play?challenge=oauth&sender=friend#result',createdAt:Date.now(),
          phase:'auth',userId:value.owner||null,
          webOAuthStartedAt:Date.now()-(value.expired?10*60*1000:1000),webOAuthRevision:revision
        }));
        if(value.invalidated)localStorage.setItem('consumed_navigation_invalidation','new-revision');
      }
    }, seed);
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === origin) return route.continue();
      requests.push(url.pathname);
      // No real backend, image host, analytics or identity provider is reachable.
      if (url.hostname === "fixture.invalid" || url.hostname === "mahpgcogwpawvviapqza.supabase.co") {
        if (url.pathname.endsWith("generate-dna-profile")) return route.fulfill({json:{label:"Generated fixture DNA",tagline:"Explicit generation only",profile_text:"Fixture result."}});
        if (url.pathname.endsWith("get-user-lists-with-media")) return route.fulfill({json:{lists:[]}});
        return route.fulfill({json:{available:true,success:true,lists:[],ranks:[],predictions:[],points:0,badges:[],highlights:[],creators:[],friends:[],requests:[],items_logged:seed.items||0,stats:{moviesWatched:seed.items||0,tvShowsWatched:0,booksRead:0,gamesPlayed:0}}});
      }
      return route.abort();
    });
    await page.goto(origin + start);
    try {
      await check(page, context);
      assert.deepEqual(errors, []);
      if (seed.realProfile) assert.equal(requests.some(p=>p.includes("/generate-dna-")),false);
      cases.push(name);
      console.log("PASS", name);
    } catch (error) {
      console.error(name, page.url(), await page.evaluate(()=>({routes:window.fx?.routes,reads:window.fx?.reads,intent:window.intent?.peek()})),errors);
      throw error;
    } finally { await context.close(); }
  }
  const noWrites = async page => assert.deepEqual(await page.evaluate(()=>window.fx.writes), []);
  for (const [name, seed] of [
    ["new authenticated email account, no DNA", {}],
    ["returning account, no DNA, stale destination ignored", {stale:true}],
    ["partial DNA", {partial:true}],
    ["completed DNA", {dna:true}],
    ["Google account missing identity", {provider:"google",incomplete:true}],
    ["Apple account missing identity", {provider:"apple",incomplete:true,dna:true}],
  ]) {
    await run(name, seed, "/login", async page => {
      await page.getByRole("heading",{name:"NOW fixture"}).waitFor();
      await page.waitForTimeout(100);
      assert.equal(new URL(page.url()).pathname,"/activity");
      assert.equal((await page.evaluate(()=>window.fx.reads)).includes("get_my_account_profile"),false);
      await noWrites(page);
      if(seed.partial||seed.dna)assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("consumed_onboarding_progress:fixture-user")).step),"drivers");
      assert.equal(await page.evaluate(()=>localStorage.getItem("consumed_onboarding_completed:fixture-user")),null);
    });
  }
  await run("reproduced existing-DNA/incomplete-identity state does not loop", {dna:true,incomplete:true}, "/profile", async page=>{
    await page.getByRole("heading",{name:"DNA page fixture"}).waitFor();
    await page.waitForTimeout(150);
    assert.equal(new URL(page.url()).pathname,"/profile");
    assert.equal((await page.evaluate(()=>window.fx.routes)).some(p=>p.startsWith("/onboarding")),false);
    await noWrites(page);
  });
  await run("protected deep link survives authentication with query and hash once", {guest:true}, "/play?challenge=exact&sender=friend#result", async page=>{
    await page.getByRole("button",{name:"Authenticate fixture"}).waitFor();
    await page.getByRole("button",{name:"Authenticate fixture"}).click();
    await page.getByRole("heading",{name:"Destination fixture"}).waitFor();
    assert.equal(new URL(page.url()).pathname+new URL(page.url()).search+new URL(page.url()).hash,"/play?challenge=exact&sender=friend#result");
    assert.equal(await page.evaluate(()=>window.intent.peek()),null);
    await noWrites(page);
  });
  await run("NOW reminder opens DNA page, not questionnaire", {}, "/activity", async page=>{
    await page.getByRole("button",{name:/Continue setup/}).click();
    await page.getByRole("heading",{name:"DNA page fixture"}).waitFor();
    assert.equal((await page.evaluate(()=>window.fx.routes)).some(p=>p.startsWith("/onboarding")),false);
  });
  await run("a browser tab cannot consume or erase another tab's destination", {guest:true}, "/play?challenge=tab-one", async (page,context)=>{
    await page.getByRole("button",{name:"Authenticate fixture"}).waitFor();
    const other = await context.newPage();
    await other.route("**/*", route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await other.goto(origin+"/login");
    await other.getByRole("button",{name:"Authenticate fixture"}).click();
    await other.getByRole("heading",{name:"NOW fixture"}).waitFor();
    await page.getByRole("button",{name:"Authenticate fixture"}).click();
    await page.getByRole("heading",{name:"Destination fixture"}).waitFor();
    assert.equal(new URL(page.url()).search,"?challenge=tab-one");
    await other.close();
  });
  await run("questionnaire resumes saved answers/progress without writes", {partial:true}, "/onboarding?resume=dna", async page=>{
    await page.getByRole("button",{name:"Discover Your DNA"}).waitFor();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("consumed_onboarding_progress:fixture-user")).step),"drivers");
    await noWrites(page);
  });
  await run("explicit questionnaire completion returns to DNA page", {partial:true}, "/onboarding?resume=dna", async page=>{
    await page.getByRole("button",{name:"Discover Your DNA"}).click();
    await page.getByText("Generated fixture DNA",{exact:true}).waitFor();
    await page.getByRole("button",{name:/Make your DNA yours/}).click();
    await page.getByRole("button",{name:"Skip for now",exact:true}).click();
    await page.getByRole("heading",{name:"DNA page fixture"}).waitFor();
    assert.equal(new URL(page.url()).pathname,"/profile");
    assert.equal((await page.evaluate(()=>window.fx.writes)).filter(w=>w.table==="edna_responses").length,1);
  });
  await run("existing generated DNA re-entry does not reset progress or generate", {dna:true,partial:true}, "/onboarding?resume=dna", async page=>{
    await page.getByRole("heading",{name:/What do you love/}).waitFor();
    assert.equal(await page.evaluate(()=>window.fx.dna.profile_text),"Never change this.");
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("consumed_onboarding_progress:fixture-user")).step),"drivers");
    await noWrites(page);
  });
  await run("Terms still blocks access when agreement is missing", {termsMissing:true}, "/activity", async page=>{
    await page.getByRole("button",{name:/accept|agree/i}).first().waitFor();
    assert.equal(await page.getByRole("heading",{name:"NOW fixture"}).count(),0);
    await noWrites(page);
  });
  for(const [name,seed] of [["no DNA",{}],["partial DNA",{partial:true}],["completed DNA",{dna:true}]]){
    await run("direct authenticated NOW: "+name,seed,"/activity",async page=>{
      await page.getByRole("heading",{name:"NOW fixture"}).waitFor();
      await page.waitForTimeout(150);
      assert.equal(new URL(page.url()).pathname,"/activity");
      assert.equal((await page.evaluate(()=>window.fx.routes)).some(p=>p.startsWith("/onboarding")),false);
      await noWrites(page);
    });
  }
  await run("real DNA page Finish My DNA opens voluntary questionnaire",{realProfile:true},"/profile",async page=>{
    await page.getByRole("button",{name:"Finish My DNA",exact:true}).first().click();
    await page.waitForURL("**/onboarding?resume=dna");
    assert.equal(new URL(page.url()).pathname+new URL(page.url()).search,"/onboarding?resume=dna");
    await noWrites(page);
  });
  await run("real profile with existing DNA and incomplete identity does not loop",{realProfile:true,dna:true,incomplete:true},"/profile",async page=>{
    await page.getByTestId("nav-dna-profile").waitFor();
    await page.getByText("Your DNA might be hinting at…",{exact:true}).waitFor();
    await page.waitForTimeout(200);
    assert.equal(new URL(page.url()).pathname,"/profile");
    assert.equal((await page.evaluate(()=>window.fx.routes)).some(p=>p.startsWith("/onboarding")),false);
    await noWrites(page);
  });
  for(const [label,seed,enabled] of [
    ["no DNA",{items:20},false],["insufficient DNA",{dna:true,items:9},false],["eligible DNA",{dna:true,items:10},true]
  ]){
    await run("real comparison feature eligibility: "+label,seed,"/test-dna-feature",async page=>{
      const button=page.getByRole("button",{name:"Compare DNA",exact:true});
      assert.equal(await button.isEnabled(),enabled);
      if(enabled){await button.click();assert.equal(await page.evaluate(()=>window.fx.compareClicks),1)}
      else {assert.match(await button.getAttribute("title"),seed.dna?/Track 1 more items/:/Finish your Entertainment DNA/)}
      await noWrites(page);
    });
  }
  await run("web OAuth exact login restores parameters once",{webReturn:true},"/login#access_token=synthetic&refresh_token=synthetic",async page=>{
    await page.getByRole("heading",{name:"Destination fixture"}).waitFor();
    assert.equal(new URL(page.url()).pathname+new URL(page.url()).search+new URL(page.url()).hash,"/play?challenge=oauth&sender=friend#result");
    assert.equal(await page.evaluate(()=>window.intent.peek()),null);
  });
  for(const seed of [
    {webReturn:true,sdkError:true},{webReturn:true,expired:true},{webReturn:true,invalidated:true},{webReturn:true,owner:"different-user"}
  ]){
    await run("unsafe web OAuth return falls back to NOW: "+JSON.stringify(seed),seed,"/login#access_token=synthetic&refresh_token=synthetic",async page=>{
      await page.getByRole("heading",{name:"NOW fixture"}).waitFor();
      assert.equal(await page.evaluate(()=>window.intent.peek()),null);
    });
  }
  for(const suffix of ["","?error=access_denied"]){
    await run("ordinary/error return cannot inherit pending web destination "+suffix,{webReturn:true},"/login"+suffix,async page=>{
      await page.getByRole("heading",{name:"NOW fixture"}).waitFor();
      assert.equal(await page.evaluate(()=>window.intent.peek()),null);
    });
  }
  await run("real login Back/bfcache cancellation clears the pending destination",{guest:true,realLogin:true},"/login",async page=>{
    await page.getByRole("button",{name:"Continue with Google"}).waitFor();
    await page.evaluate(()=>{
      const login=window.intent.login("/play?challenge=cancelled");
      window.intent.beginWebOAuth(login);
      const event=new Event("pageshow");Object.defineProperty(event,"persisted",{value:true});window.dispatchEvent(event);
    });
    assert.equal(await page.evaluate(()=>window.intent.peek()),null);
  });
  console.log("Passed", cases.length, "isolated browser cases. Live OAuth, email delivery and physical-device handoff are not exercised.");
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve=>server.close(resolve));
  await rm(temp,{recursive:true,force:true});
}
