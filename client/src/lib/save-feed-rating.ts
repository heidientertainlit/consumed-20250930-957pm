export interface FeedRatingRequest {
  supabaseUrl: string;
  accessToken?: string;
  externalId: string;
  externalSource: string;
  canonicalMediaId?: string;
  mediaTitle: string;
  mediaType: string;
  mediaImage: string;
  rating: number;
  signal?: AbortSignal;
}

export async function saveFeedRating(request: FeedRatingRequest) {
  const { supabaseUrl, accessToken, mediaTitle, mediaType, mediaImage, rating, signal } = request;
  if (!accessToken) throw new Error("Please sign in to save your rating.");
  let { externalId, externalSource, canonicalMediaId } = request;
  const headers = { Authorization: `Bearer ${accessToken}` };

  if (!externalId && mediaTitle) {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/media-search?q=${encodeURIComponent(mediaTitle)}&type=${mediaType.toLowerCase()}&limit=1`,
      { headers, signal },
    );
    if (!response.ok) throw new Error("Couldn't find this title to save your rating. Please try again.");
    const data = await response.json();
    const results = data?.results || data;
    const first = Array.isArray(results) ? results[0] : null;
    externalId = String(first?.externalId || first?.external_id || first?.id || "");
    externalSource = first?.externalSource || first?.external_source || "tmdb";
    canonicalMediaId ||= first?.canonical_media_id || first?.canonicalMediaId;
  }
  if (!externalId) throw new Error("Couldn't identify this title. Please try again.");

  const response = await fetch(`${supabaseUrl}/functions/v1/rate-media`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      media_external_id: externalId,
      media_external_source: externalSource,
      canonical_media_id: canonicalMediaId,
      media_title: mediaTitle,
      media_type: mediaType,
      media_image_url: mediaImage,
      rating,
      skip_social_post: false,
    }),
  });
  if (response.status === 401) throw new Error("Please sign in again to save your rating.");
  if (!response.ok) throw new Error("Couldn't confirm your rating was saved. Please try again.");
  const result = await response.json();
  if (result?.success !== true) throw new Error("Couldn't confirm your rating was saved. Please try again.");
  return { externalId, externalSource, canonicalMediaId };
}