/**
 * Opt-in live provider smoke test (incurs one model request). Exercises the local
 * research engine with deployed catalog endpoints, not deployed admin auth/SQL.
 * Never uses a service-role key or prints credentials.
 * Run: npx tsx scripts/check-content-research-live.ts --live
 */
import { createResearchServices } from "../supabase/functions/_shared/content-research-providers.ts";
import { runResearch } from "../supabase/functions/_shared/content-research.ts";
import { researchTypes, researchExport } from "../shared/content-research.ts";

if (!process.argv.includes("--live")) throw new Error("Pass --live to explicitly allow provider/model calls.");
const token = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY;
if (!token || !process.env.OPENAI_API_KEY) throw new Error("Catalog and generation credentials must be configured.");
const services = createResearchServices({
  baseUrl: process.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co",
  authorization: `Bearer ${token}`,
  openaiKey: process.env.OPENAI_API_KEY,
  tmdbKey: process.env.TMDB_API_KEY,
});
try {
  const rows = await services.search("The White Lotus", "tv");
  const seed = rows.find(r => r.external_source === "tmdb" && r.external_id === "111803");
  if (!seed) throw new Error("The White Lotus could not be verified by the live catalog.");
  const result = await runResearch({ action: "generate", seed, angle: "themes", types: [...researchTypes] }, services);
  const exported = researchExport(result.seed, result.picks.map((p: any) => ({ ...p, selected: true })), "themes");
  console.log(JSON.stringify({
    check: "Live providers + local research engine; NOT deployed admin authorization or SQL",
    seed: result.seed,
    verifiedPicks: result.picks.map((p: any) => ({ title: p.title, type: p.type, source: p.external_source, id: p.external_id, creator: p.creator, rationale: p.rationale })),
    feedback: result.feedback, exportCount: exported.count,
  }, null, 2));
  if (!exported.count) process.exitCode = 1;
} catch {
  console.error("Live research check failed: catalog/model unavailable or seed unverified. No credentials or provider response bodies logged.");
  process.exitCode = 1;
}
