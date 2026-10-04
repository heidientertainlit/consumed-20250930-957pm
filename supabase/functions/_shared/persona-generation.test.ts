import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MODE_WEIGHTS, POST_MODES, validateModeWeights, validateVoice, deriveSocialVoice,
  mediaSelectionWeight, chooseMedia, chooseMode, chooseRating, mediaKey, cleanStyleExample,
  buildWritingPrompt, validateGeneratedContent, parseGenerationNotes, renderRatingPlaceholders, writingShapeIssues,
  type MediaCandidate, type Persona, type BatchEntry,
} from "./persona-generation.ts";
import { generatePersonaBatch } from "./persona-generation-engine.ts";
import type { Chat } from "./persona-media-candidates.ts";
const writerOnly = (writer: Chat): Chat => async messages =>
  messages[0].content.startsWith("Choose one concrete premise") ? '{"premise":"They liked it more than expected."}' :
  messages[1].content.includes('"task":"narrow_intent_validation"') ? '{"issues":[]}' : writer(messages);

const persona: Persona = { id: "p1", display_name: "Example", user_name: "example", persona_config: {
  tone: "enthusiastic and dramatic", posting_style: "episode reactions + ratings", media_types: ["tv", "book"],
  interests: ["drama"], favorite_media: ["A real title"], style_examples: [{ type: "review", content: "A full 10/10 no notes." }],
} };
const media: MediaCandidate = { title: "A real title", type: "tv", source: "Persona Favorite", fit: 1, externalId: "123", externalSource: "tmdb" };
const voice = deriveSocialVoice(persona.persona_config);
test("eight internal modes and configurable weights preserve a 30% base thoughtful share", () => {
  assert.equal(POST_MODES.length, 8);
  assert.equal(DEFAULT_MODE_WEIGHTS.thoughtful, 30);
  assert.equal(Object.values(DEFAULT_MODE_WEIGHTS).reduce((a,b)=>a+b,0), 100);
  assert.throws(() => validateModeWeights({ ...DEFAULT_MODE_WEIGHTS, micro: -1 }));
  assert.throws(() => validateModeWeights(Object.fromEntries(POST_MODES.map(m=>[m.id,0]))));
});
test("voice derives from existing profile and preserves explicit overrides", () => {
  assert.equal(voice.energy, "enthusiastic");
  assert.equal(voice.ratingFrequency, "frequent");
  assert.equal(deriveSocialVoice({ tone: "laid-back", posting_style: "short updates" }).length, "short");
  assert.equal(deriveSocialVoice({ ...persona.persona_config, social_voice: { energy: "restrained" } }).energy, "restrained");
  assert.throws(() => validateVoice({ ...voice, capitalization: "always scream" }));
});
test("recent and same-batch titles have strong soft penalties, never absolute bans", () => {
  const base = mediaSelectionWeight(media, "p1", [], []);
  const batch: BatchEntry[] = [{ personaId: "p2", mediaKey: mediaKey(media), mode: "casual", words: 9, caps: false, content: "ordinary response" }];
  assert.ok(mediaSelectionWeight(media, "p1", [], batch) < base * .2);
  assert.ok(mediaSelectionWeight(media, "p1", [{ personaId: "p1", title: media.title, type: media.type }], []) < base * .2);
  assert.ok(mediaSelectionWeight(media, "p1", [], batch) > 0);
  assert.equal(chooseMedia([media], "p1", [], batch).title, media.title);
});
test("provider title variants are merged rather than multiplying selection chances", () => {
  assert.equal(mediaKey({title:"Tár",type:"movie"}), mediaKey({title:"Tar",type:"Movie"}));
  const choices = [media, {...media, title:"A REAL TITLE"}, {...media, title:"Other",fit:.8}];
  assert.ok(chooseMedia(choices,"p1",[],[],()=>.99).title === "Other");
});
test("a large trending pool does not overwhelm stronger persona sources by cardinality", () => {
  const favorite = {...media,title:"Favorite",fit:1};
  const trends = Array.from({length:100},(_,i)=>({...media,title:`Trend ${i}`,source:"Trending" as const,fit:.3}));
  const share=(items:MediaCandidate[])=>Array.from({length:100},(_,i)=>chooseMedia(items,"p1",[],[],()=>i/100).source).filter(s=>s==="Trending").length;
  assert.equal(share([favorite,trends[0]]),share([favorite,...trends]));
});
test("textual score placeholders derive their value from the structured rating", () => {
  assert.equal(renderRatingPlaceholders("easy {{rating_words}} stars",5),"easy five stars");
  assert.equal(renderRatingPlaceholders("{{rating}} and I stand by it",3.5),"3.5 and I stand by it");
  assert.throws(()=>renderRatingPlaceholders("{{rating}} stars",null));
});
test("bare assigned scores are omitted from prose while coherent ratings and other numbers survive", () => {
  const thought = "Fraser's style might really shake things up! Curious how he'll handle the crew dynamic.";
  for (const token of ["{{rating}}", "{{rating_words}}", "3", "3."]) {
    assert.equal(renderRatingPlaceholders(`${thought} ${token}`, 3), thought);
    assert.equal(renderRatingPlaceholders(token, 3), "");
  }
  assert.equal(renderRatingPlaceholders(`${thought}\n{{rating}}`, 3), thought);
  assert.equal(renderRatingPlaceholders("Liked it. {{rating}}!", 4.5), "Liked it.");
  assert.equal(renderRatingPlaceholders("Definitely earning its {{rating}} from me.", 4.5), "Definitely earning its 4.5 from me.");
  assert.equal(renderRatingPlaceholders("I'd give it {{rating}}/5.", 3), "I'd give it 3/5.");
  assert.equal(renderRatingPlaceholders("{{rating_words}} stars for me.", 3.5), "three and a half stars for me.");
  assert.equal(renderRatingPlaceholders("Episode 3", 3), "Episode 3");
  assert.equal(renderRatingPlaceholders("There are 3 left.", 3), "There are 3 left.");
  assert.equal(renderRatingPlaceholders("It took 3.5 hours.", 5), "It took 3.5 hours.");
  assert.equal(renderRatingPlaceholders("A thought. 3.5", 5), "A thought. 3.5");
  assert.equal(renderRatingPlaceholders("The number was 3.", null), "The number was 3.");
});
test("generation formats a bare trailing score without changing the assigned rating or adding a retry", async () => {
  const thought = "Curious how he'll handle the crew dynamic.";
  let writers = 0, validators = 0;
  const result = await generatePersonaBatch({
    personas: [persona], postsPerPersona: 1,
    weights: Object.fromEntries(POST_MODES.map(m => [m.id, m.id === "low_energy" ? 100 : 0])) as typeof DEFAULT_MODE_WEIGHTS,
    recent: [], candidates: new Map([[persona.id, [media]]]), random: () => 0,
    scenario: () => ({ state: "finished", source: "supplied" }),
    chat: async messages => {
      if (messages[0].content.startsWith("Choose one concrete premise")) return '{"premise":"Curious what this person will do to the group dynamic."}';
      if (messages[1].content.includes('"task":"narrow_intent_validation"')) {
        validators++;
        const input = JSON.parse(messages[1].content);
        assert.equal(input.content, thought);
        return '{"issues":[]}';
      }
      writers++;
      return JSON.stringify({ content: `${thought} {{rating}}` });
    },
  });
  assert.equal(result.drafts.length, 1, result.errors.join(";"));
  const draft = result.drafts[0], meta = parseGenerationNotes(draft.ai_notes)!;
  assert.equal(draft.content, thought);
  assert.equal(typeof draft.rating, "number");
  assert.equal(draft.rating, meta.rating);
  assert.equal(meta.mode, "low_energy");
  assert.equal(draft.media_external_id, media.externalId);
  assert.equal(draft.media_external_source, media.externalSource);
  assert.equal(writers, 1);
  assert.equal(validators, 1);
});
test("weighted mode randomness is not a fixed rotation; disabled modes stay disabled", () => {
  const weights = {...DEFAULT_MODE_WEIGHTS,thoughtful:0};
  for(let i=0;i<100;i++) assert.notEqual(chooseMode(weights, voice,[],()=>i/100),"thoughtful");
  const all = new Set(Array.from({length:100},(_,i)=>chooseMode(DEFAULT_MODE_WEIGHTS,voice,[],()=>i/100)));
  assert.equal(all.size,8);
});
test("rating mode always receives a half-step five-star rating, others may omit", () => {
  for(let i=0;i<100;i++) { const n=chooseRating("rating",voice,()=>i/100)!; assert.ok(n>=.5&&n<=5); assert.equal(n*2,Math.floor(n*2)); }
  assert.equal(chooseRating("casual",{...voice,ratingFrequency:"rare"},()=>.99),null);
});
test("structured rating allows consistent natural language and rejects contradictions", () => {
  for(const content of ["4 stars. Would've been 5 if the ending landed.", "Four stars.", "4/5.", "3.5 and I stand by it", "easy five stars", "three and a half stars"]) {
    const n=content.toLowerCase().includes("five")?5:content.includes("3.5")||content.includes("half")?3.5:4;
    assert.deepEqual(validateGeneratedContent(content,n,media),[],content);
  }
  for(const content of ["5 stars", "five stars", "four and a half stars","10/10", "4.5 and I stand by it", "a solid 4.5", "5"]) assert.ok(validateGeneratedContent(content,3.5,media).length,content);
  assert.ok(validateGeneratedContent("4 stars",null,media).length);
});
test("rating-only empty text is valid; empty unrated content is not", () => {
  assert.deepEqual(validateGeneratedContent("",4,media),[]);
  assert.ok(validateGeneratedContent("",null,media).length);
});
test("mode-shape checks reject detached promotional paragraphs, not ordinary descriptions", () => {
  assert.ok(writingShapeIssues("A breathtaking exploration of love with meticulous attention to detail makes this visually striking film an emotionally resonant journey for audiences everywhere.","thoughtful").length);
  assert.deepEqual(writingShapeIssues("The middle was too slow, but the ending made up for it. Good enough that a rewatch sounds fun, just not right away.","thoughtful"),[]);
  assert.ok(writingShapeIssues("This is a twelve word review that goes on forever and explains all its themes at great length.","micro").length);
});
test("first-person wording does not excuse editorial copy or become mandatory", () => {
  assert.ok(writingShapeIssues("I found this thought-provoking and emotionally resonant, with meticulous attention to detail throughout its carefully written narrative and a visually striking finale.","thoughtful").length);
  assert.deepEqual(writingShapeIssues("The quiet parts mattered more than the big speeches. Not every pause earned its length, but the last conversation changed the earlier scenes.","thoughtful"),[]);
  assert.deepEqual(writingShapeIssues("pretty good","low_energy"),[]);
  assert.deepEqual(writingShapeIssues("eh","micro"),[]);
});
test("writer distinguishes social register within modes without changing mode weights", () => {
  const system = buildWritingPrompt(persona,media,"thoughtful",voice,null,[],[])[0].content;
  assert.ok(system.includes("SIMULATE WHAT THIS PERSON TYPED"));
  assert.ok(system.includes("not requirements to demonstrate"));
  assert.ok(system.includes("Thoughtful does not mean literary"));
  assert.ok(system.includes("genuinely wants answered"));
  assert.ok(system.includes("not trying to create content"));
  assert.ok(buildWritingPrompt(persona,media,"question",voice,null,[],[])[1].content.includes("Questions and requests come from the premise"));
  assert.ok(buildWritingPrompt(persona,media,"low_energy",voice,null,[],[])[1].content.includes("Little effort"));
  assert.ok(buildWritingPrompt(persona,media,"micro",voice,null,[],[])[1].content.includes("Very brief"));
  assert.deepEqual(DEFAULT_MODE_WEIGHTS,{thoughtful:30,micro:10,casual:15,rating:10,question:10,specific:8,opinion:8,low_energy:9});
});
test("old /10 examples are sanitized, mode and exact media assigned before writing", () => {
  assert.ok(!cleanStyleExample("10/10 or 4.5 stars").match(/10\/10|4\.5 stars/));
  const prompt=buildWritingPrompt(persona,media,"micro",voice,4,[],[]);
  assert.ok(prompt[1].content.includes("Typing mode: micro"));
  assert.ok(prompt[1].content.includes("Authoritative rating: 4/5"));
  assert.ok(!prompt[0].content.includes("10/10"));
  assert.ok(!prompt[1].content.includes("at least half"));
});
test("specific episode numbers need explicit evidence, not just a nonempty synopsis", () => {
  assert.ok(validateGeneratedContent("Episode six???",null,{...media,description:"A general dramatic story."}).length);
  assert.deepEqual(validateGeneratedContent("Episode six???",null,{...media,description:"Episode six is available."}),[]);
});
test("batch generation assigns fields structurally and exposes admin-only metadata", async () => {
  const assigned: string[] = [];
  const results = await generatePersonaBatch({ personas:[persona], postsPerPersona:2, weights:DEFAULT_MODE_WEIGHTS, recent:[],
    candidates:new Map([["p1",[media]]]),random:()=>.2,
    chat:writerOnly(async messages=>{assigned.push(messages[1].content);return JSON.stringify({content:messages[1].content.includes("Typing mode: thoughtful")?"I liked it a lot more than expected. Still thinking about it today, even if it took a while to get going.":"pretty good.",rating:9,media_title:"Hijacked title",post_type:"hot_take"});}),
  });
  assert.equal(results.drafts.length,2);
  assert.equal(results.drafts[0].media_title,media.title);
  assert.equal(results.drafts[0].post_type,"review");
  assert.notEqual(results.drafts[0].rating,9);
  assert.ok(parseGenerationNotes(results.drafts[0].ai_notes)?.mode);
  assert.equal(results.state.length,2);
  assert.ok(!assigned[1].includes("Still thinking about it")); // Other authors' prose no longer primes the writer.
});
test("invalid rating language repairs once; repeated failure never creates a draft", async () => {
  const result=await generatePersonaBatch({personas:[persona],postsPerPersona:1,weights:DEFAULT_MODE_WEIGHTS,recent:[],candidates:new Map([["p1",[media]]]),random:()=>.2,chat:writerOnly(async()=>JSON.stringify({content:"10/10"}))});
  assert.equal(result.drafts.length,0);assert.equal(result.errors.length,1);
});
test("incomplete writer JSON repairs once without choosing another media, mode or rating", async () => {
  const prompts: string[] = [];
  const result = await generatePersonaBatch({personas:[persona],postsPerPersona:1,weights:DEFAULT_MODE_WEIGHTS,recent:[],candidates:new Map([["p1",[media]]]),random:()=>.2,
    chat:writerOnly(async messages=>{
      prompts.push(messages[1].content);
      return prompts.length === 1 ? '{"content":"unfinished' : JSON.stringify({content:"The quiet parts mattered more than the big speeches. Not every pause earned its length, but the last conversation changed the earlier scenes."});
    }),
  });
  assert.equal(result.drafts.length,1);
  assert.equal(prompts.length,2);
  assert.ok(prompts[1].includes("Writer output was incomplete JSON"));
  for (const label of ["Assigned media", "Assigned internal mode", "Authoritative rating"]) {
    assert.equal(prompts[0].split("\n").find(line=>line.startsWith(label)),prompts[1].split("\n").find(line=>line.startsWith(label)));
  }
});
test("repeated malformed writer output stops after the existing two attempts", async () => {
  let calls=0;
  const result=await generatePersonaBatch({personas:[persona],postsPerPersona:1,weights:DEFAULT_MODE_WEIGHTS,recent:[],candidates:new Map([["p1",[media]]]),random:()=>.2,chat:writerOnly(async()=>{calls++;return '{"content":"unfinished';})});
  assert.equal(calls,2);
  assert.equal(result.drafts.length,0);
  assert.equal(result.errors.length,1);
});