import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DEFAULT_INTENT_WEIGHTS, POST_INTENTS, planPostIntent, intentEligible, compatibleIntentModes, consumptionContradictions, buildIntentValidationPrompt, validateIntentWeights, type PostIntent, type IntentAssignment } from "./persona-post-intents.ts";
import { chooseMode, chooseRating, DEFAULT_MODE_WEIGHTS, deriveSocialVoice, buildWritingPrompt, parseGenerationNotes, type Persona, type MediaCandidate, type BatchEntry } from "./persona-generation.ts";
import { generatePersonaBatch } from "./persona-generation-engine.ts";

const persona: Persona = { id: "p1", user_name: "person", display_name: "Person", persona_config: { bio: "Likes entertainment.", interests: ["drama"], media_types: ["movie", "book"] } };
const media: MediaCandidate = { title: "Known title", type: "movie", source: "Discovery", fit: .8, description: "A drama." };
const voice = deriveSocialVoice(persona.persona_config);
const weightsOnly = (id: PostIntent) => Object.fromEntries(POST_INTENTS.map(i => [i.id, i.id === id ? 100 : 0])) as typeof DEFAULT_INTENT_WEIGHTS;
const assigned = (intent: PostIntent, state: IntentAssignment["consumption"]["state"]): IntentAssignment => ({ intent, intentLabel: intent, reason: "test", consumption: { state, source: "fictional_planner" }, context: {} });

test("19 nonuniform intent weights sum to 100 with 22 review; mode defaults unchanged", () => {
  assert.equal(POST_INTENTS.length, 19);
  assert.equal(DEFAULT_INTENT_WEIGHTS.review, 22);
  assert.equal(Object.values(DEFAULT_INTENT_WEIGHTS).reduce((a,b)=>a+b,0),100);
  assert.equal(validateIntentWeights(DEFAULT_INTENT_WEIGHTS).review,22);
  assert.throws(()=>validateIntentWeights({...DEFAULT_INTENT_WEIGHTS,progress:-1}));
  assert.throws(()=>validateIntentWeights({...DEFAULT_INTENT_WEIGHTS,review:NaN}));
  assert.throws(()=>validateIntentWeights(Object.fromEntries(POST_INTENTS.map(i=>[i.id,0]))));
});
test("fictional states need no historical proof; unsupported specific intents are excluded", () => {
  for (const [intent,state] of [["anticipation","starting"],["progress","in_progress"],["drop","dropped"],["rewatch","revisiting"]] as const) {
    const result=planPostIntent(persona,media,weightsOnly(intent),[],[],()=>.5);
    assert.equal(result.intent,intent);
    assert.equal(result.consumption.source,"fictional_planner");
    assert.equal(result.consumption.state,intent==="anticipation"?"starting":state);
  }
  assert.equal(intentEligible("character","finished",{}),false);
  assert.equal(intentEligible("comparison","finished",{}),false);
  assert.equal(intentEligible("moment","finished",{}),false);
  assert.equal(intentEligible("character","finished",{people:[{name:"Known person",kind:"character"}]}),true);
  assert.equal(intentEligible("moment","finished",{moments:["Verified scene"]}),true);
  assert.equal(intentEligible("comparison","finished",{comparisons:[{title:"Known book",relationship:"Verified adaptation"}]}),true);
  assert.throws(()=>planPostIntent(persona,media,weightsOnly("comparison"),[],[],()=>.5));
});
test("intent selection respects supplied states, disabled intents and persona preferences", () => {
  for(let i=0;i<100;i++) {
    const p=planPostIntent(persona,media,{...DEFAULT_INTENT_WEIGHTS,review:0},[],[],()=>i/100);
    assert.notEqual(p.intent,"review");
  }
  const p={...persona,persona_config:{...persona.persona_config,intent_preferences:{review:0}}};
  for(let i=0;i<40;i++) assert.notEqual(planPostIntent(p,media,DEFAULT_INTENT_WEIGHTS,[],[],()=>i/40,{state:"finished",source:"supplied"}).intent,"review");
  assert.equal(planPostIntent(persona,media,weightsOnly("progress"),[],[],()=>.5,{state:"in_progress",source:"supplied",details:"Halfway through."}).consumption.details,"Halfway through.");
});
test("batch and recent intent repetition get soft penalties, not exclusions or rotations", () => {
  const batch: BatchEntry[]=[{personaId:"p1",mediaKey:"movie:other",intent:"review",mode:"casual",words:2,caps:false,content:"liked it"}];
  const distribution = (items: BatchEntry[], recent:any[]=[]) => Array.from({length:100},(_,i)=>planPostIntent(persona,media,DEFAULT_INTENT_WEIGHTS,items,recent,()=>i/100,{state:"finished",source:"supplied"}).intent).filter(id=>id==="review").length;
  assert.ok(distribution(batch)<distribution([]));
  assert.ok(distribution([], [{personaId:"p1",title:"Other",type:"movie",intent:"review"}])<distribution([]));
  assert.equal(planPostIntent(persona,media,weightsOnly("review"),batch,[],()=>.5).intent,"review");
});
test("anticipation cannot have rating mode or stars even for frequent raters", () => {
  const assignment=assigned("anticipation","starting");
  assert.ok(!compatibleIntentModes(assignment).includes("rating"));
  for(let i=0;i<100;i++) {
    assert.equal(chooseRating("casual",{...voice,ratingFrequency:"frequent"},()=>i/100,assignment),null);
    assert.notEqual(chooseMode(DEFAULT_MODE_WEIGHTS,voice,[],()=>i/100,compatibleIntentModes(assignment)),"rating");
  }
  assert.equal(chooseRating("casual",voice,()=>.9,assigned("progress","in_progress")),null);
  assert.ok(chooseRating("rating",voice,()=>.5,assigned("rewatch","revisiting")));
});
test("mode and intent stay independent; thoughtfulness does not require evaluation", () => {
  const assignment=assigned("observation","finished");
  const prompt=buildWritingPrompt(persona,media,"thoughtful",voice,null,[],[],undefined,assignment);
  assert.ok(prompt[1].content.includes("Assigned POST INTENT"));
  assert.ok(prompt[1].content.includes("Typing mode: thoughtful"));
  assert.ok(prompt[0].content.includes("The supplied intent describes why they opened the app"));
  assert.ok(prompt[0].content.includes("not requirements to demonstrate"));
  assert.deepEqual(consumptionContradictions("oh NO",assigned("reaction","finished")),[]);
  assert.deepEqual(consumptionContradictions("still perfect.",assigned("rewatch","revisiting")),[]);
  assert.deepEqual(consumptionContradictions("I don't know about this one guys",assigned("progress","in_progress")),[]);
  assert.ok(consumptionContradictions("Just finished watching it.",assigned("anticipation","not_started")).length);
  assert.ok(consumptionContradictions("Just finished reading.",assigned("progress","in_progress")).length);
});
test("narrow validation explicitly accepts unusual tiny posts and does not judge prose quality", () => {
  const text=buildIntentValidationPrompt("oh NO",assigned("reaction","finished"),media,null)[0].content;
  assert.ok(text.includes("Do NOT judge grammar"));
  assert.ok(text.includes('a revisit "still perfect"'));
  assert.ok(text.includes("without historical database proof"));
  assert.ok(text.includes("Return ONLY JSON"));
});
test("successful tiny human thoughts are not repaired even in thoughtful mode", async () => {
  for(const [intent,state,content] of [["reaction","finished","oh NO"],["rewatch","revisiting","still perfect."],["progress","in_progress","I don't know about this one guys"]] as const) {
    let writes=0, checks=0;
    const result=await generatePersonaBatch({personas:[persona],postsPerPersona:1,weights:{...DEFAULT_MODE_WEIGHTS,thoughtful:100,micro:0,casual:0,rating:0,question:0,specific:0,opinion:0,low_energy:0},intentWeights:weightsOnly(intent),recent:[],candidates:new Map([["p1",[media]]]),scenario:()=>({state,source:"supplied"}),random:()=>.9,
      chat:async messages=>{if(messages[1].content.includes('"task":"narrow_intent_validation"')){checks++;return '{"issues":[]}';} writes++;return JSON.stringify({content});}});
    assert.equal(result.drafts.length,1,result.errors.join(";"));
    assert.equal(result.drafts[0].content,content);
    assert.equal(writes,1);assert.equal(checks,1);
    assert.equal(parseGenerationNotes(result.drafts[0].ai_notes)?.intent,intent);
  }
});
test("contradictions repair within the same assignment; warnings disclose the repair",async()=>{
  let writers=0;
  const assignments:string[]=[];
  const result=await generatePersonaBatch({personas:[persona],postsPerPersona:1,weights:DEFAULT_MODE_WEIGHTS,intentWeights:weightsOnly("anticipation"),recent:[],candidates:new Map([["p1",[media]]]),random:()=>.5,
    chat:async messages=>{if(messages[1].content.includes('"task":"narrow_intent_validation"'))return '{"issues":[]}';writers++;assignments.push(messages[1].content);return JSON.stringify({content:writers===1?"Just finished watching it.":"Starting this tonight."});}});
  assert.equal(result.drafts.length,1,result.errors.join(";"));
  assert.equal(writers,2);assert.equal(result.drafts[0].rating,null);
  assert.ok(parseGenerationNotes(result.drafts[0].ai_notes)?.warnings.some(w=>w.includes("Claims experienced")));
  assert.equal(assignments[0].split("Typing mode:")[1].split("\n")[0],assignments[1].split("Typing mode:")[1].split("\n")[0]);
});
test("unsupported facts and obvious intent failures repair once, no silent relabeling",async()=>{
  let writers=0;
  const result=await generatePersonaBatch({personas:[persona],postsPerPersona:1,weights:DEFAULT_MODE_WEIGHTS,intentWeights:weightsOnly("character"),recent:[],candidates:new Map([["p1",[{...media,intentContext:{people:[{name:"Known Character",kind:"character"}]}}]]]),random:()=>.5,
    chat:async messages=>{if(messages[1].content.includes('"task":"narrow_intent_validation"'))return JSON.stringify({issues:["Unsupported named character"]});writers++;return JSON.stringify({content:"Invented Person forever."});}});
  assert.equal(writers,2);assert.equal(result.drafts.length,0);assert.equal(result.errors.length,1);
});
test("validator failure is explicit and never accepts unverified output",async()=>{
  const result=await generatePersonaBatch({personas:[persona],postsPerPersona:1,weights:DEFAULT_MODE_WEIGHTS,recent:[],candidates:new Map([["p1",[media]]]),random:()=>.5,
    chat:async messages=>messages[1].content.includes('"task":"narrow_intent_validation"')?'{"content":"wrong schema"}':'{"content":"nice"}'});
  assert.equal(result.drafts.length,0);assert.ok(result.errors[0].includes("valid result"));
});
test("feed wording no longer calls an unrated anticipation post reviewed",()=>{
  const source=fs.readFileSync("client/src/pages/feed.tsx","utf8");
  assert.ok(source.includes("post.type === 'thought' ? 'take' : 'posted about'"));
  assert.ok(source.includes("if (type === 'review') return 'posted about'"));
});