/** Visually verified publisher artwork; this changes imagery, never media identity. */
const publisherCovers = [{
  isbn: "9781682818084",
  title: "threshing day",
  author: "rebecca yarros",
  imageUrl: "https://api.entangledpublishing.com/storage/books/book_17841297109395.jpg",
}];

const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

export function preferredBookCover(item: {
  media_type?: string; external_id?: string | number; title?: string; creator?: string;
}): string | undefined {
  if (item.media_type !== "book" || !item.title || !item.creator) return;
  const title = normalize(item.title.replace(/\s*\([^)]*\)\s*$/, ""));
  return publisherCovers.find(cover =>
    cover.isbn === String(item.external_id) && cover.title === title && cover.author === normalize(item.creator!),
  )?.imageUrl;
}
