import { similarityCards, similarityIdentity, type SimilarityResponse } from "../../../shared/media-similarity";
import { recommendationRequest } from "./similar-media";

export async function loadSharedSimilarMedia(
  baseUrl: string, identity: { source: string; externalId: string; type: string },
  accessToken: string, signal?: AbortSignal,
): Promise<SimilarityResponse> {
  const result = await recommendationRequest(`${baseUrl}/functions/v1/media-similarity`,
    similarityIdentity(identity), accessToken, { signal, timeoutMs: 4000 });
  if (!result || !Array.isArray(result.items) || typeof result.preparing !== "boolean")
    throw new Error("Invalid shared recommendation response");
  return { items: similarityCards(result.items), preparing: result.preparing };
}
