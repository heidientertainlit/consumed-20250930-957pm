export type SearchItem = { id: string; title: string; type: string; creator?: string; externalId?: string; externalSource?: string };
export type SubjectScope = { number: number; name?: string; overview?: string };

export function normalizeConversationSubject(raw: unknown, fallbackId?: string): SearchItem | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const candidate = (value.item && typeof value.item === "object" ? value.item : value) as Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id : fallbackId;
  if (!id || typeof candidate.title !== "string") return undefined;
  const externalId = candidate.externalId ?? candidate.external_id;
  const externalSource = candidate.externalSource ?? candidate.external_source;
  return {
    id, title: candidate.title, type: typeof candidate.type === "string" ? candidate.type : "title",
    creator: typeof candidate.creator === "string" ? candidate.creator : undefined,
    externalId: typeof externalId === "string" || typeof externalId === "number" ? String(externalId) : undefined,
    externalSource: typeof externalSource === "string" ? externalSource : undefined,
  };
}

export function subjectSelectionMedia(result: Record<string, unknown>) {
  return {
    title: result.title, type: result.type,
    external_id: result.external_id ?? result.externalId,
    external_source: result.external_source ?? result.externalSource,
  };
}

/** Invalidating synchronously prevents old selections and fetches from restoring stale scope. */
export function createRequestGuard() {
  let revision = 0;
  return { next: () => ++revision, current: (request: number) => request === revision };
}

export function scopeOptions(items: unknown, kind: "season" | "episode"): SubjectScope[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const number = item.number ?? item[`${kind}Number`] ?? item[`${kind}_number`];
    return Number.isInteger(number) && number >= 0
      ? [{ number, name: typeof item.name === "string" ? item.name : undefined, overview: typeof item.overview === "string" ? item.overview : undefined }]
      : [];
  });
}

export function participantSelectionReasons(provenance: unknown): Array<{ participant_id: string; reason: string }> {
  const entries = Array.isArray(provenance) ? provenance
    : provenance && typeof provenance === "object" && Array.isArray((provenance as Record<string, unknown>).entries)
      ? (provenance as { entries: unknown[] }).entries : [];
  return entries.flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    return item.kind === "persona-selection" && typeof item.participant_id === "string" && typeof item.reason === "string"
      ? [{ participant_id: item.participant_id, reason: item.reason }] : [];
  });
}
