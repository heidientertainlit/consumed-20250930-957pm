import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PlayCard from "@/components/play-card";
import { PollsCarousel } from "@/components/polls-carousel";

interface MediaPlayTabProps {
  externalId?: string;
  externalSource?: string;
  mediaTitle?: string;
}

export default function MediaPlayTab({ externalId, externalSource, mediaTitle }: MediaPlayTabProps) {
  // Make sure this title has its baseline polls (stamped server-side from templates),
  // then load any trivia tagged to it. Polls render through the same PollsCarousel as the feed.
  const { data, isLoading } = useQuery({
    queryKey: ["media-play-tab", externalSource, externalId, mediaTitle],
    queryFn: async () => {
      const now = new Date().toISOString();
      const seen = new Set<string>();
      const trivia: any[] = [];

      if (externalId && externalSource) {
        const { data: byId } = await supabase
          .from("prediction_pools")
          .select("*")
          .eq("type", "trivia")
          .eq("status", "open")
          .eq("media_external_id", externalId)
          .eq("media_external_source", externalSource)
          .or(`publish_at.is.null,publish_at.lte.${now}`)
          .order("created_at", { ascending: false })
          .limit(50);
        for (const p of byId || []) {
          if (!seen.has(p.id)) { seen.add(p.id); trivia.push(p); }
        }
      }
      if (mediaTitle && mediaTitle.trim()) {
        const { data: byTitle } = await supabase
          .from("prediction_pools")
          .select("*")
          .eq("type", "trivia")
          .eq("status", "open")
          .ilike("media_title", mediaTitle.trim().replace(/[%_]/g, "\\$&"))
          .or(`publish_at.is.null,publish_at.lte.${now}`)
          .order("created_at", { ascending: false })
          .limit(50);
        for (const p of byTitle || []) {
          if (!seen.has(p.id)) { seen.add(p.id); trivia.push(p); }
        }
      }
      return { trivia, ensured: true };
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

  const trivia = data?.trivia || [];

  return (
    <div className="space-y-4 pb-4">
      {/* Polls — identical look & behavior to the feed polls carousel */}
      <PollsCarousel mediaFilter={{ externalId, externalSource, mediaTitle }} />

      {/* Trivia tagged to this title */}
      {trivia.length > 0 && (
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {trivia.map((pool: any) => (
            <div key={pool.id} className="snap-center flex-shrink-0 w-[88%] max-w-md">
              <PlayCard game={pool} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
