import { similarityKey, similarityCards, type SimilarityIdentity, type SimilarityResponse } from "../../../shared/media-similarity.ts";
import type { LabWork } from "../../../shared/recommendation-lab.ts";
import { createLabModels, type LabStore } from "./recommendation-lab-models.ts";
import { rankLab, sameWork } from "./recommendation-lab-ranking.ts";
import { createSimilarityProviders } from "./media-similarity-providers.ts";

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
  async function prepare(identity: SimilarityIdentity, key: string, token: string) {
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
    let items: ReturnType<typeof similarityCards> = [], error: string | null = null;
    try {
      async function profile(id: SimilarityIdentity) {
        const cacheKey = similarityKey(id);
        const saved = await store("profile", { key: cacheKey });
        if (saved) return saved as LabWork;
        let work = await providers.details(id.source, id.externalId, id.type);
        work = await models.profile(work);
        await store("save_profile", { key: cacheKey, identity: id, work });
        return work as LabWork;
      }
      const source = await profile(identity);
      const [pool, recalled] = await Promise.all([store("pool"), providers.recall(source)]);
      const candidates: LabWork[] = [...(pool || [])];
      // Four workers, a bounded pool, and independently verified candidates.
      let next = 0;
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (next < recalled.length && Date.now() < deadline) {
          const id = recalled[next++];
          try { candidates.push(await profile(id)); }
          catch { /* Missing evidence stays missing; other verified candidates remain usable. */ }
        }
      }));
      const results = rankLab(source, candidates.filter(w => !sameWork(source, w)), true);
      items = similarityCards(results.map(({ item }) => ({ title: item.title, type: item.media_type,
        external_source: item.external_source, external_id: item.external_id, poster_url: item.source_metadata.poster_url || "" })));
      if (!items.length) error = "No source-supported recommendations available";
    } catch (e) {
      error = (e as Error).message;
    } finally {
      // Only the current lease owner may publish and settle the global budget.
      await store("finish", { key, token, items, cost: meter.cost(), error: error?.slice(0, 500) || null });
    }
  }
  async function load(identity: SimilarityIdentity, actor: string): Promise<SimilarityResponse> {
    const key = similarityKey(identity);
    const cached = await store("read", { key });
    const items = similarityCards(cached?.items);
    if (cached?.fresh) return { items, preparing: false };
    const claim = await store("claim", { key, identity, actor, daily_limit: DAILY_LIMIT_USD });
    if (claim?.token) {
      defer(prepare(identity, key, claim.token).catch(e => console.error("Media similarity preparation failed", e instanceof Error ? e.message : "unknown failure")));
    }
    return { items, preparing: !!(claim?.token || claim?.preparing) };
  }
  return { load };
}
