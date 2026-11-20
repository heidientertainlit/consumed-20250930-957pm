export interface MediaAddedInput {
  title?: string;
  listName?: string;
  count?: number;
}

export interface MediaAddedNotice extends MediaAddedInput {
  id: number;
  count: number;
}

let notice: MediaAddedNotice | null = null;
let sequence = 0;
const listeners = new Set<() => void>();

/** Call once after a confirmed save, never once per item inside a batch. */
export function showMediaAdded(input: MediaAddedInput) {
  const count = input.count ?? 1;
  if (!Number.isSafeInteger(count) || count <= 0) return;
  const rawList = input.listName?.trim();
  const labels: Record<string, string> = {
    currently: "Currently", queue: "Want To", want_to: "Want To",
    finished: "Finished", completed: "Finished", complete: "Finished",
    dnf: "Did Not Finish", did_not_finish: "Did Not Finish", favorites: "Favorites",
  };
  const listName = !rawList || rawList.toLowerCase() === "all" ||
    /^[\da-f]{8}-[\da-f-]{27}$/i.test(rawList)
    ? undefined : labels[rawList.toLowerCase()] || rawList;
  notice = { ...input, listName, count, id: ++sequence };
  listeners.forEach((listener) => listener());
}

export function dismissMediaAdded(id: number) {
  // An older animation/timer must never dismiss a more recent addition.
  if (notice?.id !== id) return;
  notice = null;
  listeners.forEach((listener) => listener());
}

export const getMediaAddedNotice = () => notice;
export const getServerMediaAddedNotice = () => null;
export function subscribeMediaAdded(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
