// Actual People/FriendsManager controls with isolated auth and network responses.
// No requests, notifications, or blocks are sent to a real account.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium } from "playwright";

const doubles = {
  "@/lib/auth": `const user={id:"viewer"},session={access_token:"fixture"};
    export const useAuth=()=>({user,session});`,
  "@/lib/supabase": `export const supabase={from(table){
    const q={select(){return q},or(value){q.filter=value;return q},limit(){return q},
      eq(){return q},maybeSingle(){return q},
      then(resolve,reject){return Promise.resolve().then(()=>{
        if(table!=="friendships")throw Error("Unexpected table "+table);
        const person=window.fx.people.find(p=>q.filter.includes("."+p.id+")"));
        if(person?.id==="lookup-error"&&window.fx.lookupError)return {data:null,error:Error("Lookup unavailable")};
        const status=window.fx.status[person?.id];
        return {data:status?[{status}]:[],error:null};
      }).then(resolve,reject)}};return q}};`,
  "@/hooks/use-toast": `export const useToast=()=>({toast:message=>window.fx.toasts.push(message)});`,
  "@/hooks/use-blocked-users": `export const useBlockedUserProfiles=()=>({
    blockedUsers:{isSuccess:true,isLoading:false,isError:false},blockedUserIds:[],isLoading:false,error:null});`,
  "@/hooks/use-friends-management": `export const useFriendsManagement=()=>({
    friendsData:{friends:window.fx.people.filter(p=>p.is_friend).map(p=>({id:"relation-"+p.id,friend:p}))},
    pendingData:{requests:[]},isLoadingFriends:false,
    useUserSearch:()=>({data:{users:[]},isLoading:false}),
    sendRequestMutation:{mutate(){},isPending:false},acceptRequestMutation:{mutate(){},isPending:false},
    rejectRequestMutation:{mutate(){},isPending:false}
  });`,
  "@/lib/share": `export const APP_BASE="https://fixture.invalid";`,
  "@/components/navigation": `export default function Navigation(){return null}`,
  "@/components/follow-creators-card": `export default function Card(){return null}`,
  "@/components/blocked-people-list": `export const BlockedPeopleList=()=>null;`,
  "@/components/block-user-sheet": `export const BlockUserSheet=()=>null;`,
  "@/components/feed-identity-hero": `export const IdentityFace=()=>null;`,
  "@/components/quick-add-list-sheet": `export const QuickAddListSheet=()=>null;`,
};
const profileSource = await readFile("client/src/pages/user-profile.tsx", "utf8");
const optionsButtonStart = profileSource.lastIndexOf("              {!isOwnProfile && user && (", profileSource.indexOf('data-testid="button-profile-options"'));
const optionsButtonEnd = profileSource.indexOf("\n              )}", optionsButtonStart) + "\n              )}".length;
const optionsSheetStart = profileSource.indexOf('      <Sheet open={isProfileOptionsOpen}');
const optionsSheetEnd = profileSource.indexOf("      </Sheet>", optionsSheetStart) + "      </Sheet>".length;
assert.ok(optionsButtonStart > 0 && optionsSheetStart > 0);
const profileOptionsButton = profileSource.slice(optionsButtonStart, optionsButtonEnd);
const profileOptionsSheet = profileSource.slice(optionsSheetStart, optionsSheetEnd);
const bundle = await build({
  stdin: {
    contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
      import People from "./client/src/pages/people";
      import {Sheet,SheetContent,SheetTitle} from "./client/src/components/ui/sheet";
      import {MoreHorizontal,Flag,Ban} from "lucide-react";
      function ProfileOptionsExcerpt(){
        const [isOwnProfile,setOwn]=React.useState(false);
        const [isProfileOptionsOpen,setIsProfileOptionsOpen]=React.useState(false);
        const [isBlockConfirmOpen,setIsBlockConfirmOpen]=React.useState(false);
        const [isReportUserOpen,setIsReportUserOpen]=React.useState(false);
        const user={id:"viewer"},userProfileData={id:"profile-target",user_name:"friend",display_name:"Friend"};
        return <section className="bg-violet-900 p-5">
          ${profileOptionsButton}
          ${profileOptionsSheet}
          {isBlockConfirmOpen&&<p data-testid="block-confirm-target">{userProfileData.id}</p>}
          <button onClick={()=>setOwn(true)}>Show own profile fixture</button>
        </section>;
      }
      const people=[
        ["alex","Alex",82,true],["morgan","Morgan",76,true],
        ["casey","Casey",94],["drew","Drew",91],["jamie","Jamie",80],
        ["pending","Parker",77],["lookup-error","Taylor",75],["existing","Sam",74],
      ].map(([id,first_name,match_score,is_friend])=>({id,first_name,last_name:"Tester",
        user_name:first_name.toLowerCase(),display_name:first_name+" Tester",match_score,is_friend,
        shared_titles:[{title:"A shared story",image_url:"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="}]}));
      window.fx={people,status:{pending:"pending",existing:"accepted"},requests:[],toasts:[],
        lookupError:true,failNext:false};
      window.fetch=async(input,init)=>{
        const url=new URL(String(input),location.href),body=init?.body?JSON.parse(init.body):{};
        const endpoint=url.pathname.split("/").at(-1);
        if(endpoint==="people-affinity")return Response.json({ready:true,has_more:false,
          bands:[{id:"your-people",people}]});
        if(endpoint==="people-tribes")return Response.json({readiness:{ready:true},tribes:[]});
        if(endpoint==="manage-friendships"){
          window.fx.requests.push(body);
          await new Promise(resolve=>setTimeout(resolve,80));
          if(window.fx.failNext){window.fx.failNext=false;return Response.json({error:"Fixture request failure"},{status:500});}
          window.fx.status[body.friendId]="pending";
          return Response.json({success:true});
        }
        throw Error("Unexpected fixture endpoint "+endpoint);
      };
      createRoot(document.getElementById("root")).render(
        <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>
          <People/><ProfileOptionsExcerpt/>
        </QueryClientProvider>);
    `,
    resolveDir: process.cwd(), loader: "tsx",
  },
  bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
  define: { "import.meta.env": '{"VITE_SUPABASE_URL":"https://fixture.invalid"}' },
  plugins: [{ name: "isolated-people-services", setup(api) {
    api.onResolve({ filter: /.*/ }, args => args.path in doubles ? { path: args.path, namespace: "double" } : undefined);
    api.onLoad({ filter: /.*/, namespace: "double" }, args => ({ contents: doubles[args.path], loader: "js" }));
  } }],
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/people`,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>[...document.querySelectorAll("style")].some(n=>n.textContent.includes(".flex-col")));
  const css=await page.locator("style").allTextContents();
  await page.goto("about:blank");
  await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.join("\n")}</style><div id="root"></div>`);
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const compare=page.getByRole("link",{name:"Compare DNA with Morgan Tester"});
  await compare.waitFor({timeout:10000}).catch(async error=>{
    console.error("Fixture errors:",errors);
    console.error("Fixture content:",await page.locator("body").innerText());
    throw error;
  });
  assert.equal(await compare.getAttribute("href"),"/dna?tab=compare&friend=morgan");
  assert.equal(await page.getByRole("link",{name:"Compare DNA with Alex Tester"}).getAttribute("href"),"/dna?tab=compare&friend=alex");
  assert.equal(await page.getByRole("button",{name:/^Block /}).count(),0);
  assert.equal(await page.getByRole("link",{name:/Compare DNA with/}).count(),2);
  assert.equal(await compare.textContent(),"Compare DNA");
  const friendsHeading=page.getByRole("heading",{name:"Your Friends",exact:true});
  await friendsHeading.waitFor();
  await page.getByText("YOUR CLOSEST MATCH",{exact:true}).waitFor();
  await page.getByText("The friend whose Entertainment DNA™ Profile is most like yours.",{exact:true}).waitFor();
  await page.getByText("MOST ALIGNED",{exact:true}).waitFor();
  assert.equal(await friendsHeading.evaluate(node=>getComputedStyle(node).marginBottom),"8px");
  assert.deepEqual(
    await friendsHeading.evaluate(node=>{const style=getComputedStyle(node);return [style.fontFamily,style.fontSize,style.fontWeight];}),
    await page.getByRole("heading",{name:"Your circle.",exact:true}).evaluate(node=>{const style=getComputedStyle(node);return [style.fontFamily,style.fontSize,style.fontWeight];}),
  );
  const pending=page.getByRole("button",{name:"Friend request pending with Parker T."});
  await pending.waitFor();
  assert.equal(await pending.isDisabled(),true);
  assert.equal(await page.getByRole("link",{name:"View Sam T.'s profile"}).count(),1);
  const add=page.getByRole("button",{name:"Add Jamie T. as a friend"});
  await add.waitFor();
  await add.click();
  await page.getByRole("button",{name:"Friend request pending with Jamie T."}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.fx.requests),[{action:"sendRequest",friendId:"jamie"}]);
  await page.getByRole("button",{name:"Retry connection status for Taylor T."}).waitFor();
  await page.evaluate(()=>{window.fx.lookupError=false;window.fx.failNext=true;});
  await page.getByRole("button",{name:"Retry connection status for Taylor T."}).click();
  const retryAdd=page.getByRole("button",{name:"Add Taylor T. as a friend"});
  await retryAdd.waitFor();
  await retryAdd.click();
  await page.waitForFunction(()=>window.fx.toasts.some(t=>t.variant==="destructive"));
  await retryAdd.waitFor({state:"visible"});
  await retryAdd.click();
  await page.getByRole("button",{name:"Friend request pending with Taylor T."}).waitFor();
  assert.equal(await page.evaluate(()=>window.fx.requests.filter(r=>r.friendId==="lookup-error").length),2);
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}px overflow`);
  }
  await page.setViewportSize({width:390,height:1100});
  await compare.scrollIntoViewIfNeeded();
  await page.screenshot({path:"/tmp/people-friend-actions.png"});
  await page.getByTestId("button-profile-options").click();
  await page.getByRole("button",{name:"Block this user",exact:true}).click();
  await page.getByTestId("block-confirm-target").waitFor();
  assert.equal(await page.getByTestId("block-confirm-target").textContent(),"profile-target");
  await page.getByRole("button",{name:"Show own profile fixture"}).click();
  assert.equal(await page.getByTestId("button-profile-options").count(),0);
  assert.deepEqual(errors,[]);
  console.log("PASS: actual People page; friend-specific Compare links; no People Block actions; direct request, pending, accepted, lookup failure, save failure/retry; 320/390/768px layouts; actual profile options opens Block confirmation, hidden for own profile. No live account writes.");
} finally {await browser.close();}
