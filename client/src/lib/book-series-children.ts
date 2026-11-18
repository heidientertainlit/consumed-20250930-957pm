/** The same on-demand Open Library lookup used by the app-bar series dropdown. */
export async function fetchBookSeriesChildren(
  seriesTitle: string,
  author?: string,
  options: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
) {
  const params = new URLSearchParams({
    q: seriesTitle,
    limit: "12",
    fields: "title,author_name,first_publish_year,cover_i,key,subject",
  });
  if (author && author !== "Unknown Author") params.set("author", author);
  const response = await (options.fetcher || fetch)(
    `https://openlibrary.org/search.json?${params.toString()}`,
    { signal: options.signal },
  );
  if (!response.ok) throw new Error("Couldn't load books in this series. Please try again.");
  const data = await response.json();
  const seen = new Set<string>();
  return (data.docs || [])
    .filter((doc: any) => doc.key && doc.title)
    .filter((doc: any) => {
      if (seen.has(doc.key)) return false;
      seen.add(doc.key);
      return true;
    })
    .slice(0, 8)
    .map((doc: any) => ({
      title: doc.title,
      type: "book",
      creator: doc.author_name?.[0] || author || "",
      poster_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : "",
      external_id: doc.key.replace("/works/", ""),
      external_source: "openlibrary",
      year: doc.first_publish_year ? String(doc.first_publish_year) : "",
    }));
}
