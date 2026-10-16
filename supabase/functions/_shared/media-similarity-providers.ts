import type { LabWork } from "../../../shared/recommendation-lab.ts";
import type { SimilarityIdentity } from "../../../shared/media-similarity.ts";
import { createLabProviders, normalize } from "./recommendation-lab-providers.ts";

// Reuse provider verification without changing shared search or the lab worker.
export function createSimilarityProviders(env: (key: string) => string | undefined, fetcher: typeof fetch = fetch) {
  const base = createLabProviders(env, fetcher);
  const clean = (s: unknown) => String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 6000);
  async function json(url: string, init?: RequestInit) {
    const r = await fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`Catalog request failed (${r.status})`);
    return r.json();
  }
  function tmdb(route: string) {
    const key = env("TMDB_API_KEY");
    if (!key) throw new Error("TMDB credential unavailable");
    return `https://api.themoviedb.org/3/${route}${route.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key)}`;
  }
  function youtube(route: string) {
    const key = env("YOUTUBE_API_KEY");
    if (!key) throw new Error("YouTube credential unavailable");
    return `https://www.googleapis.com/youtube/v3/${route}&key=${encodeURIComponent(key)}`;
  }
  let spotifyToken: Promise<string> | undefined;
  async function spotify(route: string) {
    spotifyToken ||= (async () => {
      const client = env("SPOTIFY_CLIENT_ID"), secret = env("SPOTIFY_CLIENT_SECRET");
      if (!client || !secret) throw new Error("Spotify credential unavailable");
      const d = await json("https://accounts.spotify.com/api/token", { method: "POST",
        headers: { Authorization: `Basic ${btoa(`${client}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials" });
      if (!d.access_token) throw new Error("Spotify authorization unavailable");
      return d.access_token as string;
    })();
    return json(`https://api.spotify.com/v1/${route}`, { headers: { Authorization: `Bearer ${await spotifyToken}` } });
  }
  async function details(source: string, id: string, type: string): Promise<LabWork> {
    let m: Record<string, any>;
    if (["tmdb", "openlibrary", "googlebooks", "itunes"].includes(source)) {
      const allowed = source === "tmdb" ? ["movie", "tv"] : source === "itunes" ? ["music", "podcast"] : ["book"];
      if (!allowed.includes(type)) throw new Error("Provider media type mismatch");
      const work = await base.details(source, id, type);
      return { ...work, id: `${type}:${source}:${id}` };
    }
    if (source === "youtube" && type === "youtube") {
      const channel = /^UC[\w-]{22}$/.test(id);
      const handle = /^@[\w.-]{3,30}$/.test(id);
      if (!channel && !handle && !/^[\w-]{11}$/.test(id)) throw new Error("Invalid YouTube identity");
      const d = await json(youtube(`${channel || handle ? "channels" : "videos"}?part=snippet&${handle ? "forHandle" : "id"}=${encodeURIComponent(id)}`));
      const s = (handle ? d.items?.[0] : d.items?.find((x: any) => x.id === id))?.snippet;
      if (!s) throw new Error("YouTube title unavailable");
      m = { title: s.title, creator: s.channelTitle || s.title, description: clean(s.description), subjects: s.tags || [],
        poster_url: s.thumbnails?.high?.url || s.thumbnails?.default?.url || "", media_subtype: channel || handle ? "channel" : "video" };
    } else if (source === "spotify" && ["music", "podcast"].includes(type)) {
      const sid = id.replace(/^spotify_/, "");
      if (!/^[a-zA-Z0-9]{22}$/.test(sid)) throw new Error("Invalid Spotify identity");
      let d: any;
      if (type === "podcast") {
        try { d = await spotify(`shows/${sid}?market=US`); }
        catch { d = await spotify(`episodes/${sid}?market=US`); }
      }
      else {
        try { d = await spotify(`albums/${sid}?market=US`); }
        catch { d = await spotify(`tracks/${sid}?market=US`); }
      }
      let genres = d.genres || [];
      const artistId = d.artists?.[0]?.id;
      if (type === "music" && !genres.length && /^[a-zA-Z0-9]{22}$/.test(artistId || "")) {
        try { genres = (await spotify(`artists/${artistId}`)).genres || []; } catch { /* Keep missing genres explicit. */ }
      }
      m = { title: d.name, creator: d.publisher || d.show?.publisher || (d.artists || []).map((x: any) => x.name).join(", "),
        description: clean(d.description), subjects: genres,
        poster_url: d.images?.[0]?.url || d.album?.images?.[0]?.url || "" };
    } else throw new Error("This provider identity cannot yet be independently verified");
    if (!m.title) throw new Error("Catalog returned no title");
    return { id: `${type}:${source}:${id}`, external_source: source, external_id: id, media_type: type,
      title: m.title, source_metadata: m, source_verified: true,
      destination_path: `/media/${type}/${source}/${id.split("/").map(encodeURIComponent).join("/")}`,
      verification: { method: "exact_provider_id", verified_at: new Date().toISOString() }, profile: {}, status: "verified" };
  }
  // Candidate discovery is catalog-based, not an LLM inventing recommendations.
  // Independent lanes prevent a same-format source from consuming every slot.
  async function recall(source: LabWork): Promise<SimilarityIdentity[]> {
    const m = source.source_metadata;
    const labels = Object.values(source.profile).flatMap(v => (v || []).map(x => x.label));
    const subjects = (m.subjects || []).flatMap((s: string) => s.split("/")).map((s: string) => s.trim())
      .filter((s: string) => !/^(fiction|general|nonfiction)$/i.test(s));
    const term = String(subjects.at(-1) || source.profile.themes?.[0]?.label || labels[0] || m.creator || source.title).slice(0, 90);
    const lanes: SimilarityIdentity[][] = [];
    lanes.push((source.verification.recommendations || []).map((r: any) => ({ source: r.source, externalId: r.id, type: r.type })));
    const attempt = async (fn: () => Promise<SimilarityIdentity[]>): Promise<SimilarityIdentity[]> => {
      try { return await fn(); } catch { return []; /* Other lanes remain usable. */ }
    };
    lanes.push(...await Promise.all([
      attempt(async () => {
        const q = `subject:${term}`;
        const d = await json(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=4`);
        return (d.docs || []).map((x: any) => ({ source: "openlibrary", externalId: x.key.replace(/^\/works\//, ""), type: "book" }));
      }),
      ...(source.media_type === "book" && m.creator ? [attempt(async () => {
        const d = await json(`https://openlibrary.org/search.json?author=${encodeURIComponent(m.creator)}&limit=3`);
        return (d.docs || []).map((x: any) => ({ source: "openlibrary", externalId: x.key.replace(/^\/works\//, ""), type: "book" }));
      })] : []),
      attempt(async () => {
        const d = await json(tmdb(`search/keyword?query=${encodeURIComponent(term)}`));
        const keyword = d.results?.find((x: any) => normalize(x.name) === normalize(term)) || d.results?.[0];
        if (!keyword) return [];
        const found = await Promise.all(["movie", "tv"].map(async type => {
          const results = await json(tmdb(`discover/${type}?with_keywords=${keyword.id}&sort_by=popularity.desc&include_adult=false`));
          return (results.results || []).slice(0, 3).map((x: any) => ({ source: "tmdb", externalId: String(x.id), type }));
        }));
        return found.flat() as SimilarityIdentity[];
      }),
      ...["movie", "tv"].map(type => attempt(async () => {
        const genres = await json(tmdb(`genre/${type}/list`));
        const evidence = normalize([...subjects, ...labels].join(" "));
        const genre = (genres.genres || []).find((g: any) => normalize(g.name).split(" ").some((w: string) => w.length > 3 && evidence.includes(w)));
        if (!genre) return [];
        const d = await json(tmdb(`discover/${type}?with_genres=${genre.id}&sort_by=popularity.desc&include_adult=false`));
        return (d.results || []).slice(0, 3).map((x: any) => ({ source: "tmdb", externalId: String(x.id), type }));
      })),
      ...["podcast", "music"].map(type => attempt(async () => {
        const query = type === "music" ? (source.media_type === "music" ? m.creator || term : `${source.title} soundtrack`) : term;
        const d = await json(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=${type}&entity=${type === "music" ? "album" : "podcast"}&limit=3&country=US`);
        return (d.results || []).map((x: any) => ({ source: "itunes", externalId: String(x.collectionId || x.trackId), type }));
      })),
      // YouTube search has a significant quota cost: only use it for YouTube sources.
      ...(source.media_type === "youtube" ? [attempt(async () => {
        const d = await json(youtube(`search?part=snippet&type=video&maxResults=3&q=${encodeURIComponent(term)}`));
        return (d.items || []).map((x: any) => ({ source: "youtube", externalId: x.id.videoId, type: "youtube" }));
      })] : []),
    ]));
    // Round-robin lanes in declaration order, never network completion order.
    // Keep provider positions and creator/subject discovery independently useful.
    const byType = new Map<string, SimilarityIdentity[]>();
    const interleaved = Array.from({ length: 6 }, (_, index) => lanes.map(lane => lane[index]).filter(Boolean)).flat();
    for (const id of interleaved) {
      if (id.source === source.external_source && id.externalId === source.external_id) continue;
      const list = byType.get(id.type) || [];
      if (!list.some(x => x.source === id.source && x.externalId === id.externalId)) list.push(id);
      byType.set(id.type, list);
    }
    return [...byType.values()].flatMap(list => list.slice(0, 3)).slice(0, 21);
  }
  return { details, recall };
}
