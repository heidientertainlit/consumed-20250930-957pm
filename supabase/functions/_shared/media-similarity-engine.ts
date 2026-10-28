import { similarityKey, similarityResultKey, similarityCards, type SimilarityIdentity, type SimilarityResponse } from "../../../shared/media-similarity.ts";
import type { LabWork } from "../../../shared/recommendation-lab.ts";
import { createLabModels, type LabStore } from "./recommendation-lab-models.ts";
import { rankLab, sameWork } from "./recommendation-lab-ranking.ts";
import { createSimilarityProviders } from "./media-similarity-providers.ts";
import { selectWithB } from "./media-similarity-selector.ts";

export type SimilarityStore = (action: string, payload?: Record<string, any>) => Promise<any>;
export const SOURCE_RESERVATION_USD = 0.25;
export const DAILY_LIMIT_USD = 1;

// A bounded reservation ledger, reused by the reviewed model extractor.
// Unknown network outcomes retain their reservation rather than being "free".
export function similarityMeter() {
  const reservations = new Map<string, number>();
  let spent = 0;
  const store: LabStore = async (action, value = {}) => {
    if (action === "reserve") {
      if (!(value.amount > 0) || spent + [...reservations.values()].reduce((a, b) => a + b, 0) + value.amount > SOURCE_RESERVATION_USD)
        throw new Error("Per-title preparation budget reached");
      reservations.set(value.token, value.amount);
    } else if (action === "settle") {
      if (!reservations.has(value.token) || !Number.isFinite(value.actual) || value.actual < 0 ||
          value.actual > reservations.get(value.token)!) throw new Error("Invalid model settlement");
      spent += value.actual;
      reservations.delete(value.token);
    } else throw new Error("Unsupported model ledger action");
  };
  return { store, cost: () => spent + [...reservations.values()].reduce((a, b) => a + b, 0) };
}

export function createMediaSimilarity(
  store: SimilarityStore, env: (key: string) => string | undefined,
  defer: (work: Promise<unknown>) => void, fetcher: typeof fetch = fetch,
) {
  async function prepare(identity: SimilarityIdentity, key: string, token: string, existing: ReturnType<typeof similarityCards>) {
    const meter = similarityMeter();
    const deadline = Date.now() + 145_000;
    let calls = 0;
    const bounded: typeof fetch = async (url, init) => {
      if (++calls > 85 || Date.now() >= deadline) throw new Error("Preparation request/time bound reached");
      const signal = AbortSignal.any([AbortSignal.timeout(Math.max(1, deadline - Date.now())), ...(init?.signal ? [init.signal] : [])]);
      return fetcher(url, { ...init, signal });
    };
    const providers = createSimilarityProviders(env, bounded);
    const models = createLabModels(meter.store, env("OPENAI_API_KEY"), bounded);
    const useB = ["movie", "tv"].includes(identity.type);
    let items: ReturnType<typeof similarityCards> = [], error: string | null = null;
    try {
      async function profile(id: SimilarityIdentity, catalogOnly = false) {
        const cacheKey = similarityKey(id);
        const saved = await store("profile", { key: cacheKey });
        if (saved) return saved as LabWork;
        let work = await providers.details(id.source, id.externalId, id.type);
        // B only needs catalog facts. Do not replace the shared intelligence
        // pool with unembedded candidate profiles or pay for new embeddings.
        if (catalogOnly) return work as LabWork;
        work = await models.profile(work);
        await store("save_profile", { key: cacheKey, identity: id, work });
        return work as LabWork;
      }
      const source = await profile(identity);
      const [pool, recalled, direct] = await Promise.all([
        store("pool"), providers.recall(source),
        useB ? providers.recommendationsForB(source).catch(() => []) : Promise.resolve([]),
      ]);
      const identities = useB
        ? [...new Map([...direct, ...recalled.filter(id => id.type === identity.type)].map(id => [similarityKey(id), id])).values()].slice(0, 26)
        : recalled;
      const discovered: LabWork[] = [];
      // Four workers, a bounded pool, and independently verified candidates.
      let next = 0;
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (next < identities.length && Date.now() < deadline) {
          const index = next++, id = identities[index];
          try { discovered[index] = await profile(id, useB); }
          catch { /* Missing evidence stays missing; other verified candidates remain usable. */ }
        }
      }));
      // Preserve discovery order, not asynchronous verification completion order.
      const candidates: LabWork[] = useB
        ? [...discovered.filter(Boolean), ...(pool || [])] : [...(pool || []), ...discovered.filter(Boolean)];
      const results = rankLab(source, candidates.filter(w => !sameWork(source, w)), true);
      items = similarityCards(results.map(({ item }) => ({ title: item.title, type: item.media_type,
        external_source: item.external_source, external_id: item.external_id, poster_url: item.source_metadata.poster_url || "" })));
      if (useB) {
        try {
          const positions = new Map(direct.map(id => [`${id.type}:${id.source}:${id.externalId}`, id.position]));
          const selected = await selectWithB(source, candidates, meter.store, env("OPENAI_API_KEY"), bounded, positions);
          const cards = similarityCards(selected.map(item => ({ title: item.title, type: item.media_type,
            external_source: item.external_source, external_id: item.external_id, poster_url: item.source_metadata.poster_url || "" })));
          if (cards.length < 2) throw new Error("B returned fewer than two publishable recommendations");
          items = cards;
        } catch (e) {
          // Keep a working list, without filling or reranking B's partial output.
          // Existing cache TTL/backoff prevents repeated paid fallback attempts.
          console.warn("B selection unavailable; retaining existing recommendations:", (e as Error).message);
          if (existing.length >= 2) items = existing;
        }
      }
      if (!items.length) error = "No source-supported recommendations available";
    } catch (e) {
      error = (e as Error).message;
    } finally {
      // Only the current lease owner may publish and settle the global budget.
      await store("finish", { key, token, items, cost: meter.cost(), error: error?.slice(0, 500) || null });
    }
  }
  async function load(identity: SimilarityIdentity, actor: string): Promise<SimilarityResponse> {
    const key = similarityResultKey(identity);
    const cached = await store("read", { key });
    let items = similarityCards(cached?.items);
    if (cached?.fresh) return { items, preparing: false };
    if (!items.length && key !== similarityKey(identity)) {
      items = similarityCards((await store("read", { key: similarityKey(identity) }))?.items);
    }
    const claim = await store("claim", { key, identity, actor, daily_limit: DAILY_LIMIT_USD });
    if (claim?.token) {
      defer(prepare(identity, key, claim.token, items).catch(e => console.error("Media similarity preparation failed", e instanceof Error ? e.message : "unknown failure")));
    }
    return { items, preparing: !!(claim?.token || claim?.preparing) };
  }
  return { load };
}
