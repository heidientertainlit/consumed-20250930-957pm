import { useQueries, useQuery } from "@tanstack/react-query";
import {
  generateSimilarMedia,
  resolveSimilarMedia,
  type RecommendationSlot,
} from "@/lib/similar-media";

type SimilarMediaInput = {
  userId?: string;
  accessToken?: string;
  source?: string;
  externalId?: string;
  title?: string;
  type?: string;
};

export function useSimilarMedia(input: SimilarMediaInput) {
  const { userId, accessToken, source, externalId, title, type } = input;
  const baseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
  const enabled = !!userId && !!accessToken && !!source && !!externalId && !!title;
  // Scope personalization by account, and distinguish remakes/identical titles
  // by provider identity. Never carry previous-title data into the new route.
  const scope = ["similar-media-v2", userId, source, externalId, title, type];
  const generation = useQuery({
    queryKey: scope,
    queryFn: ({ signal }) => generateSimilarMedia(baseUrl, title!, type || "", accessToken!, { signal }),
    enabled,
    retry: false,
    networkMode: "always",
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
  const recommendations = enabled ? generation.data || [] : [];
  const resolutions = useQueries({
    queries: recommendations.map((recommendation, index) => ({
      queryKey: [...scope, "resolve", index, recommendation],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        resolveSimilarMedia(baseUrl, recommendation, accessToken!, { signal }),
      enabled,
      retry: false,
      networkMode: "always" as const,
      staleTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
    })),
  });
  // Pending slots keep their original position. Faster matches never jump ahead
  // of earlier-ranked recommendations simply because they resolved first.
  const slots: RecommendationSlot[] = resolutions.map((resolution, index) => ({
    key: `${source}:${externalId}:${index}`,
    status: resolution.isPending ? "pending" : resolution.data ? "ready" : "unavailable",
    ...(resolution.data ? { item: resolution.data } : {}),
  }));
  return {
    slots,
    isGenerating: enabled && generation.isPending,
    hasError: generation.isError || resolutions.some(resolution => resolution.isError),
  };
}
