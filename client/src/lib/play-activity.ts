export interface PlayActivityItem {
  id: string;
  icon?: string;
  text?: string;
  title?: string;
  link?: string | null;
  conflictData?: Record<string, unknown>;
}

const CONSUMPTION_CATEGORIES = new Set([
  "total_consumption", "books", "movies", "tv", "music", "podcasts", "games", "youtube",
]);

/** Route by the activity's destination, not guesses about words in its copy. */
export function isGameplayActivity(item: PlayActivityItem): boolean {
  if (item.conflictData || item.id.startsWith("rating-clash-")) return false;
  if (!item.link) return false;
  let destination: URL;
  try {
    destination = new URL(item.link, "https://activity.invalid");
  } catch {
    return false;
  }
  const path = destination.pathname.replace(/\/+$/, "");
  if (path === "/leaderboard") {
    if (destination.searchParams.get("tab") === "consumption") return false;
    if (CONSUMPTION_CATEGORIES.has(destination.searchParams.get("category") || "")) return false;
    return true;
  }
  return path === "/play" || path.startsWith("/play/");
}
