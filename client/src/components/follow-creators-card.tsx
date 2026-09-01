import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Check, Plus, Users, X } from "lucide-react";

interface SuggestedCreator {
  name: string;
  role: string;
  image?: string | null;
  externalId: string;
  externalSource: string;
  trackedCount: number;
}

const DISMISS_KEY = "follow-creators-card-dismissed";
const AVATAR_COLORS = [
  "bg-purple-100 text-purple-700",
  "bg-blue-100 text-blue-700",
  "bg-pink-100 text-pink-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-indigo-100 text-indigo-700",
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function FollowCreatorsCard({ dismissible = true }: { dismissible?: boolean }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(() => dismissible && localStorage.getItem(DISMISS_KEY) === "1");
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

  const { data, isLoading } = useQuery({
    queryKey: ["suggest-creators", session?.user?.id],
    enabled: !!session?.access_token && !dismissed,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const res = await fetch(`${supabaseUrl}/functions/v1/suggest-creators`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to load creator suggestions");
      return res.json() as Promise<{ creators: SuggestedCreator[] }>;
    },
  });

  const creators = data?.creators || [];
  if (dismissed || (!isLoading && creators.length === 0)) return null;
  if (isLoading) return null;

  const toggleFollow = async (creator: SuggestedCreator) => {
    if (!session?.access_token || pendingId) return;
    const isFollowed = followedIds.has(creator.externalId);
    setPendingId(creator.externalId);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/follow-creator`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: isFollowed ? "unfollow" : "follow",
          creatorName: creator.name,
          creatorRole: creator.role,
          creatorImage: creator.image || "",
          externalId: creator.externalId,
          externalSource: creator.externalSource,
        }),
      });
      if (res.ok || res.status === 409) {
        setFollowedIds((prev) => {
          const next = new Set(prev);
          if (isFollowed) next.delete(creator.externalId);
          else next.add(creator.externalId);
          return next;
        });
        // Refresh surfaces that depend on followed creators
        queryClient.invalidateQueries({ queryKey: ["/api/creator-updates"] });
        // Mark suggestions stale so next mount refetches (without yanking chips mid-interaction)
        queryClient.invalidateQueries({ queryKey: ["suggest-creators"], refetchType: "none" });
      }
    } catch {
      // silent — chip stays in previous state
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm" data-testid="follow-creators-card">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-purple-600" />
          <h3 className="font-serif text-[18px] font-medium leading-[1.05] tracking-[-.035em] text-[#30203f]">Artists & Creators</h3>
        </div>
        {dismissible && (
          <button
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
            className="text-gray-300 hover:text-gray-500 shrink-0"
            data-testid="dismiss-follow-creators"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <p className="mt-0.5 mb-3 text-[13px] leading-[1.25] text-gray-400">
        Follow creators you like and sharpen your DNA and recommendations.
      </p>
      <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        {creators.map((creator, i) => {
          const on = followedIds.has(creator.externalId);
          return (
            <div
              key={creator.externalId}
              className="flex flex-col items-center gap-1.5 shrink-0 w-[86px] self-stretch"
              data-testid={`suggested-creator-${creator.externalId}`}
            >
              {creator.image ? (
                <img
                  src={creator.image}
                  alt={creator.name}
                  className="w-14 h-14 rounded-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)?.style.removeProperty("display"); }}
                />
              ) : null}
              <div
                style={creator.image ? { display: "none" } : undefined}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-[16px] font-bold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
              >
                {initials(creator.name)}
              </div>
              <p className="text-[12px] font-semibold text-gray-800 text-center leading-tight line-clamp-2 h-[30px] flex items-center">{creator.name}</p>
              <p className="text-[10px] text-gray-400 -mt-1 mb-auto">{creator.role}</p>
              <button
                onClick={() => toggleFollow(creator)}
                disabled={pendingId === creator.externalId}
                className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                  on
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:border-purple-400"
                }`}
              >
                {on ? <Check size={11} strokeWidth={3} /> : <Plus size={11} />}
                {on ? "Following" : "Follow"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
