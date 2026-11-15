import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(join(tmpdir(), "rating-card-layout-"));
const feed = await readFile(join(root, "client/src/pages/feed.tsx"), "utf8");
const parsed = ts.createSourceFile("feed.tsx", feed, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let row;
function visit(node) {
  if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(prop =>
    ts.isJsxAttribute(prop) && prop.name.getText(parsed) === "data-testid" &&
    prop.initializer?.getText(parsed) === '"rating-card-actions"')) row = node.getText(parsed);
  ts.forEachChild(node, visit);
}
visit(parsed);
assert(row, "Extract the actual production action row rather than a reproduction");
const clashSource = await readFile(join(root, "client/src/components/dna-clash-feed-card.tsx"), "utf8");
const clashParsed = ts.createSourceFile("clash.tsx", clashSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let clashField, clashVotes;
function visitClash(node) {
  if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(prop =>
    ts.isJsxAttribute(prop) && prop.name.getText(clashParsed) === "data-testid" &&
    prop.initializer?.getText(clashParsed) === '"clash-comment-field"')) clashField = node.getText(clashParsed);
  if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(prop =>
    ts.isJsxAttribute(prop) && prop.name.getText(clashParsed) === "data-testid" &&
    prop.initializer?.getText(clashParsed) === '"clash-vote-controls"')) clashVotes = node.getText(clashParsed);
  ts.forEachChild(node, visitClash);
}
visitClash(clashParsed);
assert(clashField, "Use the actual DNA Clash comment field");
assert(clashVotes, "Use the actual DNA Clash voting buttons");
const entry = `
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThumbsUp, ThumbsDown, MessageCircle, Star, Send } from "lucide-react";
import Header from "${root}/client/src/components/rating-card-header-controls.tsx";
import Field from "${root}/client/src/components/rating-comment-field.tsx";
import { FeedConversationSection } from "${root}/client/src/components/feed-conversation-section.tsx";
import { FeedSpoilerDiscussion } from "${root}/client/src/components/feed-spoiler-discussion.tsx";
const params = new URLSearchParams(location.search);
const session = params.has("guest") ? null : {access_token:"isolated-fixture",user:{id:"viewer"}};
window.requests = []; window.actions = []; window.bubbles = 0;
window.fetch = async (url, init) => {
  window.requests.push(String(url));
  return new Response(JSON.stringify({friends:[]}),{status:200,headers:{"Content-Type":"application/json"}});
};
function App() {
  const [discussionScope,setDiscussionScope]=useState("review-1");
  const [isLiked,setLiked]=useState(false), [localReaction,setReaction]=useState(null);
  const [dislikeCount,setDislikeCount]=useState(0), [whoReactedOpen,setWhoReactedOpen]=useState(false);
  const [replyOpen,setReplyOpen]=useState(params.has("open"));
  const [,setShowComments]=useState(false), [,setShowCounterPrompt]=useState(false);
  const [showInlineRater,setShowInlineRater]=useState(false), [commentText,setCommentText]=useState("");
  const [submitting,setSubmitting]=useState(false), [notice,setNotice]=useState("");
  const [comments,setComments]=useState(params.has("empty") ? [] : [{
    id:"comment:comment-1",userId:"friend",name:"Jamie E.",content:"I finished this last night and loved it!",
    likes:0,isLiked:false,kind:"comment",threadPostId:"review-1",
  }]);
  const takeBarRef=useRef(null), post={likes:isLiked?1:0}, isOtherUser=!params.has("owner");
  const ratingSubmitted=false;
  const handleReaction=(direction)=>{window.actions.push(direction);if(direction==="up")setLiked(v=>!v);else{setReaction(v=>v==="down"?null:"down");setDislikeCount(v=>v?0:1);}};
  const act=(value)=>{window.actions.push(value);setNotice(value);};
  const send=async()=>{if(!commentText.trim()||submitting)return;setSubmitting(true);setComments(v=>[...v,{id:"comment:"+Date.now(),userId:"viewer",name:"You",content:commentText.trim(),likes:0,isLiked:false,kind:"comment",threadPostId:"review-1"}]);setCommentText("");setSubmitting(false);};
  const commentMutation={isPending:submitting,mutate:send};
  const [voted,setVoted]=useState("amber");
  const user1={username:"amber"},user2={username:"kimberly"},name1="Amber M.",name2="Kimberly W.",isVoting=false;
  const handleVote=(username)=>setVoted(username);
  const extraRatings=params.has("ratings")?Array.from({length:15},(_,i)=>({
    id:"rating:peer-"+i,userId:"peer-"+i,name:["Lindsie D.","Maddie C.","Ashley H."][i]||"Taylor "+i+".",
    rating:i===0||i===1||i>2&&i%2===0?5:4.5,kind:"rating",likes:0,isLiked:false,
    content:i===2?"My favorite of the trilogy.":undefined,postId:i===2?"ashley-review":undefined,
    children:i===2?[{id:"comment:ashley-child",userId:"friend-2",name:"Robin S.",kind:"comment",content:"Reply to Ashley's review",likes:0,isLiked:false,threadPostId:"ashley-review"}]:[],
  })):[];
  return <main className="min-h-screen bg-[#f8f6f8] px-3 py-4">
    <article className="relative mx-auto max-w-[560px] rounded-2xl bg-white shadow-sm" onClick={()=>window.bubbles++}>
      <Header onShare={()=>act("share")} onNext={params.has("single")?undefined:()=>act("next")}
        onReport={session&&!params.has("owner")?()=>act("report"):undefined}
        onDelete={session&&params.has("owner")?()=>act("delete"):undefined}/>
      <div className="h-11"/>
      <div className="mx-4 flex gap-3 pt-2 pb-1">
        <div data-testid="poster" className="flex h-[180px] w-[120px] shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-800">BOOK</div>
        <div><p className="text-sm font-semibold">Hillary H.</p><h2 className="mt-2 text-[15px] font-bold">The Most Wonderful Crime of the Year</h2><p className="mt-2 text-[14px]">“Fun mystery with some romance!”</p></div>
      </div>
      ${row}
      {showInlineRater&&<p role="status" className="px-4 text-sm">Rating control opened</p>}
      <FeedSpoilerDiscussion discussionId="review-1">
        <FeedConversationSection entries={[...extraRatings,...comments]} scopeKey={discussionScope} expanded={true} onExpand={()=>{}}
          canInteract={!!session} currentUserId={session?.user.id}
          onVote={()=>act("comment-vote")} onReply={entry=>{window.replyTargets=[...(window.replyTargets||[]),entry.id];act("comment-reply");}}
          onDelete={()=>act("comment-delete")} onReport={()=>act("comment-report")}/>
      </FeedSpoilerDiscussion>
      {params.has("clash")&&<div className="px-4 py-3">${clashVotes}</div>}
      {session&&replyOpen&&<div ref={takeBarRef} className="flex items-center gap-2 px-4 pb-4 pt-2.5" onClick={e=>e.stopPropagation()}>
        {params.has("clash") ? (${clashField}) : <Field value={commentText} onChange={setCommentText} onSubmit={send} session={session} submitting={submitting}/>}
      </div>}
    </article>
    <output className="mx-auto block max-w-[560px] text-sm">{notice}</output>
    {params.has("ratings")&&<button onClick={()=>setDiscussionScope(scope=>scope==="review-1"?"review-2":"review-1")}>Switch review fixture</button>}
  </main>;
}
createRoot(document.getElementById("root")).render(<App/>);
`;
await writeFile(join(temp, "entry.tsx"), entry);
await build({
  entryPoints: [join(temp, "entry.tsx")], bundle: true, write: true,
  outfile: join(temp, "bundle.js"), platform: "browser", format: "esm", jsx: "automatic",
  nodePaths: [join(root, "node_modules")],
  alias: { "@": join(root, "client/src") }, define: { "process.env.NODE_ENV": '"development"' },
});
const sources = await Promise.all([
  "rating-card-header-controls.tsx", "rating-comment-field.tsx", "mention-input.tsx",
  "feed-conversation-section.tsx", "feed-spoiler-text.tsx", "ui/input.tsx", "ui/dropdown-menu.tsx",
].map(file => readFile(join(root, "client/src/components", file), "utf8")));
const css = await postcss([tailwindcss({
  content: [{ raw: entry + sources.join("\n"), extension: "tsx" }], corePlugins: { preflight: true },
})]).process("@tailwind base; @tailwind components; @tailwind utilities;", { from: undefined });
const bundle = await readFile(join(temp, "bundle.js"));
const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style><div id="root"></div><script type="module" src="/bundle.js"></script>`;
const server = createServer((req, res) => {
  res.setHeader("Content-Type", req.url === "/bundle.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/bundle.js" ? bundle : html);
});
await new Promise(resolve => server.listen(5069, "0.0.0.0", resolve));
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [320, 402, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://127.0.0.1:5069/?open", { waitUntil: "networkidle" });
    const options = page.getByRole("button", { name: "Review options", exact: true });
    const share = page.getByRole("button", { name: "Share review", exact: true });
    const next = page.getByRole("button", { name: "Show another review", exact: true });
    await options.waitFor();
    const poster = await page.getByTestId("poster").boundingBox();
    const dot = await options.locator("svg").evaluate(svg => {
      const circle = [...svg.querySelectorAll("circle")].sort((a,b)=>a.cx.baseVal.value-b.cx.baseVal.value)[0];
      return svg.getBoundingClientRect().left + circle.cx.baseVal.value-circle.r.baseVal.value-Number(svg.getAttribute("stroke-width"))/2;
    });
    assert(Math.abs(dot-poster.x-4)<1, "Leftmost dot sits slightly to the right of the poster edge");
    assert.equal(await options.evaluate(el=>getComputedStyle(el).color),"rgb(156, 163, 175)","Original review dots use a lighter gray");
    for (const button of [options, share, next]) {
      const style = await button.evaluate(el => ({radius:getComputedStyle(el).borderRadius,bg:getComputedStyle(el).backgroundColor,height:el.getBoundingClientRect().height}));
      assert.equal(style.radius,"0px");assert.equal(style.bg,"rgba(0, 0, 0, 0)");assert.equal(style.height,44);
    }
    assert(await share.locator("svg.lucide-forward").count(), "Use original forward/share arrow");
    for (const button of [share, next]) {
      const icon = button.locator("svg");
      assert.equal(await icon.evaluate(el=>getComputedStyle(el).color),"rgb(137, 144, 157)");
      assert.equal(await icon.getAttribute("stroke-width"),"1.75");
    }
    const s=await share.boundingBox(),n=await next.boundingBox();assert(n.x-(s.x+s.width)>=6);
    const rowBox=await page.getByTestId("rating-card-actions").boundingBox();
    const actionIcons=[];
    for (const label of ["Like","Dislike","Reply","Rate"]) {
      const icon=page.getByTestId("rating-card-actions").getByRole("button",{name:label,exact:true}).locator("svg");
      assert.equal(await icon.evaluate(el=>getComputedStyle(el).color),"rgb(137, 144, 157)");
      assert.equal(await icon.getAttribute("stroke-width"),"1.75");
      const box=await icon.boundingBox();assert.equal(box.width,18);actionIcons.push(box);
    }
    assert.equal(actionIcons[2].x-actionIcons[1].x,40);
    assert.equal(actionIcons[3].x-actionIcons[2].x,40);
    assert.equal((await page.getByTestId("rating-card-actions").innerText()).trim(),"","Actions are icon-only when there are no counts");
    const commentBox=await page.getByText("I finished this last night and loved it!",{exact:true}).boundingBox();
    const commentThumb=await page.locator('[aria-label="Comment actions"]').first().locator("button").first().locator("svg").boundingBox();
    const commentName=await page.getByText("Jamie E.",{exact:true}).boundingBox();
    assert(Math.abs(commentThumb.x-commentBox.x)<1&&Math.abs(commentThumb.x-commentName.x)<1,"Comment controls align with the name and comment text");
    const discussionBorders=await page.getByRole("region",{name:"Conversation",exact:true}).evaluate(el=>({
      top:getComputedStyle(el).borderTopWidth,bottom:getComputedStyle(el).borderBottomWidth,
    }));
    assert.deepEqual(discussionBorders,{top:"1px",bottom:"0px"},"One divider above comments, none below");
    const fieldBox=await page.getByTestId("rating-comment-input").boundingBox();
    const sendButton=page.getByRole("button",{name:"Send reply",exact:true});
    assert.equal(await sendButton.evaluate(el=>getComputedStyle(el).backgroundColor),"rgba(0, 0, 0, 0)","Send arrow has no filled button");
    assert.equal(await sendButton.locator("svg").getAttribute("stroke-width"),"1.75");
    const pill=await sendButton.locator("..").evaluate(el=>({height:el.getBoundingClientRect().height,border:getComputedStyle(el).borderTopWidth,radius:parseFloat(getComputedStyle(el).borderRadius),background:getComputedStyle(el).backgroundColor}));
    assert.equal(pill.height,36);assert.equal(pill.border,"1px");assert(pill.radius>=18);assert.equal(pill.background,"rgba(0, 0, 0, 0)");
    assert(rowBox.y+rowBox.height<=commentBox.y);assert(commentBox.y<fieldBox.y);
    assert.equal(await page.getByTestId("rating-card-actions").getByRole("button",{name:"Share review"}).count(),0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.getByRole("button",{name:"Review options",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.actions.length),0,"Opening moderation menu performs no action");
  assert.equal(await page.getByRole("menuitem",{name:/share/i}).count(),0);
  await page.getByRole("menuitem",{name:"Report review",exact:true}).click();
  await page.getByRole("button",{name:"Share review",exact:true}).click();
  await page.getByRole("button",{name:"Show another review",exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.actions),["report","share","next"]);
  assert.equal(await page.evaluate(()=>window.bubbles),0,"Header events do not bubble into carousel");
  const commentOptions=page.getByRole("button",{name:"Options for Jamie E.'s comment",exact:true});
  assert.equal(await commentOptions.locator("svg.lucide-ellipsis").count(),1);
  await commentOptions.click();
  assert.deepEqual(await page.evaluate(()=>window.actions),["report","share","next"],"Opening comment options performs no moderation");
  assert.equal(await page.getByRole("menuitem",{name:/Delete/}).count(),0,"Cannot delete another person's comment");
  await page.getByRole("menuitem",{name:"Flag Jamie E.'s comment",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.actions.at(-1)),"comment-report");
  const commentActions=page.locator('[aria-label="Comment actions"]').first();
  assert.equal((await commentActions.innerText()).trim(),"Reply","Zero counts are hidden and Reply is text");
  const commentReply=commentActions.getByRole("button",{name:"Reply to Jamie E.'s comment",exact:true});
  assert.equal(await commentReply.locator("svg").count(),0);
  await commentActions.getByRole("button",{name:"thumbs up on Jamie E.'s comment",exact:true}).click();
  await commentActions.getByRole("button",{name:"thumbs down on Jamie E.'s comment",exact:true}).click();
  await commentReply.click();
  assert.deepEqual(await page.evaluate(()=>window.actions.slice(-3)),["comment-vote","comment-vote","comment-reply"]);
  await page.getByRole("button",{name:"Like",exact:true}).click();
  const thumb=await page.getByRole("button",{name:"Like",exact:true}).locator("svg").boundingBox();
  const count=await page.getByRole("button",{name:"See who liked this",exact:true}).locator("span").boundingBox();
  assert(count.x-(thumb.x+thumb.width)>=0&&count.x-(thumb.x+thumb.width)<=6,"Count is tucked directly to the right of the thumb");
  assert.equal(await page.getByRole("button",{name:"See who liked this",exact:true}).locator("span").evaluate(el=>getComputedStyle(el).color),"rgb(137, 144, 157)");
  assert.equal(await page.getByRole("button",{name:"Like",exact:true}).locator("svg").evaluate(el=>getComputedStyle(el).color),"rgb(17, 24, 39)","Selected thumb retains its dark color");
  await page.getByRole("button",{name:"Dislike",exact:true}).click();
  const rowScope=page.getByTestId("rating-card-actions");
  await rowScope.getByRole("button",{name:"Rate",exact:true}).click();
  await page.getByRole("status").filter({hasText:"Rating control opened"}).waitFor();
  await rowScope.getByRole("button",{name:"Reply",exact:true}).click();
  assert.equal(await page.getByTestId("rating-comment-input").count(),0);
  await rowScope.getByRole("button",{name:"Reply",exact:true}).click();
  await page.getByTestId("rating-comment-input").fill("Reply still works");
  await page.getByRole("button",{name:"Send reply",exact:true}).click();
  await page.getByText("Reply still works",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Options for your comment",exact:true}).click();
  assert.equal(await page.getByRole("menuitem",{name:/Flag/}).count(),0,"Do not flag your own comment");
  await page.getByRole("menuitem",{name:"Delete your comment",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.actions.at(-1)),"comment-delete");
  await page.goto("http://127.0.0.1:5069/?owner&single&empty",{waitUntil:"networkidle"});
  assert.equal(await page.getByRole("button",{name:"Show another review",exact:true}).count(),0);
  await page.getByRole("button",{name:"Review options",exact:true}).click();
  assert.equal(await page.getByRole("menuitem",{name:"Report review",exact:true}).count(),0);
  await page.getByRole("menuitem",{name:"Delete post",exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.actions),["delete"]);
  await page.goto("http://127.0.0.1:5069/?guest",{waitUntil:"networkidle"});
  assert.equal(await page.getByRole("button",{name:"Review options",exact:true}).count(),0);
  assert.equal(await page.getByTestId("rating-comment-input").count(),0);
  assert.equal(await page.getByRole("button",{name:/Options for/}).count(),0,"Guests cannot moderate comments");
  assert.equal(await page.getByRole("button",{name:"Show another review",exact:true}).getAttribute("data-guest-allowed"),"true");
  assert.equal(await page.getByRole("button",{name:"Share review",exact:true}).getAttribute("data-guest-allowed"),null);
  for (const width of [320,402,768]) {
    await page.setViewportSize({width,height:900});
    await page.goto("http://127.0.0.1:5069/?ratings",{waitUntil:"networkidle"});
    const toggle=page.getByTestId("related-ratings-toggle");
    assert.equal(await toggle.getAttribute("aria-expanded"),"false");
    assert.match(await toggle.innerText(),/\+12/);
    assert.match(await toggle.innerText(),/4\.8/);
    assert.equal(await page.getByText("My favorite of the trilogy.",{exact:false}).count(),0);
    assert(await page.getByText("I finished this last night and loved it!",{exact:true}).isVisible(),"Real comments remain visible while ratings are collapsed");
    await toggle.focus();await page.keyboard.press("Enter");
    assert.equal(await toggle.getAttribute("aria-expanded"),"true");
    assert(await page.getByTestId("related-ratings-list").getByText("My favorite of the trilogy.",{exact:false}).isVisible());
    await page.getByRole("button",{name:"Reply to Ashley H.'s review",exact:true}).click();
    assert.equal(await page.evaluate(()=>window.replyTargets.at(-1)),"rating:peer-2","Review replies retain the selected review target");
    await page.getByRole("button",{name:"Reply to Robin S.'s comment",exact:true}).click();
    assert.equal(await page.evaluate(()=>window.replyTargets.at(-1)),"comment:ashley-child");
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"),"false");
    await toggle.click();
    await page.getByRole("button",{name:"Switch review fixture",exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-testid="related-ratings-toggle"]')?.getAttribute("aria-expanded")==="false");
    assert.equal(await toggle.getAttribute("aria-expanded"),"false","Switching post scope collapses ratings");
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.goto("http://127.0.0.1:5069/?ratings&guest",{waitUntil:"networkidle"});
  await page.getByTestId("related-ratings-toggle").click();
  assert(await page.getByText("My favorite of the trilogy.",{exact:false}).isVisible(),"Guest readers can expand ratings");
  assert.equal(await page.getByRole("button",{name:/Options for/}).count(),0);
  for (const width of [320,402,768]) {
    await page.setViewportSize({width,height:900});
    await page.goto("http://127.0.0.1:5069/?clash&open",{waitUntil:"networkidle"});
    const choices=page.getByTestId("clash-vote-controls").getByRole("button");
    for(const button of await choices.all()){
      const shape=await button.evaluate(el=>({radius:getComputedStyle(el).borderRadius,border:getComputedStyle(el).borderTopWidth,shadow:getComputedStyle(el).boxShadow}));
      assert.deepEqual(shape,{radius:"22px",border:"1px",shadow:"none"},"Voting buttons have soft corners and single outlines");
    }
    assert.equal(await choices.nth(0).getAttribute("aria-pressed"),"true");
    await choices.nth(1).click();
    assert.equal(await choices.nth(1).getAttribute("aria-pressed"),"true");
    assert.equal(await choices.nth(0).getAttribute("aria-pressed"),"false");
    const field=page.getByTestId("clash-comment-field");
    const style=await field.evaluate(el=>({height:el.getBoundingClientRect().height,border:getComputedStyle(el).borderTopWidth,radius:parseFloat(getComputedStyle(el).borderRadius),background:getComputedStyle(el).backgroundColor}));
    assert.equal(style.height,36);assert.equal(style.border,"1px");assert(style.radius>=18);assert.equal(style.background,"rgba(0, 0, 0, 0)");
    const send=field.getByRole("button",{name:"Post comment",exact:true});
    assert.equal(await send.evaluate(el=>getComputedStyle(el).backgroundColor),"rgba(0, 0, 0, 0)");
    assert.equal(await send.locator("svg").getAttribute("stroke-width"),"1.75");
    assert(await send.isDisabled());
    const input=field.getByRole("textbox",{name:"Write a comment",exact:true});
    await input.fill("Clash keyboard reply");await input.press("Enter");
    await page.getByText("Clash keyboard reply",{exact:true}).waitFor();
    await input.fill("Clash button reply");await send.click();
    await page.getByText("Clash button reply",{exact:true}).waitFor();
    assert.equal(await input.inputValue(),"");
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.deepEqual(errors,[]);
  console.log("PASS: 320/402/768px layout; dot alignment; bare share arrow; separate safe menu/Share/Next; owner/guest/last-review states; real action row and comment components; Reply/Send and main controls.");
  if(process.env.KEEP_LAYOUT_PREVIEW==="1") {
    console.log("Isolated layout preview ready on port 5069");
    await new Promise(()=>{});
  }
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
