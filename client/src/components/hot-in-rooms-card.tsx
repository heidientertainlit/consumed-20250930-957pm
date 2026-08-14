import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { ThumbsUp, MessageCircle, Flame, ChevronRight } from "lucide-react";

/**
 * "Hot in Rooms" feed teaser — surfaces the hottest recent room take as an
 * invitation into that room's conversation. Sprinkled sparingly through the
 * feed (slot 0/1/2 each show a different room's hottest take).
 */
export function HotInRoomsCard({ slot = 0 }: { slot?: number }) {
  const { session } = useAuth();
  const [, setLocation] = useLocation();

  const { data: hotTakes } = useQuery({
    queryKey: ["hot-in-rooms", session?.user?.id],
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("room_takes")
        .select("id, room_id, title, body, tag, upvotes, reply_count, created_at, users:user_id(display_name, user_name), pools:room_id(id, name, is_public)")
        .gte("created_at", since)
        .order("upvotes", { ascending: false })
        .order("reply_count", { ascending: false })
        .limit(30);
      if (error) throw error;
      // Hottest take per room (public rooms only), ranked by heat
      const byRoom = new Map<string, any>();
      for (const t of data || []) {
        const pool: any = Array.isArray(t.pools) ? t.pools[0] : t.pools;
        if (!pool || pool.is_public === false) continue;
        const heat = (t.upvotes || 0) * 2 + (t.reply_count || 0) * 3;
        if (heat < 1) continue; // needs at least some activity
        const prev = byRoom.get(t.room_id);
        if (!prev || heat > prev.heat) byRoom.set(t.room_id, { ...t, pool, heat });
      }
      return Array.from(byRoom.values()).sort((a, b) => b.heat - a.heat);
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const take = hotTakes?.[slot];
  if (!take) return null;

  const author: any = Array.isArray(take.users) ? take.users[0] : take.users;
  const authorName = author?.display_name || author?.user_name || "Someone";
  const firstName = String(authorName).split(" ")[0];
  const lastInitial = String(authorName).split(" ")[1]?.[0];
  const shortName = lastInitial ? `${firstName} ${lastInitial}.` : firstName;
  const quote = take.body?.trim() || take.title;
  const talking = (take.reply_count || 0) + 1;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
      onClick={() => setLocation(`/room/${take.pool.id}`)}
      data-testid={`card-hot-in-rooms-${slot}`}
    >
      {/* Header strip */}
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-orange-600 bg-orange-50 rounded-full px-2.5 py-1">
          <Flame className="w-3.5 h-3.5" />
          Heating up in {take.pool.name}
        </span>
      </div>

      {/* Featured take */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-[15px] leading-snug text-gray-900">
          {take.title && take.body ? <span className="font-semibold">{take.title} — </span> : null}
          {quote.length > 160 ? `${quote.slice(0, 160)}…` : quote}
        </p>
        <p className="text-[12px] text-gray-400 mt-1.5">— {shortName}</p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 mt-1 border-t border-gray-50">
        <div className="flex items-center gap-3 text-[12px] text-gray-500">
          <span className="inline-flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" />{take.upvotes || 0}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{take.reply_count || 0}</span>
          <span>{talking === 1 ? "1 person talking" : `${talking} people talking`}</span>
        </div>
        <span className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-purple-600">
          Join the conversation <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </div>
  );
}
