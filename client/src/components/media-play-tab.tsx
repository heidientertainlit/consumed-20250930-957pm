import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PlayCard from "@/components/play-card";

interface MediaPlayTabProps {
  externalId?: string;
  externalSource?: string;
  mediaTitle?: string;
}

export default function MediaPlayTab({ externalId, externalSource, mediaTitle }: MediaPlayTabProps) {
  const { data: pools, isLoading } = useQuery({
    queryKey: ["media-play-tab", externalSource, externalId, mediaTitle],
    queryFn: async () => {
      const now = new Date().toISOString();
      const seen = new Set<string>();
      const merged: any[] = [];

      // 1. Pools explicitly linked to this title by external id
      if (externalId && externalSource) {
        const { data } = await supabase
          .from("prediction_pools")
          .select("*")
          .eq("status", "open")
          .eq("media_external_id", externalId)
          .eq("media_external_source", externalSource)
          .or(`publish_at.is.null,publish_at.lte.${now}`)
          .order("created_at", { ascending: false })
          .limit(50);
        for (const p of data || []) {
          if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
        }
      }

      // 2. Pools tagged with this media title (older content without external ids)
      if (mediaTitle && mediaTitle.trim()) {
        const { data } = await supabase
          .from("prediction_pools")
          .select("*")
          .eq("status", "open")
          .ilike("media_title", mediaTitle.trim())
          .or(`publish_at.is.null,publish_at.lte.${now}`)
          .order("created_at", { ascending: false })
          .limit(50);
        for (const p of data || []) {
          if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
        }
      }

      // Polls first (always answerable), then trivia, newest first within each
      merged.sort((a, b) => {
        if (a.type !== b.type) return a.type === "vote" ? -1 : 1;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
      return merged;
    },
    enabled: !!(externalId && externalSource) || !!mediaTitle,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!pools || pools.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-500">No games for this one yet — check back soon.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {pools.map((pool: any) => (
        <PlayCard key={pool.id} game={pool} />
      ))}
    </div>
  );
}
