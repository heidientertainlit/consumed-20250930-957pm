import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MoreLikeThis from "@/components/more-like-this";
import { useSimilarMedia } from "@/hooks/use-similar-media";
import { supabase } from "@/lib/supabase";
import { recommendationRequest, recommendationType, type ResolvedRecommendation } from "@/lib/similar-media";

type Props = {
  userId?: string; accessToken?: string; source?: string; externalId?: string; title?: string; type?: string;
};
type Preview = { available: boolean; items: ResolvedRecommendation[] };

// Remounted by account + source identity in media-detail; selection never leaks
// between accounts/titles. Normal users always retain the existing hook/cards.
export default function MediaDetailSimilarMedia(props: Props) {
  const [mode, setMode] = useState<"current" | "experimental">("current");
  const admin = useQuery({
    queryKey: ["media-recommendation-preview-access", props.userId],
    enabled: !!props.userId && !!props.accessToken, retry: false, staleTime: 0,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from("admin_user_profiles").select("is_admin")
        .eq("id", props.userId!).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data?.is_admin === true;
    },
  });
  const experimental = admin.data === true && mode === "experimental";
  const current = useSimilarMedia({ ...props, enabled: !experimental });
  const preview = useQuery<Preview>({
    queryKey: ["media-recommendation-preview", props.userId, props.source, props.externalId, props.type, "semantic"],
    enabled: experimental && !!props.source && !!props.externalId && !!props.accessToken,
    retry: false, staleTime: 30 * 60 * 1000, refetchOnWindowFocus: false,
    queryFn: ({ signal }) => recommendationRequest(
      `${import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co"}/functions/v1/media-recommendation-preview`,
      { source: props.source, externalId: props.externalId, type: recommendationType(props.type) || props.type },
      props.accessToken!, { signal },
    ),
  });
  const state = experimental ? {
    slots: (preview.isError ? [] : preview.data?.items || []).map((item, index) => ({
      key: `experimental:${props.source}:${props.externalId}:${index}`, status: "ready" as const, item,
    })),
    isGenerating: preview.isPending, hasError: preview.isError,
  } : current;
  return <>
    {admin.data === true && <div className="mb-2 text-xs text-gray-500" data-testid="media-recommendation-preview-controls">
      <label className="flex items-center gap-2">
        <span>Admin preview</span>
        <select aria-label="More like this recommendation mode" value={experimental ? "experimental" : "current"}
          onChange={e => setMode(e.target.value as "current" | "experimental")}
          className="rounded border border-gray-200 bg-white px-2 py-1 text-gray-700">
          <option value="current">CURRENT</option>
          <option value="experimental">Experimental</option>
        </select>
      </label>
      {experimental && <p className="mt-1" role="status">
        {preview.isError ? "Experimental preview could not be loaded. Choose CURRENT to use existing recommendations."
          : preview.data?.available === false ? "No saved experimental recommendations for this exact title. Choose CURRENT to use existing recommendations."
          : "Experimental · saved semantic rankings from the fixed 48-work pool. No new model calls."}
      </p>}
    </div>}
    <MoreLikeThis {...state} />
  </>;
}
