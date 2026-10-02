/**
 * Local-only test runner. Reads checked-in fictional persona definitions, calls read-only
 * media providers and the writing API, then writes reports locally. No Supabase client,
 * draft inserts, scheduling or publishing code is reachable from this runner.
 */
import fs from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { DEFAULT_MODE_WEIGHTS, deriveSocialVoice, parseGenerationNotes, POST_MODES, type Persona, type MediaCandidate } from "../supabase/functions/_shared/persona-generation.ts";
import { buildPersonaCandidates, createPersonaChat, fetchTrendingCandidates, resolveMediaCandidate } from "../supabase/functions/_shared/persona-media-candidates.ts";
import { generatePersonaBatch } from "../supabase/functions/_shared/persona-generation-engine.ts";

const out = process.argv[2] || "reports/persona-generator-test-batch";
const comparisonPath = process.argv[3];
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
const chat = createPersonaChat(process.env.OPENAI_API_KEY);
const keys = {tmdb:process.env.TMDB_API_KEY,books:process.env.GOOGLE_BOOKS_API_KEY,rawg:process.env.RAWG_API_KEY};
const trending = await fetchTrendingCandidates(keys);
const candidates = new Map<string,MediaCandidate[]>();
const cache = new Map<string,Promise<any>>();
const resolve = (title:string,type:string) => {
  const key=`${type}:${title.toLowerCase()}`;
  if(!cache.has(key)) cache.set(key,resolveMediaCandidate(title,type,keys));
  return cache.get(key)!;
};
for(let start=0;start<personas.length;start+=3) {
  await Promise.all(personas.slice(start,start+3).map(async p=>{
    deriveSocialVoice(p.persona_config);
    const values=await buildPersonaCandidates(p,trending,[],chat,resolve);
    candidates.set(p.id,values);
    console.log(`Candidates prepared: ${p.display_name}, ${values.length} verified choices`);
  }));
}
const result = await generatePersonaBatch({personas,postsPerPersona:2,weights:DEFAULT_MODE_WEIGHTS,recent:[],candidates,chat});
await fs.mkdir(path.dirname(out),{recursive:true});
const modes = countModes(result.drafts);
await fs.writeFile(`${out}.json`,JSON.stringify({dryRun:true,source:"Checked-in persona definitions; no live history/config queried",weights:DEFAULT_MODE_WEIGHTS,modeCounts:modes,comparisonBaseline:comparisonPath,previousModeCounts,...result},null,2));
const escape=(s:unknown)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const cards=result.drafts.map((d,i)=>{
  const meta=JSON.parse(d.ai_notes).generation;
  return `<article><div class="number">${i+1}</div><h2>${escape(d.persona_display_name)}</h2><div class="details">${escape(d.media_title)} · ${escape(d.media_type)}<br>${escape(meta.modeLabel)} · ${d.rating===null?"No rating":`${d.rating}/5`} · ${escape(meta.mediaSource)}</div><blockquote>${d.content?escape(d.content):"<i>Rating only — no text</i>"}</blockquote><details><summary>Admin generation metadata</summary><pre>${escape(JSON.stringify(meta,null,2))}</pre></details></article>`;
}).join("");
const distribution = `<section><h2>Mode distribution — weights unchanged</h2><table><thead><tr><th>Mode</th><th>Base weight</th>${previousModeCounts ? "<th>Previous batch</th>" : ""}<th>This batch</th></tr></thead><tbody>${POST_MODES.map(({id,label})=>`<tr><td>${escape(label)}</td><td>${DEFAULT_MODE_WEIGHTS[id]}</td>${previousModeCounts ? `<td>${previousModeCounts[id]}</td>` : ""}<td>${modes[id]} (${result.drafts.length ? Math.round(modes[id]/result.drafts.length*100) : 0}%)</td></tr>`).join("")}</tbody></table><p class="note">Same checked-in personas and weights; fresh random media/mode assignments, not a paired or quota-balanced experiment. These counts describe the actual outputs, not a quality score.</p></section>`;
await fs.writeFile(`${out}.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consumed — Persona generation review</title><style>body{margin:0;background:#0a0e18;color:#edf0f9;font:16px/1.6 system-ui;padding:32px}main{max-width:1000px;margin:auto}h1{font-size:32px;margin-bottom:8px}header{margin-bottom:32px}.note{color:#b1b8cd}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px}article{position:relative;padding:24px;border:1px solid #2d354b;background:#141b2b;border-radius:16px}h2{font-size:18px;margin:0 28px 8px 0}.number{float:right;color:#aa80ff}.details{font-size:13px;color:#aeb8d2}blockquote{margin:20px 0;white-space:pre-wrap}summary{font-size:12px;color:#bd9aff;cursor:pointer}pre{font-size:11px;white-space:pre-wrap}.stats{padding:12px 16px;background:#241a40;border-radius:10px;font-size:13px}a{color:#d5c0ff}section{margin:24px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:8px;border-bottom:1px solid #2d354b}th{color:#bd9aff}@media(max-width:480px){body{padding:16px}th,td{padding:6px 4px;font-size:11px}}</style><main><header><h1>Persona generation review</h1><p class="note">${result.drafts.length} actual AI-generated sample posts across ${personas.length} fictional personas. Local dry run: nothing saved to a database, scheduled or published.</p><p class="note">Uses checked-in persona configurations and verified provider media. Live pending/scheduled/published history and any live voice overrides were not queried for this sample.</p><div class="stats">${result.errors.length?escape(result.errors.join("; ")):"No generation errors."}</div>${distribution}</header><div class="grid">${cards}</div></main></html>`);
console.log(JSON.stringify({generated:result.drafts.length,modeCounts:modes,errors:result.errors,report:`${out}.html`}));