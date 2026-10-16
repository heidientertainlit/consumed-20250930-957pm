// Read-only adapter for existing media-detail cards. No preparation or ranking.
type Identity = { source: string; externalId: string; type: string };
type Auth = { authorized: boolean; caller?: string; userId?: string; status?: number };
type Dependencies = {
  authorize: (req: Request) => Promise<Auth>;
  read: (identity: Identity) => Promise<{ results: Record<string, unknown> } | null>;
};
const sources = ["tmdb", "openlibrary", "open_library", "googlebooks", "itunes", "spotify", "youtube"];
const types = ["movie", "tv", "book", "music", "podcast", "youtube"];
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json", "Cache-Control": "no-store",
};
export function mediaRecommendationPreview(deps: Dependencies) {
  return async (req: Request) => {
    const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (req.method === "OPTIONS") return respond({ ok: true });
    if (req.method !== "POST") return respond({ error: "POST required" }, 405);
    try {
      const auth = await deps.authorize(req);
      if (!auth.authorized || auth.caller !== "admin" || !auth.userId)
        return respond({ error: "A human admin session is required" }, auth.status || 403);
      const text = await req.text();
      if (text.length > 2048) return respond({ error: "Request too large" }, 413);
      let body: any;
      try { body = JSON.parse(text); } catch { return respond({ error: "Invalid JSON" }, 400); }
      if (!body || Array.isArray(body) || Object.keys(body).some(k => !["source", "externalId", "type"].includes(k))
        || !sources.includes(body.source) || !types.includes(body.type)
        || typeof body.externalId !== "string" || !body.externalId.trim() || body.externalId.length > 200)
        return respond({ error: "An exact media identity is required" }, 400);
      const run = await deps.read(body);
      if (!run || !Array.isArray(run.results?.semantic))
        return respond({ available: false, items: [], variant: "semantic" });
      const seen = new Set<string>();
      const items = run.results.semantic.flatMap((row: any) => {
        const w = row?.item;
        if (!w || w.source_verified !== true || !sources.includes(w.external_source)
          || !types.includes(w.media_type) || typeof w.external_id !== "string" || !w.external_id
          || typeof w.title !== "string" || !w.title.trim()) return [];
        const key = `${w.media_type}:${w.external_source}:${w.external_id}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{
          title: w.title, type: w.media_type, external_source: w.external_source,
          external_id: w.external_id, poster_url: w.source_metadata?.poster_url || "",
        }];
      }).slice(0, 6);
      return respond({ available: true, items, variant: "semantic" });
    } catch {
      return respond({ error: "Experimental recommendations could not be read. No preparation was attempted." }, 503);
    }
  };
}
