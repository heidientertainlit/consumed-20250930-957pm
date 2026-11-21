import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinishedReviewRequest } from "./media-added-confirmation";
import { buildQuickTrackThoughtPostPayload, type QuickTrackThoughtPostInput } from "./quick-track-post";

interface FinishedReviewSave extends QuickTrackThoughtPostInput {
  supabaseUrl: string;
  accessToken: string;
  listItemId: string;
  rating: number;
  privateMode: boolean;
  postId: string;
  canonicalMediaId?: string;
}

export function createFinishedReviewPostId(
  random: Pick<Crypto, "getRandomValues"> & Partial<Pick<Crypto, "randomUUID">> = crypto,
): string {
  if (random.randomUUID) return random.randomUUID();
  // randomUUID is missing on older supported iOS webviews.
  const bytes = random.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Check before mounting, so previously supplied reactions never flash a prompt. */
export async function hasExistingFinishedReaction(
  request: FinishedReviewRequest,
  db: Pick<SupabaseClient, "from">,
): Promise<boolean> {
  if (request.hasSavedReview) return true;
  const lookup = async (canonical: boolean) => {
    let ratings = db.from("media_ratings").select("id")
      .eq("user_id", request.userId).gt("rating", 0).limit(1);
    let posts = db.from("social_posts").select("id")
      .eq("user_id", request.userId).in("post_type", ["rate-review", "thought"]).limit(1);
    if (canonical) {
      ratings = ratings.eq("canonical_media_id", request.media.canonical_media_id!);
      posts = posts.eq("canonical_media_id", request.media.canonical_media_id!);
    } else {
      ratings = ratings.eq("media_external_id", request.media.external_id)
        .eq("media_external_source", request.media.external_source);
      posts = posts.eq("media_external_id", request.media.external_id)
        .eq("media_external_source", request.media.external_source);
    }
    const [ratingResult, postResult] = await Promise.all([ratings, posts]);
    if (ratingResult.error || postResult.error) throw new Error("Couldn't check your existing reactions.");
    return !!(ratingResult.data?.length || postResult.data?.length);
  };
  if (request.media.canonical_media_id && await lookup(true)) return true;
  return lookup(false);
}

/** React to an existing Finished item; never track it or change its list again. */
export async function saveFinishedReview(
  input: FinishedReviewSave,
  db: Pick<SupabaseClient, "from">,
  fetcher: typeof fetch = fetch,
) {
  const review = input.content.trim();
  if (!review && !input.rating) return;
  const { data: saved, error: readError } = await db.from("list_items")
    .select("id,notes").eq("id", input.listItemId).eq("user_id", input.userId).maybeSingle();
  if (readError || !saved) throw new Error("Couldn't find your saved title. Your review has not been posted.");

  // Keep review text with the existing library entry even when feed sharing is
  // off. Preserve pre-existing notes and use a compare-and-set to avoid loss.
  if (review) {
    const entry = `Review${input.containsSpoilers ? " (contains spoilers)" : ""}: ${review}`;
    const oldNotes: string | null = saved.notes;
    if (!(oldNotes || "").endsWith(entry)) {
      let update = db.from("list_items").update({
        notes: oldNotes ? `${oldNotes}\n\n${entry}` : entry,
      }).eq("id", input.listItemId).eq("user_id", input.userId);
      update = oldNotes == null ? update.is("notes", null) : update.eq("notes", oldNotes);
      const { data, error } = await update.select("id").maybeSingle();
      if (error || !data) throw new Error("Couldn't save your review. Please try again.");
    }
  }
  if (input.rating > 0) {
    const response = await fetcher(`${input.supabaseUrl}/functions/v1/rate-media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        media_external_id: input.media.external_id,
        media_external_source: input.media.external_source || "tmdb",
        canonical_media_id: input.canonicalMediaId,
        media_title: input.media.title,
        media_type: input.media.type,
        media_image_url: input.media.image || input.media.image_url || "",
        rating: input.rating,
        skip_social_post: true,
      }),
    });
    if (!response.ok || (await response.json()).success !== true) {
      throw new Error("Couldn't confirm your rating was saved. Please try again.");
    }
  }
  if (!input.privateMode) {
    const post = buildQuickTrackThoughtPostPayload(input);
    const { error } = await db.from("social_posts").upsert({
      ...post,
      id: input.postId,
      post_type: input.rating > 0 ? "rate-review" : "thought",
      rating: input.rating > 0 ? input.rating : null,
      ...(input.canonicalMediaId ? { canonical_media_id: input.canonicalMediaId } : {}),
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error("Your reaction is saved, but sharing failed. Please try again.");
  }
}
