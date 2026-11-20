export interface NowAddEntry {
  returnTo: "/" | "/activity";
  scrollY: number;
  entryId: string;
}

export function createNowAddState(path: string, scrollY: number, entryId: string) {
  if (path !== "/" && path !== "/activity") return undefined;
  return {
    nowAddEntry: {
      returnTo: path,
      scrollY: Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0,
      entryId,
    },
  };
}

/** Return intent belongs to this history entry, never a sticky session flag. */
export function getNowAddEntry(path: string, state: unknown): NowAddEntry | null {
  if (path !== "/add" || !state || typeof state !== "object") return null;
  const entry = (state as { nowAddEntry?: unknown }).nowAddEntry;
  if (!entry || typeof entry !== "object") return null;
  const value = entry as Partial<NowAddEntry>;
  if (
    (value.returnTo !== "/" && value.returnTo !== "/activity") ||
    typeof value.entryId !== "string" || !value.entryId ||
    typeof value.scrollY !== "number" || !Number.isFinite(value.scrollY) ||
    value.scrollY < 0
  ) return null;
  return value as NowAddEntry;
}
