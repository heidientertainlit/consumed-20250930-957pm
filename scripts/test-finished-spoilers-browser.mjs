// Real dialog and the existing feed's actual spoiler/reveal JSX, with no live
// session, database calls, posts, or library writes.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import http from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";

const feed = await readFile("client/src/pages/feed.tsx", "utf8");
const start = feed.indexOf("post.containsSpoilers && !isSpoilerRevealed ? (");
const end = feed.indexOf("\n                )}", start);
assert.ok(start > 0 && end > start);
const expression = feed.slice(start, end);
const ratedStart = feed.indexOf("              {/* Review text — quote, under the reviewer block */}");
const ratedEnd = feed.indexOf("            </div>{/* end take (right) */}", ratedStart);
assert.ok(ratedStart > 0 && ratedEnd > ratedStart);
const ratedExpression = feed.slice(ratedStart, ratedEnd);
const titleStart = feed.indexOf("              {/* Media title follows the reviewer");
const titleEnd = feed.indexOf("\n              )}", titleStart) + "\n              )}".length;
assert.ok(titleStart > 0 && titleEnd > titleStart);
const titleExpression = feed.slice(titleStart, titleEnd);
const scopeStart = feed.indexOf("    const compactTvScopeLabel =");
const scopeEnd = feed.indexOf(";", scopeStart) + 1;
assert.ok(scopeStart > 0 && scopeEnd > scopeStart);
const scopeDeclaration = feed.slice(scopeStart, scopeEnd);
const bundle = await build({
  stdin: { contents: `
    import React, {useState} from "react";
    import {createRoot} from "react-dom/client";
    import {Eye} from "lucide-react";
    import {FinishedMediaFollowUpContent,FinishedMediaFollowUp} from "./client/src/components/finished-media-follow-up";
    import {FeedSpoilerText} from "./client/src/components/feed-spoiler-text";
    import {FeedSpoilerDiscussion} from "./client/src/components/feed-spoiler-discussion";
    import {FeedConversationSection} from "./client/src/components/feed-conversation-section";
    import {buildFeedConversation} from "./client/src/lib/feed-conversation";
    import {formatMediaScopeLabel} from "./client/src/lib/media-scope";
    function RatedExcerpt({containsSpoilers,postId,content,scope}) {
      const post={id:postId,content,containsSpoilers,mediaTitle:"Example series",...scope};
      const hasContent=Boolean(content);
      const mediaScopeLabel=formatMediaScopeLabel(post);
      const mediaCreator="";
      ${scopeDeclaration}
      const FEED_REVIEW_TEXT_CLASS="text-sm leading-relaxed";
      return <>${ratedExpression}${titleExpression}</>;
    }
    function FeedExcerpt({containsSpoilers}) {
      const post={containsSpoilers};
      const displayContent="The unexpected ending changes everything.";
      const [isSpoilerRevealed,setIsSpoilerRevealed]=useState(false);
      const [contentExpanded,setContentExpanded]=useState(false);
      return <>{${expression}}</>;
    }
    function App() {
      const [containsSpoilers,setContainsSpoilers]=useState(new URLSearchParams(location.search).has("spoilers"));
      const [busy,setBusy]=useState(false);
      const [modal,setModal]=useState(new URLSearchParams(location.search).has("modal"));
      const [elevated,setElevated]=useState(false);
      const [reviewId,setReviewId]=useState("first-review");
      const [reviewText,setReviewText]=useState("The ending reveals the surprise. ".repeat(location.pathname==="/review"?3:18));
      const [scope,setScope]=useState({seasonNumber:4,episodeNumber:2,episodeTitle:"An episode name that should not appear"});
      const [lateReply,setLateReply]=useState(false);
      window.fixture={containsSpoilers,setBusy,openModal:()=>setModal(true),setElevated,setReviewId,setReviewText,setScope,
        showLateReply:()=>setLateReply(true)};
      const comment=(id,content,replies=[])=>({id,user:{id:"reply-author",displayName:"Reply Author"},content,replies});
      const discussionComments=[comment(1,"Root reply about the twist",[
        comment(2,"Nested reply about the twist",[comment(3,"Deep reply about the twist")])
      ]),...(lateReply?[comment(4,"Newly arrived reply about the twist")]:[])];
      const Dialog=modal?FinishedMediaFollowUp:FinishedMediaFollowUpContent;
      return <main style={{maxWidth:440,margin:"0 auto"}}>
        {modal && <nav id="fixture-nav" style={{position:"fixed",bottom:0,left:0,right:0,height:84,zIndex:elevated?99999:9999,background:"silver"}}>Bottom navigation</nav>}
        <Dialog isOpen={true} elevated={elevated} media={{title:"Example film",mediaType:"movie"}}
          rating={0} reaction="The final scene changes everything." error={null} busy={busy}
          containsSpoilers={containsSpoilers} onContainsSpoilersChange={setContainsSpoilers}
          onRatingChange={()=>{}} onReactionChange={()=>{}} onClose={()=>{}}
          onSubmit={()=>{window.savedSpoiler=containsSpoilers}} />
        <section id="feed-check" style={{padding:20,background:"white",marginTop:16}}>
          <FeedExcerpt key={String(containsSpoilers)} containsSpoilers={containsSpoilers}/>
        </section>
        <FeedSpoilerDiscussion discussionId={reviewId} content={reviewText} containsSpoilers={containsSpoilers}>
        <section id="rated-feed-check" style={{padding:20,background:"white",marginTop:16}}
          onClick={()=>window.cardNavigations=(window.cardNavigations||0)+1}>
          <RatedExcerpt containsSpoilers={containsSpoilers} postId={reviewId} content={reviewText} scope={scope}/>
        </section>
        <section id="discussion-feed-check" style={{padding:20,background:"white",marginTop:16}}>
          <FeedConversationSection entries={buildFeedConversation({ratings:[],comments:discussionComments})}
            expanded={true} canInteract={true} onExpand={()=>{}}
            onVote={()=>window.threadVotes=(window.threadVotes||0)+1}
            onReply={()=>{}} onDelete={()=>{}} onReport={()=>{}} />
        </section>
        <section id="related-feed-check" style={{padding:20,background:"white",marginTop:16}}>
          <FeedConversationSection
            entries={buildFeedConversation({ratings:[{userId:"friend",userName:"friend",displayName:"Alex T.",
              rating:4.5,content:reviewText,postId:reviewId,containsSpoilers}],comments:[]})}
            expanded={true} canInteract={false} onExpand={()=>{}} onVote={()=>{}}
            onReply={()=>{}} onDelete={()=>{}} onReport={()=>{}} />
        </section>
        <section id="separate-discussion-check" style={{padding:20,background:"white",marginTop:16}}>
          <FeedConversationSection entries={buildFeedConversation({
            ratings:[
              {userId:"safe",userName:"safe",displayName:"Safe Reviewer",rating:4,content:"Independent safe review",postId:"safe-review"},
              {userId:"marked",userName:"marked",displayName:"Marked Reviewer",rating:3,content:"Independent spoiler review",postId:"marked-review",containsSpoilers:true},
            ],
            comments:[],
            reviewThreads:{
              "safe-review":[comment(10,"Safe separate reply")],
              "marked-review":[comment(11,"Separate spoiler reply",[comment(12,"Separate nested spoiler reply")])],
            },
          })} expanded={true} canInteract={false} onExpand={()=>{}} onVote={()=>{}}
            onReply={()=>{}} onDelete={()=>{}} onReport={()=>{}} />
        </section>
        </FeedSpoilerDiscussion>
      </main>;
    }
    createRoot(document.getElementById("root")).render(<App/>);
  `, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
});
const files = await readdir("dist/public/assets");
const css = await readFile(`dist/public/assets/${files.find(name => /^index-.*\.css$/.test(name))}`);
const server = http.createServer((req, res) => {
  if (req.url === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(bundle.outputFiles[0].text); return; }
  if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end(css); return; }
  res.setHeader("Content-Type","text/html; charset=utf-8");
  const reviewOnly=req.url?.startsWith("/review");
  res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css">'+
    (reviewOnly?'<style>main>div:first-child,#feed-check{display:none}</style>':'')+
    '</head><body style="background:#e6e2ec"><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
await new Promise(resolve => server.listen(5001, "0.0.0.0", resolve));
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
try {
  const page = await browser.newPage({viewport:{width:402,height:874}});
  await page.goto("http://127.0.0.1:5001");
  const checkbox = page.getByRole("checkbox", {name:"Contains spoilers"});
  await checkbox.waitFor();
  assert.equal(await checkbox.isChecked(),false);
  assert.equal(await page.locator("#feed-check .blur-md").count(),0);
  await checkbox.check();
  await page.waitForFunction(()=>window.fixture.containsSpoilers===true);
  assert.equal(await page.locator("#feed-check .blur-md").count(),1);
  await page.locator("#feed-check").getByRole("button",{name:"Show Spoiler"}).click();
  assert.equal(await page.locator("#feed-check .blur-md").count(),0);
  await page.getByRole("button",{name:"Save",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.savedSpoiler),true);
  await checkbox.focus();
  await page.keyboard.press("Space");
  await page.waitForFunction(()=>window.fixture.containsSpoilers===false);
  await page.getByRole("button",{name:"Save",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.savedSpoiler),false);
  // Exercise the actual rating-card JSX, not just the older text-card renderer.
  const rated=page.locator("#rated-feed-check");
  const related=page.locator("#related-feed-check");
  const scopeCode=rated.getByText("(S4-E2)",{exact:true});
  await scopeCode.waitFor();
  assert.equal(await scopeCode.evaluate(node=>node.parentElement.tagName),"P");
  assert.ok(await scopeCode.evaluate(node=>parseFloat(getComputedStyle(node).fontSize)<parseFloat(getComputedStyle(node.parentElement).fontSize)),"Scope should be smaller than the title");
  assert.doesNotMatch(await rated.innerText(),/Season 4|Episode 2|An episode name/);
  assert.equal(await rated.locator('p[aria-hidden="true"]').count(),0);
  await checkbox.check();
  for(const section of [rated,related]){
    const hidden=section.locator('p[aria-hidden="true"]');
    await hidden.waitFor();
    assert.equal(await hidden.getAttribute("aria-hidden"),"true");
    assert.notEqual(await hidden.evaluate(node=>getComputedStyle(node).filter),"none");
    const reveal=section.getByRole("button",{name:"Show Spoiler"});
    assert.equal(await reveal.getAttribute("data-guest-allowed"),"true");
    assert.equal(await reveal.innerText(),"Spoiler");
    assert.equal(await reveal.locator(".lucide-eye-off").count(),1);
    const pillBox=await reveal.boundingBox();
    const textBox=await hidden.boundingBox();
    assert.ok(pillBox.width<textBox.width,"Spoiler pill must not cover the whole text block");
    assert.ok(pillBox.height>=44,"Spoiler pill needs a usable touch target");
    await reveal.focus();
    await page.keyboard.press("Enter");
    assert.equal(await section.locator('p[aria-hidden="true"]').count(),0);
    assert.equal(await section.locator('p[aria-hidden="false"]').count(),1);
  }
  assert.equal(await page.evaluate(()=>window.cardNavigations||0),0,"Revealing navigated away from the card");
  assert.equal(await rated.locator('p[aria-hidden="false"]').evaluate(node=>node.scrollHeight<=node.clientHeight+1),true,"Revealed text remained clamped");
  await page.evaluate(()=>window.fixture.setReviewId("second-review"));
  await rated.getByRole("button",{name:"Show Spoiler"}).waitFor();
  assert.equal(await related.locator('p[aria-hidden="true"]').count(),1,"Another review reused the previous reveal");
  await rated.getByRole("button",{name:"Show Spoiler"}).click();
  await page.evaluate(()=>window.fixture.setReviewText("A different ending on the same post."));
  await rated.getByRole("button",{name:"Show Spoiler"}).waitFor();
  await checkbox.uncheck();
  assert.equal(await rated.locator('p[aria-hidden="true"]').count(),0);
  assert.equal(await related.locator('p[aria-hidden="true"]').count(),0);
  await page.evaluate(()=>window.fixture.setReviewText("A long ordinary review with plenty to say. ".repeat(35)));
  const readMore = rated.getByRole("button",{name:"Read more",exact:true});
  await readMore.waitFor();
  const ordinaryReview = rated.locator('p[role="button"]');
  assert.equal(await ordinaryReview.evaluate(el=>el.scrollHeight>el.clientHeight+1),true);
  await ordinaryReview.click();
  await rated.getByRole("button",{name:"Show less",exact:true}).waitFor();
  assert.equal(await ordinaryReview.evaluate(el=>el.scrollHeight<=el.clientHeight+1),true);
  assert.equal(await page.evaluate(()=>window.cardNavigations||0),0);
  await rated.getByRole("button",{name:"Show less",exact:true}).click();
  await ordinaryReview.focus();
  await page.keyboard.press("Enter");
  await rated.getByRole("button",{name:"Show less",exact:true}).waitFor();
  await page.evaluate(()=>window.fixture.setReviewText("A short review."));
  await page.waitForFunction(()=>!document.querySelector('#rated-feed-check p[role="button"]'));
  assert.equal(await rated.getByRole("button",{name:"Read more",exact:true}).count(),0);
  await page.evaluate(()=>window.fixture.setScope({seasonNumber:4}));
  await rated.getByText("(S4)",{exact:true}).waitFor();
  await page.evaluate(()=>window.fixture.setScope({}));
  await page.waitForFunction(()=>!document.querySelector("#rated-feed-check .feed-review-media-title span"));
  const discussion=page.locator("#discussion-feed-check");
  const separate=page.locator("#separate-discussion-check");
  await checkbox.check();
  await page.evaluate(()=>window.fixture.setReviewId("shared-discussion-case"));
  await page.waitForFunction(()=>document.querySelectorAll('#discussion-feed-check p[aria-hidden="true"]').length===3);
  assert.equal(await separate.locator('p[aria-hidden="true"]').count(),3,"Independent review threads must keep their own spoiler setting");
  assert.equal(await separate.getByText("Safe separate reply",{exact:true}).getAttribute("aria-hidden"),null);
  assert.equal(await discussion.getByText("Reply A.",{exact:true}).count(),3,"Author names must remain visible");
  await discussion.getByRole("button",{name:/thumbs down/}).first().click();
  assert.equal(await page.evaluate(()=>window.threadVotes),1,"Comment actions should remain usable while text is blurred");
  await discussion.getByRole("button",{name:"Show Spoiler"}).nth(2).click();
  assert.equal(await rated.locator('p[aria-hidden="true"]').count(),0,"A reply should reveal the primary post");
  assert.equal(await discussion.locator('p[aria-hidden="true"]').count(),0,"A reply should reveal every nested reply");
  assert.equal(await related.locator('p[aria-hidden="true"]').count(),1,"Primary reveal leaked to an unrelated review");
  assert.equal(await separate.locator('p[aria-hidden="true"]').count(),3,"Primary reveal leaked to another discussion");
  await page.evaluate(()=>window.fixture.showLateReply());
  await discussion.getByText("Newly arrived reply about the twist",{exact:true}).waitFor();
  assert.equal(await discussion.locator('p[aria-hidden="true"]').count(),0,"Late replies should inherit the thread's revealed state");
  await page.evaluate(()=>window.fixture.setReviewId("another-hidden-discussion"));
  await page.waitForFunction(()=>document.querySelectorAll('#discussion-feed-check p[aria-hidden="true"]').length===4);
  await separate.getByRole("button",{name:"Show Spoiler"}).nth(2).click();
  assert.equal(await separate.locator('p[aria-hidden="true"]').count(),0,"A separate review reply should reveal its own whole thread");
  assert.equal(await rated.locator('p[aria-hidden="true"]').count(),1,"An independent review reveal leaked to the primary post");
  assert.equal(await discussion.locator('p[aria-hidden="true"]').count(),4);
  await rated.getByRole("button",{name:"Show Spoiler"}).click();
  assert.equal(await discussion.locator('p[aria-hidden="true"]').count(),0,"Primary reveal should reveal all replies");
  assert.equal(await page.evaluate(()=>window.cardNavigations||0),0);
  await page.evaluate(()=>window.fixture.setBusy(true));
  await page.waitForFunction(()=>document.querySelector('input[type="checkbox"]').disabled);
  assert.equal(await checkbox.isDisabled(),true);
  await page.evaluate(()=>{window.fixture.setBusy(false);window.fixture.openModal()});
  await page.getByRole("dialog").waitFor();
  for (const elevated of [false,true]) {
    await page.evaluate(value=>window.fixture.setElevated(value),elevated);
    for (const height of [874,600]) {
      await page.setViewportSize({width:402,height});
      const footer=page.getByRole("button",{name:"Not now",exact:true});
      await footer.waitFor({state:"visible"});
      // Vaul's opening animation is visible before it finishes sliding on-screen.
      await page.waitForFunction(()=>{
        const button=[...document.querySelectorAll('[role="dialog"] button')].find(el=>el.textContent==="Not now");
        if(!button)return false;
        const r=button.getBoundingClientRect();
        return r.y>=0 && r.bottom<=window.innerHeight;
      });
      const box=await footer.boundingBox();
      assert.ok(box && box.y>=0 && box.y+box.height<=height, "Footer fell outside the visible screen");
      const reachable=await footer.evaluate(button=>{
        const r=button.getBoundingClientRect();
        return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest("button")===button;
      });
      assert.equal(reachable,true,"Bottom navigation covered the footer button");
      const save=page.getByRole("button",{name:"Save",exact:true});
      assert.equal(await save.count(),1,"Save must not remain duplicated in the header");
      const saveBox=await save.boundingBox();
      assert.ok(saveBox && saveBox.y>=0 && saveBox.y+saveBox.height<=box.y, "Save must be visible above Not now");
      assert.ok(Math.abs(saveBox.x-box.x)<1 && Math.abs(saveBox.width-box.width)<1,"Footer actions must stack, not sit side by side");
      assert.equal(await save.evaluate(button=>{
        const r=button.getBoundingClientRect();
        return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest("button")===button;
      }),true,"Bottom navigation covered Save");
    }
  }
  assert.doesNotMatch(await page.getByRole("dialog").innerText(),/Already saved to Finished|Your reaction will be blurred|Reactions and ratings are public/);
  console.log("Browser checks passed: actual rating-card and related-review spoiler blur, keyboard/guest reveal, full text, no accidental navigation, per-post/content reset, checkbox saves, and stacked footer navigation safety.");
} finally {
  await browser.close();
  if (!process.argv.includes("--serve")) server.close();
}
if(process.argv.includes("--serve")) {
  console.log("Spoiler fixture ready on port 5001.");
  process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
}
