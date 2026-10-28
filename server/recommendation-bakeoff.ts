import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { captureTrial, dashboard, DEFAULT_SOURCES, publicTrial, rateTrial, sourceIdentity, verifiedSource, canReveal, type Catalog } from "./recommendation-bakeoff-core";
import { createBakeoffStore } from "./recommendation-bakeoff-store";

export function createTmdbCatalog(key: string | undefined, fetcher: typeof fetch = fetch): Catalog {
  return async path => {
    if (!key) throw new Error("TMDB access is not configured.");
    // Intentionally no general API proxy, SDK search resolver, model, or app function.
    if (!/^\/(?:movie\/\d+(?:\/(?:recommendations|similar))?|tv\/\d+(?:\/(?:recommendations|similar))?|search\/multi)(?:\?[^#]*)?$/.test(path)) throw new Error("Non-catalog route blocked.");
    const url = new URL("https://api.themoviedb.org/3" + path);
    url.searchParams.set("api_key", key);
    const r = await fetcher(url, { method: "GET", redirect: "error", signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`Catalog request failed (HTTP ${r.status}).`);
    return r.json();
  };
}
async function authenticate(token: string): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!key) throw Object.assign(new Error("Admin authentication unavailable."), { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error("Please sign in."), { status: 401 });
  const profile = await db.from("admin_user_profiles").select("id, is_admin").eq("id", data.user.id).maybeSingle();
  if (profile.error || !profile.data?.is_admin || profile.data.id !== data.user.id) throw Object.assign(new Error("Admin access required."), { status: 403 });
  return data.user.id;
}
export function createBakeoffRouter(options: { catalog?: Catalog; authorize?: (token: string) => Promise<string>; store?: ReturnType<typeof createBakeoffStore> } = {}) {
  const router = Router(), catalog = options.catalog || createTmdbCatalog(process.env.TMDB_API_KEY);
  const store = options.store || createBakeoffStore(), authorize = options.authorize || authenticate;
  router.use(async (req, res, next) => {
    res.set("Cache-Control", "no-store, private");
    const token = /^Bearer (.+)$/i.exec(req.get("Authorization") || "")?.[1];
    if (!token) { res.status(401).json({ error: "Please sign in." }); return; }
    try { res.locals.actor = await authorize(token); next(); }
    catch (e: any) { res.status(e.status || 403).json({ error: e.message || "Admin access required." }); }
  });
  const route = (method: "get" | "post", path: string, fn: (req: any, actor: string) => Promise<unknown>) =>
    router[method](path, async (req, res) => { try { res.json(await fn(req, res.locals.actor)); } catch (e: any) { res.status(e.status || 400).json({ error: e.message || "Bake-off request failed." }); } });
  route("get", "/sources", async (_, actor) => store(async state => {
    const sources = new Map(DEFAULT_SOURCES.map(s => [s.id, s]));
    for (const trial of state.trials.filter(t => t.owner === actor)) sources.set(trial.source.id, trial.source);
    return { value: { sources: [...sources.values()], storageNotice: "Private evaluations are saved on this server, not in production recommendation caches. Export revealed results for backup; they are not synced across independent servers." } };
  }));
  route("get", "/search", async req => {
    const q = String(req.query.q || "").trim();
    if (q.length < 2 || q.length > 120) throw new Error("Search using 2–120 characters.");
    const d = await catalog("/search/multi?include_adult=false&page=1&query=" + encodeURIComponent(q));
    return { results: (d.results || []).filter((x: any) => ["movie", "tv"].includes(x.media_type) && x.id && (x.title || x.name)).slice(0, 12)
      .map((x: any) => ({ id: `${x.media_type}:${x.id}`, type: x.media_type, externalId: String(x.id), title: x.title || x.name, year: String(x.release_date || x.first_air_date || "").slice(0, 4) })) };
  });
  route("post", "/capture", async (req, actor) => {
    const identity = sourceIdentity(req.body.source);
    return store(async state => {
      const existing = state.trials.find(t => t.owner === actor && t.source.id === identity.id);
      if (existing) return { value: publicTrial(existing) };
      const source = await verifiedSource(identity, catalog);
      const trial = await captureTrial(actor, source, catalog);
      state.trials.push(trial);
      return { value: publicTrial(trial), write: true };
    });
  });
  route("get", "/dashboard", async (_, actor) => store(async state => ({ value: dashboard(state.trials.filter(t => t.owner === actor)) })));
  route("get", "/trials/:id", async (req, actor) => store(async state => {
    const t = state.trials.find(t => t.id === req.params.id && t.owner === actor);
    if (!t) throw Object.assign(new Error("Evaluation not found."), { status: 404 });
    return { value: publicTrial(t) };
  }));
  route("post", "/trials/:id/rate", async (req, actor) => store(async state => {
    const t = state.trials.find(t => t.id === req.params.id && t.owner === actor);
    if (!t) throw Object.assign(new Error("Evaluation not found."), { status: 404 });
    rateTrial(t, req.body); return { value: publicTrial(t), write: true };
  }));
  route("post", "/trials/:id/reveal", async (req, actor) => store(async state => {
    const t = state.trials.find(t => t.id === req.params.id && t.owner === actor);
    if (!t) throw Object.assign(new Error("Evaluation not found."), { status: 404 });
    if (t.revealedAt) return { value: publicTrial(t) };
    if (!canReveal(t)) throw new Error("Evaluation cannot be revealed.");
    t.revealedAt ||= new Date().toISOString();
    return { value: publicTrial(t), write: true };
  }));
  return router;
}
