/**
 * genre-taxonomy
 *
 * Normalises raw genre/category strings coming from many different source APIs
 * (TMDB, Google Books, iTunes, Open Library, Spotify, RAWG) into one clean,
 * consistent vocabulary so genre behavioral data is comparable app-wide.
 *
 * - `canonicalGenre`  : one raw token  -> one canonical genre (or null if generic/noise)
 * - `canonicalizeMany`: array of raw strings (possibly composite like
 *                       "Fiction / Thriller" or "Sci-Fi & Fantasy") -> deduped canonical list
 *
 * Canonical values are human-readable lowercase phrases (e.g. "science fiction",
 * "true crime", "thriller") to match the existing user_dna_signals genre values.
 */

// Synonyms / spelling variants -> canonical form.
const SYNONYMS: Record<string, string> = {
  'sci-fi': 'science fiction',
  'scifi': 'science fiction',
  'sci fi': 'science fiction',
  'science-fiction': 'science fiction',
  'thrillers': 'thriller',
  'suspense': 'thriller',
  'historical': 'history',
  'historical fiction': 'history',
  'rom-com': 'romance',
  'romantic comedy': 'romance',
  'romantic': 'romance',
  'sitcom': 'comedy',
  'sitcoms': 'comedy',
  'stand-up comedy': 'comedy',
  'stand up comedy': 'comedy',
  'comedies': 'comedy',
  'docuseries': 'documentary',
  'documentaries': 'documentary',
  'docs': 'documentary',
  'reality-tv': 'reality',
  'reality television': 'reality',
  'kids': 'family',
  'children': 'family',
  "children's": 'family',
  'childrens': 'family',
  'kid': 'family',
  'biographies': 'biography',
  'autobiography': 'biography',
  'memoir': 'biography',
  'true-crime': 'true crime',
  'self help': 'self-help',
  'sci-fi & fantasy': 'science fiction',
  'mysteries': 'mystery',
  'mystery & thriller': 'mystery',
  'animated': 'animation',
  'anime': 'animation',
  'horror fiction': 'horror',
  'westerns': 'western',
  'war & politics': 'war',
};

// Too generic / structural to be a meaningful taste signal.
const GENERIC = new Set([
  'fiction', 'nonfiction', 'non-fiction', 'general', 'tv & film', 'tv', 'film',
  'films', 'movie', 'movies', 'arts', 'art', 'podcasts', 'podcast', 'music',
  'books', 'book', 'audiobooks', 'audiobook', 'society & culture', 'society',
  'culture', 'juvenile fiction', 'juvenile nonfiction', 'young adult fiction',
  'young adult nonfiction', 'young adult', 'comics & graphic novels',
  'literary collections', 'literary criticism', 'literature', 'shows', 'show',
  'tv shows', 'tv show', 'entertainment', 'other', 'misc', 'miscellaneous',
]);

// Open Library "subjects" mix real genres with cataloguing/marketing noise that
// is not a taste signal (e.g. "nyt:trade-fiction-paperback=2021-08-22",
// "new york times bestseller", "goodreads choice award"). Drop those.
const NOISE = /[:=]|new york times|bestseller|goodreads|book award|award winner|translations? into|readers for|accessible book|protected daisy|in library|overdrive/;

export function canonicalGenre(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  // strip surrounding punctuation
  s = s.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  if (!s || s.length < 2) return null;
  if (NOISE.test(s)) return null;
  if (SYNONYMS[s]) s = SYNONYMS[s];
  if (GENERIC.has(s)) return null;
  return s;
}

export function canonicalizeMany(rawList: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const raw of rawList ?? []) {
    if (!raw) continue;
    // Drop parenthetical asides first so their internal commas don't fragment,
    // e.g. "Epistolary (letters, diaries, etc.)" -> "Epistolary".
    const cleaned = String(raw).replace(/\([^)]*\)/g, ' ');
    // Split composites: "Fiction / Thriller", "Action & Adventure", "Drama|Crime",
    // and comma-separated subject lists like "fiction, science fiction, action".
    for (const part of cleaned.split(/\s*[\/|,]\s*|\s+&\s+/)) {
      const c = canonicalGenre(part);
      if (c) out.add(c);
    }
  }
  return [...out];
}
