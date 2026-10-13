import { researchTypes, type ResearchTitle, type ResearchChart, type ResearchResult } from "@shared/content-research";

export function safeResearchUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch { return undefined; }
}

export function isResearchTitle(value: unknown): value is ResearchTitle {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.title === "string" && !!v.title.trim()
    && researchTypes.includes(v.type as ResearchTitle["type"])
    && typeof v.external_source === "string" && !!v.external_source
    && typeof v.external_id === "string" && !!v.external_id
    && typeof v.source_url === "string" && !!safeResearchUrl(v.source_url)
    && ["creator", "year", "media_subtype", "image"].every(k => v[k] === undefined || typeof v[k] === "string");
}

export function isResearchChart(value: unknown): value is ResearchChart {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return ["source_label", "source_key", "chart_country", "chart_date"].every(k => typeof v[k] === "string")
    && ["current", "stale", "unavailable"].includes(String(v.status));
}

export function isResearchResult(value: unknown): value is ResearchResult {
  if (!value || typeof value !== "object") return false;
  const v = value as ResearchResult;
  return isResearchTitle(v.seed) && (v.chart === undefined || isResearchChart(v.chart))
    && Array.isArray(v.feedback) && v.feedback.every(f => typeof f === "string")
    && Array.isArray(v.picks) && v.picks.every(p => isResearchTitle(p)
      && p.catalog_verified === true && p.relationship === "editorial similarity" && typeof p.rationale === "string");
}

/** Abort transport and invalidate responses even if a transport ignores abort. */
export function createResearchRequestGate() {
  let generation = 0;
  let controller: AbortController | undefined;
  return {
    cancel() { generation++; controller?.abort(); controller = undefined; },
    begin() {
      controller?.abort();
      controller = new AbortController();
      const own = ++generation;
      const signal = controller.signal;
      return { signal, current: () => own === generation && !signal.aborted };
    },
  };
}
