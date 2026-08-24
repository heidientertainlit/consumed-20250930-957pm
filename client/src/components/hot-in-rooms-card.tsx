import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MouseEvent } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";
import { ChevronRight, Flame, MessageCircle, Star, StarHalf, ThumbsDown, ThumbsUp, Film } from "lucide-react";

type RoomTake = {
  id: string;
  room_id: string;
  title: string | null;
  body: string | null;
  upvotes: number | null;
  reply_count: number | null;
  rating: number | null;
  media_title: string | null;
  media_type: string | null;
  media_creator: string | null;
  media_image_url: string | null;
  users: { display_name?: string | null; user_name?: string | null } | null;
  pool: { id: string; name: string } | null;
};

const mediaLabel = (type?: string | null) => {
  const labels: Record<string, string> = { movie: "Film", tv: "TV", book: "Book", podcast: "Podcast", music: "Music", game: "Game" };
  return type ? labels[type.toLowerCase()] || type : "";
};

/** A media-led conversation moment, limited to rooms the viewer follows. */
export function HotInRoomsCard({ slot = 0 }: { slot?: number }) {
  const { session } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  const { data: hotTakes } = useQuery({
    queryKey: ["hot-in-rooms", userId],
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data: follows, error: followsError } = await supabase
        .from("room_follows")
        .select("room_id")
        .eq("user_id", userId!);
      if (followsError) throw followsError;

      const roomIds = Array.from(new Set((follows || []).map((follow) => follow.room_id)));
      if (roomIds.length === 0) return [];

      const { data, error } = await supabase
        .from("room_takes")
        .select("id, room_id, title, body, upvotes, reply_count, created_at, rating, media_title, media_type, media_creator, media_image_url, users:user_id(display_name, user_name), pool:pools!room_id!inner(id, name)")
        .in("room_id", roomIds)
        .gte("created_at", since)
        .order("upvotes", { ascending: false })
        .order("reply_count", { ascending: false })
        .limit(100);
      if (error) throw error;

      const byRoom = new Map<string, RoomTake & { heat: number }>();
      for (const item of data || []) {
        const raw = item as any;
        const pool = Array.isArray(raw.pool) ? raw.pool[0] : raw.pool;
        if (!pool) continue;
        const heat = (raw.upvotes || 0) * 2 + (raw.reply_count || 0) * 3;
        if (heat < 1) continue;
        const take = { ...raw, pool, heat } as RoomTake & { heat: number };
        const previous = byRoom.get(take.room_id);
        if (!previous || take.heat > previous.heat) byRoom.set(take.room_id, take);
      }
      return Array.from(byRoom.values()).sort((a, b) => b.heat - a.heat);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const take = hotTakes?.[slot];
  const { data: myVote } = useQuery({
    queryKey: ["hot-in-rooms-vote", userId, take?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_take_votes")
        .select("id, vote")
        .eq("take_id", take!.id)
        .eq("user_id", userId!)
        .is("reply_id", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!take?.id,
  });

  if (!take || !take.pool) return null;

  const author = Array.isArray(take.users) ? take.users[0] : take.users;
  const authorName = author?.display_name || author?.user_name || "Someone";
  const quote = (take.body?.trim() || take.title?.trim() || "").slice(0, 175);
  const hasMedia = !!take.media_title;
  const vote = myVote?.vote || 0;
  const navigateToThread = () => setLocation(`/room/${take.room_id}?take=${take.id}`);

  const react = async (direction: 1 | -1, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!userId) return;
    const priorVote = vote;
    const nextVote = priorVote === direction ? 0 : direction;
    const delta = nextVote - priorVote;
    await Promise.all([
      priorVote === 0
        ? supabase.from("room_take_votes").insert({ take_id: take.id, user_id: userId, vote: direction })
        : nextVote === 0
          ? supabase.from("room_take_votes").delete().eq("id", myVote!.id)
          : supabase.from("room_take_votes").update({ vote: direction }).eq("id", myVote!.id),
      delta
        ? supabase.from("room_takes").update({ upvotes: (take.upvotes || 0) + delta }).eq("id", take.id)
        : Promise.resolve({ error: null }),
    ]);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["hot-in-rooms", userId] }),
      queryClient.invalidateQueries({ queryKey: ["hot-in-rooms-vote", userId, take.id] }),
    ]);
  };

  return (
    <article
      className={`group overflow-hidden rounded-[22px] border border-violet-100 bg-[#fdfbff] shadow-[0_12px_30px_rgba(69,38,116,0.09)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.99] ${hasMedia ? "" : "border-l-4 border-l-violet-500"}`}
      data-testid={`card-hot-in-rooms-${slot}`}
    >
      <button onClick={navigateToThread} className="block w-full text-left">
        <div className="flex items-center gap-2 px-4 pt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100/80 px-2.5 py-1 text-[11px] font-bold tracking-[0.01em] text-violet-700">
            <Flame className="h-3.5 w-3.5" fill="currentColor" /> From a room you follow
          </span>
          <span className="max-w-[42%] truncate text-[12px] font-bold text-slate-500">{take.pool.name}</span>
        </div>

        <div className={`px-4 pb-4 pt-4 ${hasMedia ? "flex gap-4" : ""}`}>
          {hasMedia && (
            <div className="relative h-[142px] w-[96px] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#281b48] via-[#433070] to-[#8a67b8] shadow-[0_10px_19px_rgba(37,20,69,0.24)]">
              {take.media_image_url ? (
                <img src={take.media_image_url} alt={`${take.media_title} poster`} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />
              ) : (
                <div className="flex h-full flex-col justify-between p-2.5 text-violet-100">
                  <Film className="h-4 w-4 opacity-70" />
                  <span className="text-[13px] font-black leading-[1.05]">{take.media_title}</span>
                </div>
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {hasMedia && (
              <>
                <div className="flex items-baseline gap-2">
                  <h3 className="truncate text-[20px] font-extrabold tracking-[-0.04em] text-[#21162f]">{take.media_title}</h3>
                  {take.media_type && <span className="shrink-0 text-[12px] font-medium text-slate-400">{mediaLabel(take.media_type)}</span>}
                </div>
                {take.media_creator && <p className="mt-0.5 truncate text-[12px] text-slate-500">{take.media_creator}</p>}
                {Number(take.rating) > 0 && (
                  <div className="mt-2 flex items-center gap-0.5 text-violet-800" aria-label={`Rated ${take.rating} out of 5`}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const rating = Number(take.rating);
                      if (rating >= star) return <Star key={star} className="h-4 w-4" fill="currentColor" />;
                      if (rating >= star - 0.5) return <StarHalf key={star} className="h-4 w-4" fill="currentColor" />;
                      return <Star key={star} className="h-4 w-4" />;
                    })}
                  </div>
                )}
              </>
            )}
            <p className={`${hasMedia ? "mt-4 font-serif text-[19px]" : "text-[16px]"} leading-snug text-[#30233e] ${hasMedia ? "" : "font-semibold"}`}>
              {hasMedia ? `“${quote}${quote.length >= 175 ? "…" : ""}”` : quote}
            </p>
            <p className="mt-2 text-[12px] font-medium text-slate-400">— {authorName}</p>
          </div>
        </div>
      </button>

      <div className="flex items-center justify-between border-t border-violet-100/80 px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={(event) => react(1, event)} className={`rounded-full p-2 transition-all active:scale-90 ${vote === 1 ? "bg-violet-100 text-violet-700" : "text-slate-400 hover:bg-violet-50 hover:text-violet-600"}`} aria-label="Agree with this take">
            <ThumbsUp className="h-4 w-4" fill={vote === 1 ? "currentColor" : "none"} />
          </button>
          <span className="min-w-5 text-center text-[12px] font-bold text-slate-500">{take.upvotes || 0}</span>
          <button onClick={(event) => react(-1, event)} className={`rounded-full p-2 transition-all active:scale-90 ${vote === -1 ? "bg-rose-50 text-rose-600" : "text-slate-400 hover:bg-rose-50 hover:text-rose-500"}`} aria-label="Disagree with this take">
            <ThumbsDown className="h-4 w-4" fill={vote === -1 ? "currentColor" : "none"} />
          </button>
          <button onClick={navigateToThread} className="ml-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[12px] font-semibold text-slate-500 transition-colors hover:bg-violet-50 hover:text-violet-700">
            <MessageCircle className="h-4 w-4" /> {take.reply_count || 0} {take.reply_count === 1 ? "reply" : "replies"}
          </button>
        </div>
        <button onClick={navigateToThread} className="inline-flex items-center gap-1 text-[13px] font-extrabold text-violet-700 transition-transform group-hover:translate-x-0.5">
          Join <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}