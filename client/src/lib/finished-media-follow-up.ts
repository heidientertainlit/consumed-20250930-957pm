export interface FinishedReactionMedia {
  title: string;
  mediaType: string;
  imageUrl?: string;
  externalId?: string;
  externalSource?: string;
  creator?: string;
}

export function isFinishedList(listName: string): boolean {
  return listName.trim().toLowerCase() === "finished";
}

/**
 * The list addition has already succeeded. This request only saves the
 * optional reaction/rating and, when supplied, the selected TV completion scope.
 * It must never re-track, move or delete the item.
 * Omitting a rating is different from rating=0 (which deletes a rating).
 */
export async function saveFinishedReaction({
  media, rating, reaction, scope, accessToken, supabaseUrl, fetchImpl = fetch,
}: {
  media: FinishedReactionMedia;
  rating: number;
  reaction: string;
  scope?: { listItemId: string; seasonNumber: number; episodeNumber: number | null; episodeTitle?: string };
  accessToken: string;
  supabaseUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const text = reaction.trim();
  if (!accessToken) throw new Error("Please sign in again to save your reaction.");
  if (!text && rating === 0 && !scope) return;
  if (text.length > 5000) throw new Error("Please keep your reaction under 5,000 characters.");
  if (!Number.isFinite(rating) || rating < 0 || rating > 5 || rating * 2 !== Math.floor(rating * 2)) {
    throw new Error("Please choose a rating between 0.5 and 5 stars.");
  }
  if (rating > 0 && (!media.externalId || !media.externalSource)) {
    throw new Error("This title is missing its rating details. You can still post a reaction without stars.");
  }
  if (scope && (!scope.listItemId || !Number.isInteger(scope.seasonNumber) || scope.seasonNumber < 0 ||
    (scope.episodeNumber !== null && (!Number.isInteger(scope.episodeNumber) || scope.episodeNumber < 1)))) {
    throw new Error("Please choose a valid season and episode for this saved title.");
  }
  // Scoped stars are not a replacement for the whole show's rating.
  if (scope) {
    const response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/save_finished_tv_scope`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json",
        apikey: import.meta.env?.VITE_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify({
        p_list_item_id: scope.listItemId, p_season: scope.seasonNumber, p_episode: scope.episodeNumber,
        p_episode_title: scope.episodeTitle || null, p_rating: rating || null, p_reaction: text || null,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (body.code === "PGRST202" || body.code === "42883") {
        throw new Error("Season-specific saving isn't enabled on the server yet. Your selection and reaction have not been saved.");
      }
      throw new Error(body.message || body.error || "Couldn't save this season or episode. Please try again.");
    }
    return;
  }
  const payload = {
    media_title: media.title,
    media_type: media.mediaType,
    media_creator: media.creator || "",
    media_image_url: media.imageUrl || "",
    ...(media.externalId ? { media_external_id: media.externalId } : {}),
    ...(media.externalSource ? { media_external_source: media.externalSource } : {}),
    ...(rating > 0
      ? { rating, ...(text ? { review_content: text } : {}) }
      : { content: text, type: "thought" }),
  };
  const response = await fetchImpl(`${supabaseUrl}/functions/v1/${rating > 0 ? "rate-media" : "share-update"}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Your title is still in Finished, but your reaction couldn't be saved. Please try again.");
  }
}
