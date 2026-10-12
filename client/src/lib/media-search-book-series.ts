export type BookSeriesDiscovery = "always" | "matching-filter";

/**
 * Keep the legacy opt-in unless a caller explicitly narrows it.
 * All and Books still discover series; non-book filters cannot display them.
 */
export function shouldRequestBookSeries(
  mediaType: string | undefined,
  discovery: BookSeriesDiscovery = "always",
): boolean {
  return discovery === "always" || !mediaType || mediaType === "book";
}
