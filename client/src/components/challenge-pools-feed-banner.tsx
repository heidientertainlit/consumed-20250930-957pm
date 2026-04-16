import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Share2, Users, ChevronRight } from "lucide-react";

interface Pool {
  id: string;
  show_tag: string;
  title: string;
  poster_url?: string;
  fallback_emoji?: string;
  accent_color?: string;
  category?: string;
}

function completedCount(showTag: string): number {
  return ["easy", "medium", "hard"].filter(
    (d) => localStorage.getItem(`challenge-completed-${showTag}-${d}`) === "1"
  ).length;
}

export function ChallengePoolsFeedBanner() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [pools, setPools] = useState<Pool[]>([]);

  useEffect(() => {
    supabase
      .from("challenge_pools")
      .select("id, show_tag, title, poster_url, fallback_emoji, accent_color, category")
      .eq("is_active", true)
      .limit(6)
      .then(({ data }) => {
        if (data && data.length > 0) {
          // shuffle slightly so feed doesn't always show same order
          const shuffled = [...data].sort(() => Math.random() - 0.5);
          setPools(shuffled.slice(0, 3));
        }
      });
  }, []);

  if (pools.length === 0) return null;

  function handleShare(pool: Pool, e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/play/challenge/${encodeURIComponent(pool.show_tag)}/easy${user?.id ? `?from=${user.id}` : ""}`;
    const text = `Think you know ${pool.title}? Challenge me on Consumed!`;
    if (navigator.share) {
      navigator.share({ title: "Challenge me on Consumed", text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text} ${url}`);
    }
  }

  return (
    <div className="mx-4 my-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-purple-500" />
          <span className="text-[13px] font-bold text-gray-900">Play with Friends</span>
        </div>
        <button
          onClick={() => setLocation("/play/pools")}
          className="flex items-center gap-0.5 text-[11px] text-purple-600 font-semibold"
        >
          See all <ChevronRight size={11} />
        </button>
      </div>

      {/* Pool cards */}
      <div className="flex flex-col gap-2">
        {pools.map((pool) => {
          const done = completedCount(pool.show_tag);
          const accent = pool.accent_color || "#7c3aed";

          return (
            <div
              key={pool.id}
              className="flex items-center gap-3 bg-white rounded-2xl px-3 py-2.5 cursor-pointer active:scale-[0.99] transition-transform"
              style={{ border: "0.5px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
              onClick={() =>
                setLocation(`/play/challenge/${encodeURIComponent(pool.show_tag)}/easy`)
              }
            >
              {/* Poster / emoji */}
              <div
                className="w-10 h-10 rounded-xl shrink-0 overflow-hidden flex items-center justify-center text-lg"
                style={{ background: accent + "18" }}
              >
                {pool.poster_url ? (
                  <img src={pool.poster_url} alt={pool.title} className="w-full h-full object-cover" />
                ) : (
                  <span>{pool.fallback_emoji || "🎬"}</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-900 truncate">{pool.title}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  36 questions · 3 rounds
                  {done > 0 && (
                    <span className="ml-1.5 font-semibold" style={{ color: accent }}>
                      {done}/3 done
                    </span>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={(e) => handleShare(pool, e)}
                  className="p-1.5 rounded-lg"
                  style={{ background: accent + "15", color: accent }}
                  title="Challenge a friend"
                >
                  <Share2 size={13} />
                </button>
                <div
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white"
                  style={{ background: accent }}
                >
                  Play
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
