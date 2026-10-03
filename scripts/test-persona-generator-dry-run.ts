/**
 * Local-only test runner. Reads checked-in fictional persona definitions, calls read-only
 * media providers and the writing API, then writes reports locally. No Supabase client,
 * draft inserts, scheduling or publishing code is reachable from this runner.
 */
import fs from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { DEFAULT_MODE_WEIGHTS, deriveSocialVoice, parseGenerationNotes, POST_MODES, type Persona, type MediaCandidate } from "../supabase/functions/_shared/persona-generation.ts";
import { buildPersonaCandidates, createPersonaChat, fetchTrendingCandidates, createCachedPersonaMediaResolver, loadPersonaIntentContext, type MediaResolutionDebug } from "../supabase/functions/_shared/persona-media-candidates.ts";
import { knownFavoriteIdentity } from "../supabase/functions/_shared/persona-favorite-identity.ts";
import { DEFAULT_INTENT_WEIGHTS, POST_INTENTS } from "../supabase/functions/_shared/persona-post-intents.ts";
import { generatePersonaBatch } from "../supabase/functions/_shared/persona-generation-engine.ts";
import { renderPersonaReport } from "./persona-generation-report.ts";

const out = process.argv[2] || "reports/persona-generator-test-batch";
const comparisonPath = process.argv[3];
for (const suffix of [".json", ".html"]) {
  const exists = await fs.stat(`${out}${suffix}`).then(() => true, (error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
  if (exists) throw new Error(`Refusing to overwrite a delivered report: ${out}${suffix}`);
}
if (comparisonPath === `${out}.json`) throw new Error("Comparison batch must not be overwritten");
const previousBatch = comparisonPath ? JSON.parse(await fs.readFile(comparisonPath, "utf8")) : null;
const countModes = (drafts: any[]) => Object.fromEntries(POST_MODES.map(({id}) => [id, drafts.filter(d => parseGenerationNotes(d.ai_notes)?.mode === id).length]));
const previousModeCounts = previousBatch ? countModes(previousBatch.drafts) : null;
const source = await fs.readFile("supabase/functions/setup-personas/index.ts", "utf8");
const literal = source.match(/const personas = (\[[\s\S]*?\n\]);/)?.[1];
if (!literal) throw new Error("Could not read checked-in persona definitions");
const seeded = vm.runInNewContext(`(${literal})`) as any[];
const picks = ["emily27", "alexmoreno402", "lenahoff", "marcusdelacroix", "sarah13", "kei", "nick", "brooksj", "alex_thompson", "reedreads"];
const selected = [...seeded.filter(p => picks.includes(p.username)), ...seeded.filter(p => !picks.includes(p.username))].slice(0,10);
const personas: Persona[] = selected.map(p => {
  const { username, display_name, ...config } = p;
  return {id:username, user_name:username, display_name, persona_config:config};
});
if (!process.env.OPENAI_API_KEY) throw new Error("Writing provider is not configured");
const providerChat = createPersonaChat(process.env.OPENAI_API_KEY);
const writerOutputs: { persona: string; raw: string; messages: { role: string; content: string }[] }[] = [];
const premiseOutputs: { raw: string; messages: { role: string; content: string }[] }[] = [];
const validationOutputs: { raw: string; messages: { role: string; content: string }[] }[] = [];
const chat: typeof providerChat = async messages => {
  const raw = await providerChat(messages);
  if (messages[0].content.startsWith("Choose one concrete premise")) premiseOutputs.push({ raw, messages });
  if (messages[1].content.includes('"task":"narrow_intent_validation"')) validationOutputs.push({ raw, messages });
  if (messages[0].content.startsWith("You are ")) {
    writerOutputs.push({ persona: messages[0].content.split(". Preserve this person's existing identity:")[0].slice(8), raw, messages });
  }
  return raw;
};
const keys = {tmdb:process.env.TMDB_API_KEY,books:process.env.GOOGLE_BOOKS_API_KEY,rawg:process.env.RAWG_API_KEY};
const trending = await fetchTrendingCandidates(keys);
const candidates = new Map<string,MediaCandidate[]>();
const mediaResolutionDebug: MediaResolutionDebug[] = [];
const resolve = createCachedPersonaMediaResolver(keys, entry => mediaResolutionDebug.push(entry));
const favoriteIdentityChecks = [];
// Read-only diagnostics, not injected candidates or forced media assignments.
for (const persona of personas) for (const title of persona.persona_config.favorite_media || []) {
  const identity = knownFavoriteIdentity(persona, title);
  if (!identity) continue;
  const resolved = await resolve(identity.title, identity.type, identity.creator);
  favoriteIdentityChecks.push({ persona: persona.display_name, expected: identity, verified: !!resolved, resolved, purpose: "diagnostic-only; not inserted into the candidate pool" });
}
for(let start=0;start<personas.length;start+=3) {
  await Promise.all(personas.slice(start,start+3).map(async p=>{
    deriveSocialVoice(p.persona_config);
    const values=await buildPersonaCandidates(p,trending,[],chat,resolve);
    candidates.set(p.id,values);
    console.log(`Candidates prepared: ${p.display_name}, ${values.length} verified choices`);
  }));
}
const result = await generatePersonaBatch({personas,postsPerPersona:2,weights:DEFAULT_MODE_WEIGHTS,intentWeights:DEFAULT_INTENT_WEIGHTS,recent:[],candidates,chat,loadContext:media=>loadPersonaIntentContext(media,keys)});
await fs.mkdir(path.dirname(out),{recursive:true});
const modes = countModes(result.drafts);
const intentCounts = Object.fromEntries(POST_INTENTS.map(({id})=>[id,result.drafts.filter(d=>parseGenerationNotes(d.ai_notes)?.intent===id).length]));
const validationWarnings = result.drafts.flatMap((d,i)=>(parseGenerationNotes(d.ai_notes)?.warnings || []).map(warning=>`Post ${i+1}: ${warning}`));
const styleWarnings = result.drafts.flatMap((d,i)=>(parseGenerationNotes(d.ai_notes)?.styleWarnings || []).map(warning=>`Post ${i+1}: ${warning}`));
const emojiRepairs = result.drafts.flatMap((d,i)=>(parseGenerationNotes(d.ai_notes)?.emojiRepairs || []).map(repair=>({post:i+1,...repair})));
await fs.writeFile(`${out}.json`,JSON.stringify({dryRun:true,source:"Checked-in persona definitions and unchanged curated author profiles; no live history/config queried. Broad consumption states assigned fictionally; specific facts provider-grounded. One concrete premise per assignment. No manual editing or post-run retuning.",weights:DEFAULT_MODE_WEIGHTS,intentWeights:DEFAULT_INTENT_WEIGHTS,modeCounts:modes,intentCounts,validationWarnings,styleWarnings,emojiRepairs,writerOutputs,premiseOutputs,validationOutputs,mediaResolutionDebug,favoriteIdentityChecks,comparisonBaseline:comparisonPath,previousModeCounts,...result},null,2));
const reportPath = `${out}.html`;
await fs.writeFile(reportPath,renderPersonaReport({drafts:result.drafts,errors:result.errors,personaCount:personas.length,previousModeCounts,writerOutputs,premiseOutputs,mediaResolutionDebug,favoriteIdentityChecks,showPlanning:true,reportTitle:"Concrete premise → writer — final raw 20-post batch"}));
console.log(JSON.stringify({generated:result.drafts.length,intentCounts,modeCounts:modes,validationWarnings,styleWarnings,emojiRepairs,favoriteIdentityChecks,writerResponses:writerOutputs.length,errors:result.errors,report:`${out}.html`}));