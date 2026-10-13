import { normalizeMediaIdentityText as normalize } from "./canonical-media.ts";
import { requirePersonaMediaIdentity } from "./persona-media-identity.ts";
import { hasFactualClaim, researchAngles, researchTypes, type ResearchTitle, type ResearchType, type ResearchAngle, type ResearchChart, type ResearchResult } from "../../../shared/content-research.ts";

type Row = Record<string, any>;
export class ResearchError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const text = (v: unknown, max = 300): string => typeof v === "string" ? v.trim().slice(0, max) : "";
const year = (v: unknown) => String(v || "").match(/^\d{4}/)?.[0] || "";
export const identityKey = (r: ResearchTitle) => `${r.type}:${r.external_source}:${r.external_id}`;
export function catalogTitle(raw: Row): ResearchTitle | null {
  if (!raw || typeof raw !== "object") return null;
  const type = raw.type || raw.media_type;
  if (!researchTypes.includes(type)) return null;
  const source = ({ tmdb_movie: "tmdb", "apple-music": "itunes", "apple-podcasts": "itunes" } as Row)[raw.external_source] || raw.external_source;
  const id = String(raw.external_id || "").replace(/^\/(?=works\/)/, "");
  const title = text(raw.title);
  if (!title || /^(ai_|undefined|null)/i.test(id)) return null;
  try { requirePersonaMediaIdentity(id, source); } catch { return null; }
  let url = "";
  if (source === "tmdb" && ["tv", "movie"].includes(type) && /^\d+$/.test(id)) url = `https://www.themoviedb.org/${type}/${id}`;
  if (source === "googlebooks" && type === "book" && /^[\w-]+$/.test(id)) url = `https://books.google.com/books?id=${id}`;
  if (source === "openlibrary" && type === "book" && /^works\/OL\d+W$/.test(id)) url = `https://openlibrary.org/${id}`;
  if (source === "itunes" && ["music", "podcast"].includes(type) && /^\d+$/.test(id)) url = `https://${type === "music" ? "music" : "podcasts"}.apple.com/us/${type === "music" ? ["song", "track"].includes(raw.media_subtype) ? "song" : "album" : "podcast"}/${id}`;
  if (source === "spotify" && ["music", "podcast"].includes(type) && /^[A-Za-z0-9]{22}$/.test(id)) url = `https://open.spotify.com/${type === "podcast" ? "show" : raw.media_subtype === "album" ? "album" : "track"}/${id}`;
  if (source === "rawg" && type === "game" && /^\d+$/.test(id)) url = `https://rawg.io/games/${id}`;
  if (source === "youtube" && type === "youtube") {
    if (/^UC[\w-]{22}$/.test(id)) url = `https://www.youtube.com/channel/${id}`;
    else if (/^[\w-]{11}$/.test(id)) url = `https://www.youtube.com/watch?v=${id}`;
  }
  if (!url) return null;
  const creator = text(raw.creator);
  return { title, type, external_source: source, external_id: id, source_url: url,
    creator: /^unknown/i.test(creator) ? "" : creator, year: year(raw.year || raw.release_date),
    media_subtype: source === "youtube" ? (id.startsWith("UC") ? "channel" : "video") : text(raw.media_subtype, 30),
    image: /^https:\/\//.test(raw.image || raw.poster_url || raw.image_url || "") ? (raw.image || raw.poster_url || raw.image_url) : undefined };
}
export function resolveCandidate(candidate: Row, rows: ResearchTitle[]): ResearchTitle | null {
  const matches = rows.filter(r => r.type === candidate.type && normalize(r.title) === normalize(candidate.title)
    && (!candidate.year || !r.year || year(candidate.year) === r.year)
    && (!candidate.creator || !r.creator || normalize(candidate.creator) === normalize(r.creator))
    && (!candidate.media_subtype || r.media_subtype === candidate.media_subtype));
  const unique = [...new Map(matches.map(r => [identityKey(r), r])).values()];
  // Unknown metadata cannot break a tie. Never trust search order.
  return unique.length === 1 ? unique[0] : null;
}
export function chartMetadata(item: Row, payload: Row, now = Date.now()): ResearchChart {
  const type = item.media_type || item.type;
  const group = ["tv", "movie"].includes(type) ? "streaming" : type === "book" ? "books" : type === "podcast" ? "podcasts" : "music";
  const state = payload.source_status?.[group];
  const date = text(item.chart_date, 10);
  const age = now - Date.parse(date);
  const status = state === "unavailable" || !Number.isFinite(age) || !item.source_label || !item.chart_country
    ? "unavailable" : state === "stale" || age > (type === "book" ? 8 : 2) * 86400000 ? "stale" : "current";
  return { source_label: text(item.source_label), source_key: text(item.source_key),
    chart_country: text(item.chart_country, 10), chart_date: date, status };
}
export type ResearchInput =
  | { action: "search"; query: string; type?: ResearchType }
  | { action: "trending" }
  | { action: "generate"; seed: ResearchTitle; chart?: ResearchChart; angle: ResearchAngle; types: ResearchType[] };
export function validateResearchInput(body: Row): ResearchInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ResearchError("A JSON object is required");
  if (body.action === "trending") return { action: "trending" };
  if (body.action === "search") {
    if (typeof body.query !== "string" || body.query.trim().length < 2 || body.query.length > 150 ||
      (body.type !== undefined && !researchTypes.includes(body.type))) throw new ResearchError("Use a 2–150 character query and a supported media type");
    return { action: "search", query: body.query.trim(), ...(body.type ? { type: body.type } : {}) };
  }
  if (body.action !== "generate" || !researchAngles.includes(body.angle) || !Array.isArray(body.types) ||
    body.types.length < 1 || body.types.length > 7 || body.types.some((t: any) => !researchTypes.includes(t))) throw new ResearchError("Choose an angle and 1–7 supported output types");
  const seed = catalogTitle(body.seed);
  if (!seed) throw new ResearchError("Select a real catalog seed");
  return { action: "generate", seed, angle: body.angle, types: [...new Set(body.types)] as ResearchType[],
    // Chart values are a lookup hint, not trusted provenance.
    ...(body.chart ? { chart: body.chart } : {}) };
}
export interface ResearchServices {
  search(query: string, type?: ResearchType): Promise<ResearchTitle[]>;
  charts(): Promise<Row>;
  candidates(seed: ResearchTitle, angle: ResearchAngle, types: ResearchType[]): Promise<unknown>;
  warnings?(): string[];
}
export async function runResearch(input: ResearchInput, services: ResearchServices): Promise<any> {
  if (input.action === "search") {
    const results = await services.search(input.query, input.type);
    return { results, feedback: services.warnings?.() || [] };
  }
  if (input.action === "trending") {
    const payload = await services.charts();
    const feedback = Object.entries(payload.source_status || {}).filter(([, v]) => v !== "available").map(([k, v]) => `${k} chart: ${v}`);
    const items = (Array.isArray(payload.items) ? payload.items : []).slice(0, 150).flatMap((item: Row) => {
      const title = catalogTitle(item);
      if (!title) {
        const chart = chartMetadata(item, payload);
        feedback.push(`${text(item.title) || "Chart title"} (${chart.source_label || "Unknown chart"} · ${chart.chart_country || "country unavailable"} · ${chart.chart_date || "date unavailable"} · ${chart.status}): catalog identity could not be verified${item.media_type === "book" && item.external_source === "openlibrary" && /^[0-9Xx]{10,13}$/.test(String(item.external_id)) ? " from the chart ISBN (not an Open Library work ID)" : ""}. Excluded; use catalog search to select a verified title instead.`);
      }
      return title ? [{ ...title, chart: chartMetadata(item, payload) }] : [];
    });
    return { items, feedback };
  }
  const found = await services.search(input.seed.title, input.seed.type);
  const seed = found.find(r => identityKey(r) === identityKey(input.seed) && normalize(r.title) === normalize(input.seed.title));
  if (!seed) throw new ResearchError("Seed could not be reverified. Search and select it again.", 422);
  const result: ResearchResult = { seed, picks: [], feedback: [] };
  if (input.chart) {
    try {
      const payload = await services.charts();
      const item = (payload.items || []).find((r: Row) => {
        const title = catalogTitle(r);
        return title && identityKey(title) === identityKey(seed) && r.source_key === input.chart!.source_key;
      });
      result.chart = item ? chartMetadata(item, payload) : { source_label: "", source_key: "", chart_country: "", chart_date: "", status: "unavailable" };
    } catch { result.chart = { source_label: "", source_key: "", chart_country: "", chart_date: "", status: "unavailable" }; }
    if (result.chart.status !== "current") result.feedback.push(`Seed chart is ${result.chart.status}; picks are not claimed to be trending.`);
  }
  const raw = await services.candidates(seed, input.angle, input.types);
  if (!Array.isArray(raw)) throw new ResearchError("Generation returned invalid candidates. Please retry.", 502);
  const seen = new Set([identityKey(seed)]);
  const seenWorks = new Set([`${seed.type}:${normalize(seed.title)}`]);
  // Two candidates per requested type; bounded sequential work inside 3 batches.
  const candidates = input.types.flatMap(type => raw.filter(c => c && c.type === type).slice(0, 2)).slice(0, 14);
  const resolved: Array<{ pick?: any; feedback?: string }> = [];
  for (let offset = 0; offset < candidates.length; offset += 3) {
    resolved.push(...await Promise.all(candidates.slice(offset, offset + 3).map(async c => {
      const title = text(c.title, 150), rationale = text(c.rationale, 700);
      if (!title || !rationale || hasFactualClaim(rationale) || (c.relationship && c.relationship !== "editorial similarity"))
        return { feedback: `${title || "Candidate"} excluded: unsupported factual relationship or missing explanation.` };
      try {
        const match = resolveCandidate({ ...c, title }, await services.search(title, c.type));
        if (!match) return { feedback: `${title}: no unambiguous catalog match; excluded.` };
        return { pick: { ...match, catalog_verified: true, rationale, relationship: "editorial similarity" } };
      } catch { return { feedback: `${title}: catalog provider unavailable; excluded.` }; }
    })));
  }
  for (const row of resolved) {
    if (row.feedback) result.feedback.push(row.feedback);
    if (!row.pick) continue;
    const key = identityKey(row.pick), work = `${row.pick.type}:${normalize(row.pick.title)}`;
    if (seen.has(key) || seenWorks.has(work)) { result.feedback.push(`${row.pick.title}: duplicate or seed excluded.`); continue; }
    seen.add(key); seenWorks.add(work); result.picks.push(row.pick);
  }
  for (const type of input.types) {
    const count = result.picks.filter(p => p.type === type).length;
    if (count < 2) result.feedback.push(`${type}: ${count} of 2 requested picks verified. No filler added.`);
  }
  result.feedback.push(...(services.warnings?.() || []));
  return result;
}
