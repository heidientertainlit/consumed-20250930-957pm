const MEDIA_TYPE_LABELS: Record<string, string> = {
  book: "Book",
  book_series: "Book Series",
  movie: "Movie",
  tv: "TV Show",
  music: "Music",
  podcast: "Podcast",
  youtube: "YouTube",
  game: "Game",
};

export function mediaTypeLabel(type: string | null | undefined): string {
  const normalized = type?.trim().toLowerCase();
  if (!normalized) return "Media";
  return MEDIA_TYPE_LABELS[normalized] ??
    normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
