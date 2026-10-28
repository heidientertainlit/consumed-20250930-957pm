import { randomInt, randomUUID, createHash } from "node:crypto";
import type { BakeoffColumn, BakeoffDashboard, BakeoffItem, BakeoffLabel, BakeoffRating, BakeoffSource, BakeoffSystem, BakeoffTrial } from "../shared/recommendation-bakeoff";
import snapshots from "./data/recommendation-bakeoff-snapshots.json";

export const SYSTEMS: BakeoffSystem[] = ["tmdb_recommendations", "tmdb_similar", "production", "experimental"];
export const DEFAULT_SOURCES: BakeoffSource[] = [
  ["tv", "250923", "Nobody Wants This", "2024"], ["tv", "1396", "Breaking Bad", "2008"],
  ["tv", "2316", "The Office (US)", "2005"], ["movie", "603", "The Matrix", "1999"],
  ["movie", "348", "Alien", "1979"], ["movie", "4348", "Pride & Prejudice", "2005"],
  ["tv", "111803", "The White Lotus", "2021"], ["tv", "76331", "Succession", "2018"],
  ["movie", "121986", "Frances Ha", "2013"], ["movie", "1236045", "Animals", "2026"],
].map(([type, externalId, title, year]) => ({ id: `${type}:${externalId}`, type: type as "movie" | "tv", externalId, title, year }));

export type PrivateColumn = BakeoffColumn & { system: BakeoffSystem; raw?: unknown; provenance: string };
export type PrivateTrial = Omit<BakeoffTrial, "columns" | "canReveal"> & { owner: string; columns: PrivateColumn[] };
export type SnapshotMap = Record<string, Partial<Record<"production" | "experimental", { items: BakeoffItem[]; provenance: string; capturedAt: string | null }>>>;
export const SAVED_SNAPSHOTS = snapshots as SnapshotMap;
export type Catalog = (path: string) => Promise<any>;

export function shuffledSystems(): BakeoffSystem[] {
  const result = [...SYSTEMS];
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function sourceIdentity(input: any): { type: "movie" | "tv"; externalId: string; id: string } {
  if (!input || !["movie", "tv"].includes(input.type) || !/^[1-9]\d{0,11}$/.test(String(input.externalId))) throw new Error("A valid Film/TV provider identity is required.");
  return { type: input.type, externalId: String(input.externalId), id: `${input.type}:${input.externalId}` };
}
export async function verifiedSource(input: any, catalog: Catalog): Promise<BakeoffSource> {
  const id = sourceIdentity(input), d = await catalog(`/${id.type}/${id.externalId}`);
  if (String(d.id) !== id.externalId || !(d.title || d.name)) throw new Error("Source could not be resolved.");
  return { ...id, title: d.title || d.name, year: String(d.release_date || d.first_air_date || "").slice(0, 4) };
}
export async function captureRawProvider(source: BakeoffSource, endpoint: "recommendations" | "similar", catalog: Catalog): Promise<Omit<PrivateColumn, "label" | "ratings" | "system">> {
  const capturedAt = new Date().toISOString();
  try {
    const data = await catalog(`/${source.type}/${source.externalId}/${endpoint}?page=1`);
    if (!Array.isArray(data.results)) throw new Error("Provider returned an invalid results envelope.");
    const rows = data.results.slice(0, 10);
    const items: BakeoffItem[] = [];
    // Promise.all retains the provider's array order, never network completion order.
    const verified = await Promise.all(rows.map(async (row: any, index: number) => {
      const item: BakeoffItem = {
        rank: index + 1, title: typeof (row?.title || row?.name) === "string" ? row.title || row.name : "Unresolved title",
        type: source.type, id: `${source.type}:tmdb:${row?.id ?? "unresolved"}`,
        poster: typeof row?.poster_path === "string" ? `https://image.tmdb.org/t/p/w185${row.poster_path}` : undefined,
      };
      if (!/^[1-9]\d*$/.test(String(row?.id)) || !(row?.title || row?.name)) {
        item.invalidReason = "Provider row has no valid title identity; original position retained.";
        return item;
      }
      try {
        const detail = await catalog(`/${source.type}/${row.id}`);
        if (String(detail.id) !== String(row.id) || !(detail.title || detail.name)) throw new Error("Identity mismatch");
      } catch {
        item.invalidReason = "Catalog resolution could not be verified; original position retained without substitution.";
      }
      return item;
    }));
    items.push(...verified);
    return { status: "available", items, raw: rows, capturedAt, provenance: `Direct TMDB ${endpoint}, page 1, first ten original positions. No poster/genre filtering, deduplication, blending, substitution or reranking.` };
  } catch (error) {
    return { status: "error", items: [], capturedAt, provenance: `Direct TMDB ${endpoint}`, unavailableReason: error instanceof Error ? error.message : "Capture failed" };
  }
}
export async function captureTrial(owner: string, source: BakeoffSource, catalog: Catalog, saved: SnapshotMap = SAVED_SNAPSHOTS): Promise<PrivateTrial> {
  const [recommendations, similar] = await Promise.all([
    captureRawProvider(source, "recommendations", catalog), captureRawProvider(source, "similar", catalog),
  ]);
  const results: Record<BakeoffSystem, Omit<PrivateColumn, "label" | "ratings" | "system">> = {
    tmdb_recommendations: recommendations, tmdb_similar: similar,
    production: { status: "unavailable", items: [], provenance: "No accessible existing Production snapshot. Live preparation/generation was not called." },
    experimental: { status: "unavailable", items: [], provenance: "No saved same-media primary Experimental output. No model call was made." },
  };
  for (const system of ["production", "experimental"] as const) {
    const snapshot = saved[source.id]?.[system];
    if (snapshot) results[system] = { status: "available", items: structuredClone(snapshot.items.slice(0, 10)),
      provenance: snapshot.provenance, capturedAt: snapshot.capturedAt || undefined };
  }
  return {
    id: randomUUID(), owner, source, createdAt: new Date().toISOString(), preference: null,
    columns: shuffledSystems().map((system, index) => ({ ...results[system], system, label: String.fromCharCode(65 + index) as BakeoffLabel, ratings: {} })),
  };
}
export function canReveal(trial: PrivateTrial): boolean {
  // Leaving items unrated is an intentional neutral/unsure choice.
  return !trial.revealedAt;
}
export function counts(c: PrivateColumn) {
  const result = { good: 0, bad: 0, unrated: 0 };
  for (const i of c.items.filter(i => !i.invalidReason)) {
    const verdict = c.ratings[String(i.rank)]?.verdict;
    if (verdict === "good" || verdict === "bad") result[verdict]++; else result.unrated++;
  }
  return result;
}
export function cohort(trial: PrivateTrial) {
  const available = (s: BakeoffSystem) => trial.columns.find(c => c.system === s)?.status === "available";
  const providers = available("tmdb_recommendations") && available("tmdb_similar");
  const production = providers && available("production");
  return { providers, production, full: production && available("experimental") };
}
export function publicTrial(trial: PrivateTrial): BakeoffTrial {
  const revealed = !!trial.revealedAt;
  return {
    id: trial.id, source: trial.source, createdAt: trial.createdAt, preference: trial.preference, canReveal: canReveal(trial),
    ...(revealed ? { revealedAt: trial.revealedAt, cohort: cohort(trial) } : {}),
    columns: trial.columns.map(c => ({
      label: c.label, status: c.status, ratings: c.ratings,
      items: c.items.map(({ poster, ...i }) => ({ ...i, ...(revealed && poster ? { poster } : {}) })),
      ...(revealed ? { system: c.system, provenance: c.provenance, capturedAt: c.capturedAt,
        unavailableReason: c.unavailableReason, fingerprint: createHash("sha256").update(JSON.stringify(c.items.map(i => [i.rank, i.id]))).digest("hex"),
        counts: counts(c) } : c.status !== "available" ? { unavailableReason: "This list is unavailable. No replacement results were generated." } : {}),
    })),
  };
}
export function rateTrial(trial: PrivateTrial, input: any): void {
  if (trial.revealedAt) throw new Error("Revealed evaluations are locked to preserve blind ratings.");
  if (input.preference !== undefined) {
    if (!["A", "B", "C", "D", "none"].includes(input.preference)) throw new Error("Invalid list preference.");
    if (input.preference !== "none") {
      const c = trial.columns.find(c => c.label === input.preference);
      if (!c || c.status !== "available" || !c.items.some(i => !i.invalidReason)) throw new Error("Unavailable or empty lists cannot win.");
    }
    trial.preference = input.preference;
  }
  if (input.rating !== undefined) {
    const c = trial.columns.find(c => c.label === input.label);
    const item = c?.items.find(i => i.rank === input.rank);
    if (!c || c.status !== "available" || !item || item.invalidReason) throw new Error("That original list position cannot be rated.");
    if (!input.rating || !["good", "bad", null].includes(input.rating.verdict) || typeof input.rating.note !== "string" || input.rating.note.length > 280) throw new Error("Use Good, Bad, or leave unrated, with an optional note up to 280 characters.");
    c.ratings[String(item.rank)] = { verdict: input.rating.verdict, note: input.rating.note } as BakeoffRating;
  }
  if (input.rating === undefined && input.preference === undefined) throw new Error("No rating or preference supplied.");
}
export function dashboard(trials: PrivateTrial[]): BakeoffDashboard {
  const done = trials.filter(t => t.revealedAt);
  const selected = (t: PrivateTrial) => t.columns.find(c => c.label === t.preference)?.system;
  function summarize(rows: PrivateTrial[], systems: BakeoffSystem[]) {
    return systems.map(system => {
      const available = rows.filter(t => t.columns.some(c => c.system === system && c.status === "available"));
      const sums = available.reduce((a, t) => {
        const n = counts(t.columns.find(c => c.system === system)!);
        a.good += n.good; a.bad += n.bad; a.unrated += n.unrated; return a;
      }, { good: 0, bad: 0, unrated: 0 });
      return { system, sources: available.length, ...sums, rated: sums.good + sums.bad,
        bestListChoices: available.filter(t => selected(t) === system).length };
    });
  }
  const groups = [
    { key: "providers" as const, name: "TMDB Recommendations vs TMDB Similar", systems: SYSTEMS.slice(0, 2) },
    { key: "production" as const, name: "TMDB pair + existing Production", systems: SYSTEMS.slice(0, 3) },
    { key: "full" as const, name: "Full four-system comparison + saved Experimental", systems: SYSTEMS },
  ];
  return {
    pendingCount: trials.length - done.length,
    completed: done.map(publicTrial),
    summary: summarize(done, SYSTEMS),
    overlaps: done.map(t => {
      const seen = new Map<string, { title: string; type: string; id: string; lists: { label: BakeoffLabel; system: BakeoffSystem; rank: number }[] }>();
      for (const c of t.columns) for (const item of c.items) {
        if (item.invalidReason) continue;
        const entry = seen.get(item.id) || { title: item.title, type: item.type, id: item.id, lists: [] };
        entry.lists.push({ label: c.label, system: c.system, rank: item.rank }); seen.set(item.id, entry);
      }
      return { source: t.source, titles: [...seen.values()].filter(x => new Set(x.lists.map(l => l.label)).size > 1) };
    }),
    cohorts: groups.map(g => {
      const eligible = done.filter(t => cohort(t)[g.key]);
      return {
        key: g.key, name: g.name, sources: eligible.length, noneChoices: eligible.filter(t => t.preference === "none").length,
        outsideCohortChoices: eligible.filter(t => selected(t) && !g.systems.includes(selected(t)!)).length,
        systems: summarize(eligible, g.systems),
      };
    }),
  };
}
