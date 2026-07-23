import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, Vote, Loader2, CheckCircle, XCircle, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const ACCENT = "#7c3aed";

const norm = (s: any) => String(s || "").toLowerCase().trim();

// Per-room genre definitions over canonical genres in the media_genres cache.
// Mirrors the intent of the room-explore ROOM_CONFIG (explicit include/exclude,
// never fuzzy keywords). `anyOf` = at least one must match, `allOf` = all must
// match (rom-com = romance AND comedy), `none` = disqualifiers.
// "Heartwarming" is a vibe, not a real genre — defined as romance/family/
// friendship stories with all dark genres excluded.
const ROOM_GENRE_CONFIG: Record<string, { anyOf?: string[]; allOf?: string[]; none?: string[] }> = {
  "true-crime":      { anyOf: ["true crime"], none: ["animation"] },
  "mystery":         { anyOf: ["mystery", "detective", "women sleuths"], none: ["animation"] },
  "reality":         { anyOf: ["reality"] },
  "horror":          { anyOf: ["horror"] },
  "action-thriller": { anyOf: ["action", "thriller"], none: ["animation"] },
  "fantasy":         { anyOf: ["fantasy"] },
  "period-drama":    { anyOf: ["history", "historical"], none: ["animation"] },
  "heartwarming":    { anyOf: ["romance", "family life", "friendship"], none: ["horror", "crime", "true crime", "thriller", "mystery", "science fiction", "animation", "war"] },
  "rom-com":         { allOf: ["romance", "comedy"], none: ["animation", "horror"] },
};

function genresMatchRoom(genres: string[], cfg: { anyOf?: string[]; allOf?: string[]; none?: string[] }): boolean {
  const set = new Set(genres.map(norm));
  if (cfg.none && cfg.none.some((g) => set.has(g))) return false;
  if (cfg.allOf) return cfg.allOf.every((g) => set.has(g));
  if (cfg.anyOf) return cfg.anyOf.some((g) => set.has(g));
  return false;
}

// One playable item = one prediction_pools row (first question for trivia packs).
type PlayItem = {
  poolId: string;
  type: "trivia" | "vote";
  question: string;
  options: string[];
  correctAnswer?: string;
  pointsReward: number;
  showTag?: string;
};

function extractItem(pool: any): PlayItem | null {
  const isTrivia = pool.type === "trivia";
  if (!Array.isArray(pool.options) || pool.options.length === 0) return null;
  const first = pool.options[0];
  if (typeof first === "object" && first !== null && "question" in first) {
    // question-object format (trivia packs) — use the first question
    if (!first.question || !Array.isArray(first.options)) return null;
    return {
      poolId: pool.id,
      type: isTrivia ? "trivia" : "vote",
      question: first.question,
      options: first.options,
      correctAnswer: first.answer || pool.correct_answer,
      pointsReward: isTrivia ? 10 : pool.points_reward || 5,
      showTag: pool.show_tag || undefined,
    };
  }
  const optionsList = pool.options.filter((o: any) => typeof o === "string");
  if (optionsList.length === 0) return null;
  return {
    poolId: pool.id,
    type: isTrivia ? "trivia" : "vote",
    question: pool.title,
    options: optionsList,
    correctAnswer: pool.correct_answer,
    pointsReward: isTrivia ? 10 : pool.points_reward || 5,
    showTag: pool.show_tag || undefined,
  };
}

export default function RoomPlay({ roomName, seriesTag, exampleTitles, logRoomEvent }: {
  roomName: string;
  seriesTag?: string | null;
  exampleTitles: string[];
  logRoomEvent: (action_type: string, metadata?: Record<string, any>) => Promise<void>;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, { answer: string; isCorrect?: boolean; points: number; stats: Record<string, number> }>>({});

  // Room keyword set: name, series_tag, example titles
  const keywords = useMemo(() => {
    const set = new Set<string>();
    if (roomName) set.add(norm(roomName));
    if (seriesTag) set.add(norm(seriesTag));
    for (const t of exampleTitles) if (t) set.add(norm(t));
    return set;
  }, [roomName, seriesTag, exampleTitles]);

  const { data, isLoading } = useQuery({
    queryKey: ["room-play", roomName, seriesTag, exampleTitles.join("|"), user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: pools, error } = await supabase
        .from("prediction_pools")
        .select("*")
        .in("type", ["trivia", "vote", "poll"])
        .eq("status", "open")
        .or(`publish_at.is.null,publish_at.lte.${now}`)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const roomNameN = norm(roomName);
      const seriesN = norm(seriesTag);
      const tagMatch = (p: any) => {
        const partner = norm(p.partner_tag);
        if (partner && (roomNameN.includes(partner) || seriesN === partner)) return true;
        const show = norm(p.show_tag);
        if (show && keywords.has(show)) return true;
        if (Array.isArray(p.media_tags) && p.media_tags.some((t: any) => keywords.has(norm(t)))) return true;
        return false;
      };
      let matches = (pools || []).filter(tagMatch);

      // Second layer: genre matching for genre rooms. Pools linked to a media
      // title whose cached canonical genres fit this room's genre definition.
      const genreCfg = ROOM_GENRE_CONFIG[seriesN];
      if (genreCfg) {
        const matchedIds = new Set(matches.map((p: any) => p.id));
        const withMedia = (pools || []).filter(
          (p: any) => !matchedIds.has(p.id) && p.media_external_id && p.media_external_source,
        );
        if (withMedia.length > 0) {
          const { data: genreRows } = await supabase
            .from("media_genres")
            .select("external_source, external_id, canonical_genres")
            .in("external_id", [...new Set(withMedia.map((p: any) => p.media_external_id))]);
          const genreMap: Record<string, string[]> = {};
          for (const g of genreRows || []) genreMap[`${g.external_source}::${g.external_id}`] = g.canonical_genres || [];
          const genreMatches = withMedia.filter((p: any) => {
            const genres = genreMap[`${p.media_external_source}::${p.media_external_id}`];
            return genres && genres.length > 0 && genresMatchRoom(genres, genreCfg);
          });
          matches = [...matches, ...genreMatches];
        }
      }

      // My existing answers (dedup + answered display)
      let myAnswers: any[] = [];
      if (user?.id && matches.length > 0) {
        const { data: preds } = await supabase
          .from("user_predictions")
          .select("pool_id, prediction, points_earned")
          .eq("user_id", user.id)
          .in("pool_id", matches.map((p: any) => p.id));
        myAnswers = preds || [];
      }
      const answeredMap: Record<string, any> = {};
      for (const a of myAnswers) answeredMap[a.pool_id] = a;

      // Community stats for answered pools
      const answeredIds = Object.keys(answeredMap);
      const statsByPool: Record<string, Record<string, number>> = {};
      if (answeredIds.length > 0) {
        const { data: allVotes } = await supabase
          .from("user_predictions")
          .select("pool_id, prediction")
          .in("pool_id", answeredIds);
        for (const poolId of answeredIds) {
          const votes = (allVotes || []).filter((v) => v.pool_id === poolId);
          const total = votes.length || 1;
          const counts: Record<string, number> = {};
          for (const v of votes) counts[v.prediction] = (counts[v.prediction] || 0) + 1;
          const stats: Record<string, number> = {};
          for (const k of Object.keys(counts)) stats[k] = Math.round((counts[k] / total) * 100);
          statsByPool[poolId] = stats;
        }
      }

      const items = matches.map(extractItem).filter(Boolean) as PlayItem[];
      return { items, answeredMap, statsByPool };
    },
    staleTime: 60 * 1000,
  });

  const items = data?.items || [];
  const answeredMap = data?.answeredMap || {};
  const statsByPool = data?.statsByPool || {};

  const answerMutation = useMutation({
    mutationFn: async ({ item, answer }: { item: PlayItem; answer: string }) => {
      if (!user?.id) throw new Error("Sign in to play");
      const { data: existing } = await supabase
        .from("user_predictions")
        .select("id")
        .eq("user_id", user.id)
        .eq("pool_id", item.poolId)
        .maybeSingle();
      if (existing) throw new Error("You already answered this one");

      const isCorrect = item.type === "trivia" ? item.correctAnswer === answer : undefined;
      const points = item.type === "trivia" ? (isCorrect ? item.pointsReward : 0) : item.pointsReward;

      const { error } = await supabase.from("user_predictions").insert({
        user_id: user.id,
        pool_id: item.poolId,
        prediction: answer,
        points_earned: points,
      });
      if (error) {
        if (error.message.includes("duplicate") || error.code === "23505") throw new Error("You already answered this one");
        throw error;
      }
      if (item.type === "trivia" && points > 0) {
        await supabase.rpc("increment_trivia_points", { uid: user.id, pts: points });
      }
      logRoomEvent(item.type === "trivia" ? "room_trivia_answer" : "room_vote_cast", { pool_id: item.poolId });

      const { data: allVotes } = await supabase
        .from("user_predictions")
        .select("prediction")
        .eq("pool_id", item.poolId);
      const total = allVotes?.length || 1;
      const stats: Record<string, number> = {};
      for (const opt of item.options) {
        const count = (allVotes || []).filter((v) => v.prediction === opt).length;
        stats[opt] = Math.round((count / total) * 100);
      }
      return { poolId: item.poolId, answer, isCorrect, points, stats };
    },
    onSuccess: (r) => {
      setResults((prev) => ({ ...prev, [r.poolId]: r }));
      queryClient.invalidateQueries({ queryKey: ["trivia-carousel"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-14"><Loader2 className="animate-spin text-purple-400" size={24} /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="text-[15px] font-semibold text-gray-700 mb-1.5">No games in this room yet</p>
        <p className="text-[13px] text-gray-400 leading-relaxed">Trivia and votes made for this room will show up here.</p>
      </div>
    );
  }

  return (
    <div className="pt-5 px-4 space-y-4">
      {items.map((item) => {
        const prior = answeredMap[item.poolId];
        const result = results[item.poolId];
        const done = !!result || !!prior;
        const myAnswer = result?.answer ?? prior?.prediction;
        const stats = result?.stats ?? statsByPool[item.poolId] ?? {};
        const isTrivia = item.type === "trivia";
        const isCorrect = isTrivia ? (result ? result.isCorrect : prior ? item.correctAnswer === prior.prediction : undefined) : undefined;
        const pending = answerMutation.isPending && selected[item.poolId] !== undefined && !done;

        return (
          <div key={item.poolId} className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: isTrivia ? "#f3effe" : "#eaf1ff" }}>
                  {isTrivia ? <Brain size={17} style={{ color: ACCENT }} /> : <Vote size={17} style={{ color: "#2563eb" }} />}
                </div>
                <div>
                  <p className="text-[14px] font-bold text-gray-900 leading-tight">{isTrivia ? "Trivia" : "Cast Your Vote"}</p>
                  {item.showTag && <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>{item.showTag}</p>}
                </div>
              </div>
              {done && isTrivia && (
                isCorrect
                  ? <span className="flex items-center gap-1 text-[12px] font-bold text-emerald-500"><CheckCircle size={15} /> +{result?.points ?? item.pointsReward} pts</span>
                  : <span className="flex items-center gap-1 text-[12px] font-bold text-red-400"><XCircle size={15} /> Missed</span>
              )}
              {done && !isTrivia && <span className="flex items-center gap-1 text-[12px] font-bold text-emerald-500"><Check size={15} /> Voted</span>}
            </div>

            <p className="text-[17px] font-extrabold text-gray-900 leading-snug mb-4">{item.question}</p>

            <div className="grid grid-cols-2 gap-2.5">
              {item.options.map((o, i) => {
                const isMine = done && myAnswer === o;
                const isRight = done && isTrivia && item.correctAnswer === o;
                const pct = stats[o];
                let cls = "rounded-2xl px-3 py-3.5 text-[13px] font-medium text-center transition-transform relative overflow-hidden ";
                let style: any = {};
                if (!done) {
                  cls += "bg-gray-50 border border-gray-100 text-gray-700 active:scale-[0.98]";
                } else if (isRight) {
                  cls += "border text-emerald-700";
                  style = { background: "#ecfdf5", borderColor: "#a7f3d0" };
                } else if (isMine && isTrivia && !isRight) {
                  cls += "border text-red-600";
                  style = { background: "#fef2f2", borderColor: "#fecaca" };
                } else if (isMine) {
                  cls += "border font-semibold";
                  style = { background: "#f3effe", borderColor: "#ddd0fb", color: ACCENT };
                } else {
                  cls += "bg-gray-50 border border-gray-100 text-gray-400";
                }
                return (
                  <button
                    key={i}
                    disabled={done || pending}
                    onClick={() => {
                      setSelected((prev) => ({ ...prev, [item.poolId]: o }));
                      answerMutation.mutate({ item, answer: o });
                    }}
                    className={cls}
                    style={style}
                  >
                    <span className="relative z-10">
                      {o}
                      {done && pct !== undefined && <span className="ml-1.5 text-[11px] font-bold opacity-70">{pct}%</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {!done && (
              <p className="text-right text-[12px] font-bold text-emerald-500 mt-3">+{item.pointsReward} pts</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
