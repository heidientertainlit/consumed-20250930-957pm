import { useQueries, useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import {
  generateSimilarMedia,
  resolveSimilarMedia,
  type RecommendationSlot,
} from "@/lib/similar-media";
import { preparedSimilarMedia } from "@/lib/prepared-similar-media";
import { loadSharedSimilarMedia } from "@/lib/shared-similar-media";
import type { SimilarityCard } from "../../../shared/media-similarity";

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
  const prepared = preparedSimilarMedia(source, externalId, type);
  const signedIn = !!userId && !!accessToken;
  const canLoad = signedIn && !!source && !!externalId && !!title && !!type;
  const visitKey = JSON.stringify([userId, source, externalId, type]);
  const visit = useRef({ key: visitKey, started: Date.now(), interacted: false, pinned: null as SimilarityCard[] | null });
  if (visit.current.key !== visitKey) visit.current = { key: visitKey, started: Date.now(), interacted: false, pinned: null };
  const shared = useQuery({
    queryKey: ["shared-similar-media-v1", userId, source, externalId, type],
    queryFn: ({ signal }) => loadSharedSimilarMedia(baseUrl, { source: source!, externalId: externalId!, type: type! }, accessToken!, signal),
    enabled: canLoad,
    retry: false,
    networkMode: "always",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchInterval: query => query.state.data?.preparing && Date.now() - visit.current.started < 90_000 ? 2000 : false,
  });
  const improved = visit.current.interacted ? visit.current.pinned : shared.data?.items;
  const hasImproved = !!improved?.length;
  // Do not pay for the old personalized generator on shared-cache hits. On a
  // cold miss/failure, retain the established path while preparation continues.
  const enabled = canLoad && !hasImproved && prepared === null && !shared.isPending;
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
  // Pin the selected result set after a person starts scrolling/tapping it.
  // Legacy pending slots may still resolve; improved results wait until next visit.
  const onInteraction = () => {
    if (visit.current.interacted || (!hasImproved && prepared === null && !slots.some(s => s.status === "ready"))) return;
    visit.current.interacted = true;
    visit.current.pinned = hasImproved ? [...improved!] : null;
  };
  if (signedIn && (hasImproved || prepared !== null)) return {
    slots: (hasImproved ? improved! : prepared!).map((item, index) => ({
      key: `shared:${type}:${source}:${externalId}:${index}`,
      status: "ready" as const,
      item,
    })),
    isGenerating: false,
    hasError: false,
    onInteraction,
  };
  return {
    slots,
    isGenerating: canLoad && ((prepared === null && shared.isPending) || (enabled && generation.isPending)),
    hasError: generation.isError || resolutions.some(resolution => resolution.isError),
    onInteraction,
  };
}
