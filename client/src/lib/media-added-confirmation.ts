export interface FinishedReviewRequest {
  userId: string;
  listItemId: string;
  hasSavedReview?: boolean;
  media: {
    title: string;
    type: string;
    image?: string;
    year?: number;
    external_id: string;
    external_source: string;
    creator?: string;
    canonical_media_id?: string;
  };
}

export interface MediaAddedInput {
  title?: string;
  listName?: string;
  count?: number;
  /** Only the already-saved poster + → Finished path opts into a review. */
  finishedReview?: FinishedReviewRequest;
}

export interface MediaAddedNotice extends MediaAddedInput {
  id: number;
  count: number;
}

let notice: MediaAddedNotice | null = null;
let sequence = 0;
let finishedReview: (FinishedReviewRequest & { id: number }) | null = null;
let reviewReturn: { id: number; complete: () => void } | null = null;
const listeners = new Set<() => void>();

/** Keep the source page in place while the combined confirmation/review is open. */
export function deferReturnUntilFinishedReview(complete: () => void) {
  const request = finishedReview;
  if (!request) return false;
  reviewReturn = { id: request.id, complete };
  return true;
}

/** Call once after a confirmed save, never once per item inside a batch. */
export function showMediaAdded(input: MediaAddedInput) {
  const count = input.count ?? 1;
  if (!Number.isSafeInteger(count) || count <= 0) return;
  // A newer save supersedes an older review without triggering stale navigation.
  reviewReturn = null;
  finishedReview = null;
  const rawList = input.listName?.trim();
  const labels: Record<string, string> = {
    currently: "Currently", queue: "Want To", want_to: "Want To",
    finished: "Finished", completed: "Finished", complete: "Finished",
    dnf: "Did Not Finish", did_not_finish: "Did Not Finish", favorites: "Favorites",
  };
  const listName = !rawList || rawList.toLowerCase() === "all" ||
    /^[\da-f]{8}-[\da-f-]{27}$/i.test(rawList)
    ? undefined : labels[rawList.toLowerCase()] || rawList;
  const id = ++sequence;
  if (count === 1 && listName === "Finished" && input.finishedReview && !input.finishedReview.hasSavedReview) {
    // The form owns the confirmation now: no separate stamp/backdrop or timer.
    notice = null;
    finishedReview = { ...input.finishedReview, id };
  } else {
    notice = { ...input, listName, count, id };
  }
  listeners.forEach((listener) => listener());
}

export function dismissMediaAdded(id: number) {
  // An older animation/timer must never dismiss a more recent addition.
  if (notice?.id !== id) return;
  notice = null;
  listeners.forEach((listener) => listener());
}

export const getFinishedReview = () => finishedReview;
export function dismissFinishedReview(id: number) {
  if (finishedReview?.id !== id) return;
  finishedReview = null;
  const complete = reviewReturn?.id === id ? reviewReturn.complete : undefined;
  if (reviewReturn?.id === id) reviewReturn = null;
  listeners.forEach((listener) => listener());
  complete?.();
}

export const getMediaAddedNotice = () => notice;
export const getServerMediaAddedNotice = () => null;
export function subscribeMediaAdded(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
