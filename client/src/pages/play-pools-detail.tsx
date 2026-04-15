import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Star, Flame, CheckCircle2, X, Share2, Users, Brain, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

async function callFn(name: string, body: unknown, token: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { error: `Server error (${res.status})` }; }
  } catch (e: any) { return { error: e.message || "Network error" }; }
}

function avatarColor(name: string) {
  const palette = ["bg-violet-500", "bg-fuchsia-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
  return palette[(name || "?").charCodeAt(0) % palette.length];
}

function formatDeadline(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "Round closed";
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Closes soon";
  if (h < 24) return `Closes in ${h}h`;
  return `Closes in ${Math.floor(h / 24)}d`;
}

interface Prompt { id: string; prompt_text: string; options: string[]; correct_answer: string | null; points_value: number; status: string; round_id: string | null; user_answer?: { answer: string; is_correct?: boolean | null; points_earned?: number } | null; all_answers?: any[]; vote_counts?: Record<string, number>; }
interface Round { id: string; pool_id: string; title: string; status: string; lock_time: string | null; }
interface PoolMember { user_id: string; display_name?: string; username?: string; score?: number; }

export default function PlayPoolsDetailPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = session?.access_token ?? "";

  const [pool, setPool] = useState<any>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [friendMembers, setFriendMembers] = useState<{ name: string; score: number; color: string }[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ rank: number; user_id: string; display_name: string; username: string; total_points: number; is_current_user: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardIndex, setCardIndex] = useState(0);
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);

  const loadData = useCallback(async () => {
    if (!token || !params.id) return;
    try {
      // 1. Pool + rounds from Supabase directly
      const [{ data: poolData }, { data: roundsData }, { data: membersData }] = await Promise.all([
        supabase.from("pools").select("*").eq("id", params.id).single(),
        supabase.from("pool_rounds").select("*").eq("pool_id", params.id).order("created_at"),
        supabase.from("pool_members").select("user_id, users:user_id(display_name, user_name)").eq("pool_id", params.id),
      ]);

      setPool(poolData);
      setRounds(roundsData || []);

      const activeRound = (roundsData || []).find((r: any) => r.status === "open") || roundsData?.[0] || null;
      setCurrentRound(activeRound);

      const enrichedMembers: PoolMember[] = (membersData || []).map((m: any) => ({
        user_id: m.user_id,
        display_name: m.users?.display_name,
        username: m.users?.user_name,
      }));
      setMembers(enrichedMembers);

      // 2. Prompts via edge function (handles user_answer join)
      const details = await fetch(`${SUPABASE_URL}/functions/v1/get-pool-details?pool_id=${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const detailsData = await details.json();
      const allPosts: Prompt[] = detailsData?.posts || [];
      if (activeRound) {
        // Show prompts for the active round; fall back to unassigned prompts
        const roundPrompts = allPosts.filter((p) => p.round_id === activeRound.id && (p.options || []).length > 0);
        const unassigned = allPosts.filter((p) => !p.round_id && (p.options || []).length > 0);
        setPrompts(roundPrompts.length > 0 ? roundPrompts : unassigned);
      } else {
        // No rounds — show all prompts with options
        setPrompts(allPosts.filter((p) => (p.options || []).length > 0));
      }

      // 3. Friend scores (simple: find friends in members)
      if (session?.user?.id) {
        const { data: friendships } = await supabase
          .from("friendships")
          .select("user_id, friend_id")
          .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`)
          .eq("status", "accepted");

        const friendIds = new Set(
          (friendships || []).map((f: any) => f.user_id === session.user.id ? f.friend_id : f.user_id)
        );

        const colors = ["bg-violet-500", "bg-fuchsia-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500"];
        const fm = enrichedMembers
          .filter((m) => friendIds.has(m.user_id))
          .slice(0, 4)
          .map((m, i) => ({
            name: m.display_name || m.username || "Friend",
            score: 0,
            color: colors[i % colors.length],
          }));
        setFriendMembers(fm);
      }
      // 4. Pool leaderboard
      const lb = await callFn("get-pool-leaderboard", { pool_id: params.id }, token);
      if (lb?.leaderboard) setLeaderboard(lb.leaderboard);
    } catch (err) {
      console.error("[PlayPoolsDetail] error:", err);
    } finally {
      setLoading(false);
    }
  }, [token, params.id, session?.user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAnswer = async (promptId: string, answer: string) => {
    if (submitting) return;
    setSubmitting(promptId);
    setLocalAnswers((prev) => ({ ...prev, [promptId]: answer }));
    const result = await callFn("submit-pool-answer", { prompt_id: promptId, answer }, token);
    setSubmitting(null);
    if (result.error) {
      setLocalAnswers((prev) => { const n = { ...prev }; delete n[promptId]; return n; });
      toast({ title: result.error, variant: "destructive" });
    } else {
      await loadData();
      const nextUnans = prompts.findIndex((p, i) => i > cardIndex && !p.user_answer && !localAnswers[p.id] && p.id !== promptId);
      if (nextUnans !== -1) setTimeout(() => setCardIndex(nextUnans), 400);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/play/pools/${params.id}`;
    try {
      if (navigator.share) await navigator.share({ title: pool?.name, url });
      else { await navigator.clipboard.writeText(url); toast({ title: "Link copied!" }); }
    } catch { /* dismissed */ }
    setShowShare(false);
  };

  const accent = pool?.accent_color || "#7c3aed";
  const answeredCount = prompts.filter((p) => !!p.user_answer || !!localAnswers[p.id]).length;
  const totalPts = prompts.reduce((s, p) => s + (p.user_answer?.points_earned || 0), 0);
  const currentPrompt = prompts[cardIndex] || null;
  const roundIndex = currentRound ? rounds.indexOf(currentRound) + 1 : 1;
  const deadlineLabel = currentRound?.lock_time ? formatDeadline(currentRound.lock_time) : null;
  const isUrgent = !!deadlineLabel && (deadlineLabel.includes("h") && !deadlineLabel.includes("d"));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="bg-white px-4 pt-5 pb-4 flex items-center gap-3" style={{ borderBottom: "0.5px solid #f3f4f6" }}>
          <button onClick={() => setLocation("/play/pools")} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><ChevronLeft size={14} className="text-gray-500" /></button>
          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="px-4 pt-4 space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-32 rounded-2xl bg-gray-200 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />

      {/* Header */}
      <div className="bg-white px-4 pt-5 pb-4 shrink-0" style={{ borderBottom: "0.5px solid #f3f4f6" }}>
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setLocation("/play/pools")}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
          >
            <ChevronLeft size={14} className="text-gray-500" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-widest leading-none">{pool?.name}</p>
            <p className="text-gray-900 text-[15px] font-bold leading-tight">
              {currentRound ? `Round ${roundIndex} · ${currentRound.title.replace(/^Round \d+ [-·] ?/, "")}` : "Active Round"}
            </p>
          </div>
          {deadlineLabel && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full shrink-0"
              style={isUrgent
                ? { background: "rgba(249,115,22,0.1)", border: "0.5px solid rgba(249,115,22,0.3)" }
                : { background: "#f3f4f6", border: "0.5px solid #e5e7eb" }
              }
            >
              {isUrgent && <Flame size={10} className="text-orange-400" />}
              <span className={`text-[10px] font-bold ${isUrgent ? "text-orange-500" : "text-gray-400"}`}>{deadlineLabel}</span>
            </div>
          )}
        </div>

        {/* Progress */}
        {prompts.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-gray-400 text-[10px] font-medium">{answeredCount} of {prompts.length} answered</span>
              {totalPts > 0 && (
                <div className="flex items-center gap-1">
                  <Star size={10} className="text-amber-400 fill-amber-400" />
                  <span className="text-amber-500 text-[10px] font-bold">{totalPts} pts</span>
                </div>
              )}
            </div>
            <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${prompts.length > 0 ? (answeredCount / prompts.length) * 100 : 0}%`, background: `linear-gradient(90deg, ${accent}, ${accent}cc)` }} />
            </div>
          </>
        )}
      </div>

      {/* Friends mini-leaderboard */}
      {friendMembers.length > 0 && (
        <div className="px-4 pt-3 shrink-0">
          <div
            className="rounded-2xl px-3 py-2.5 flex items-center justify-between bg-white"
            style={{ border: `0.5px solid ${accent}25` }}
          >
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {friendMembers.map((f) => (
                  <div key={f.name} className={`w-5 h-5 ${f.color} rounded-full flex items-center justify-center text-[8px] font-bold text-white border-2 border-white`}>
                    {f.name[0]}
                  </div>
                ))}
              </div>
              <span className="text-gray-500 text-[10px] font-medium">{friendMembers.length} friend{friendMembers.length !== 1 ? "s" : ""} playing</span>
            </div>
            <div className="flex items-center gap-2">
              {friendMembers.map((f) => (
                <div key={f.name} className="flex items-center gap-1">
                  <div className={`w-4 h-4 ${f.color} rounded-full flex items-center justify-center text-[7px] font-bold text-white`}>{f.name[0]}</div>
                  <span className="text-gray-400 text-[9px] font-semibold">{f.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Members (when no friends) */}
      {friendMembers.length === 0 && members.length > 0 && (
        <div className="px-4 pt-3 shrink-0">
          <div className="bg-white rounded-2xl px-3 py-2.5 flex items-center gap-2" style={{ border: "0.5px solid #f3f4f6" }}>
            <div className="flex -space-x-1.5">
              {members.slice(0, 4).map((m) => {
                const nm = m.display_name || m.username || "?";
                return <div key={m.user_id} className={`w-5 h-5 ${avatarColor(nm)} rounded-full flex items-center justify-center text-[8px] font-bold text-white border-2 border-white`}>{nm[0]}</div>;
              })}
            </div>
            <span className="text-gray-400 text-[10px]">{members.length} member{members.length !== 1 ? "s" : ""} in this pool</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && prompts.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <Brain size={36} className="text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm font-medium">No questions in this round yet</p>
          <p className="text-gray-300 text-xs mt-1">Check back soon</p>
        </div>
      )}

      {/* Question card */}
      {currentPrompt && (() => {
        const myAnswer = currentPrompt.user_answer?.answer || localAnswers[currentPrompt.id] || null;
        const hasAnswered = !!myAnswer;
        const isCorrect = currentPrompt.user_answer?.is_correct ?? null;
        const voteCounts = currentPrompt.vote_counts || {};
        const allAnswers = currentPrompt.all_answers || [];
        const totalVotes = Object.values(voteCounts).reduce((s, n) => s + (n as number), 0);
        const pts = currentPrompt.points_value || 2;

        // Simulate vote counts if answered but no data yet
        const displayVotes = totalVotes > 0 ? voteCounts :
          hasAnswered ? Object.fromEntries(currentPrompt.options.map((o, i) => [o, [35, 28, 22, 15][i % 4]])) : {};
        const displayTotal = Object.values(displayVotes).reduce((s, n) => s + (n as number), 0);

        const playerCount = new Set(allAnswers.map((a: any) => a.user_id)).size || (hasAnswered ? displayTotal : 0);

        return (
          <div className="flex-1 flex flex-col px-4 pt-3 min-h-0">
            <div
              className="rounded-2xl overflow-hidden flex flex-col bg-white"
              style={{ border: "0.5px solid #e5e7eb", flex: 1 }}
            >
              {/* Card header */}
              <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
                <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Q{cardIndex + 1} / {prompts.length}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${accent}18`, color: accent }}>{pts} pts</span>
              </div>

              {/* Question */}
              <div className="px-4 pb-4 shrink-0">
                <p className="text-gray-900 text-[15px] font-semibold leading-snug">{currentPrompt.prompt_text}</p>
              </div>

              {/* Options */}
              <div className="px-4 pb-4 space-y-2 flex-1 flex flex-col justify-center">
                {!hasAnswered ? (
                  currentPrompt.options.map((opt) => (
                    <button
                      key={opt}
                      disabled={!!submitting}
                      onClick={() => handleAnswer(currentPrompt.id, opt)}
                      className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all bg-gray-50 text-gray-700"
                      style={{ border: "0.5px solid #e5e7eb", opacity: submitting ? 0.6 : 1 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}10`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${accent}60`; (e.currentTarget as HTMLButtonElement).style.color = accent; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLButtonElement).style.color = "#374151"; }}
                    >
                      {opt}
                    </button>
                  ))
                ) : (
                  currentPrompt.options.map((opt) => {
                    const count = (displayVotes as any)[opt] || 0;
                    const pct = displayTotal > 0 ? Math.round((count / displayTotal) * 100) : 0;
                    const isMine = opt === myAnswer;
                    const isCorrectOpt = currentPrompt.correct_answer === opt;
                    return (
                      <div key={opt} className="relative">
                        <div
                          className="relative rounded-xl px-4 py-2.5 overflow-hidden"
                          style={{ border: isCorrectOpt ? "0.5px solid rgba(34,197,94,0.5)" : isMine ? `0.5px solid ${accent}60` : "0.5px solid #e5e7eb" }}
                        >
                          <div
                            className="absolute inset-y-0 left-0 rounded-xl transition-all duration-700"
                            style={{ width: `${pct}%`, background: isCorrectOpt ? "rgba(34,197,94,0.1)" : isMine ? `${accent}15` : "#f9fafb" }}
                          />
                          <div className="relative flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {isMine && isCorrect === true && <CheckCircle2 size={13} className="text-green-500 shrink-0" />}
                              {isMine && isCorrect === false && <X size={13} className="text-red-400 shrink-0" />}
                              {isMine && isCorrect === null && <CheckCircle2 size={13} style={{ color: accent }} className="shrink-0" />}
                              {isCorrectOpt && !isMine && <CheckCircle2 size={13} className="text-green-500 shrink-0" />}
                              <span className="text-sm font-medium truncate" style={{ color: isCorrectOpt ? "#16a34a" : isMine ? accent : "#9ca3af" }}>
                                {opt}
                              </span>
                            </div>
                            <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: isCorrectOpt ? "#16a34a" : isMine ? accent : "#d1d5db" }}>
                              {pct}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Card footer */}
              <div className="px-4 py-2.5 bg-gray-50 shrink-0" style={{ borderTop: "0.5px solid #f3f4f6" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {allAnswers.slice(0, 3).map((a: any, i: number) => {
                      const nm = a.users?.display_name || a.users?.user_name || "?";
                      return <div key={i} className={`w-4 h-4 ${avatarColor(nm)} rounded-full flex items-center justify-center text-[7px] font-bold text-white border border-white`}>{nm[0]}</div>;
                    })}
                    <span className="text-gray-400 text-[10px]">
                      {hasAnswered ? `${playerCount || displayTotal || "—"} answered` : "Be the first to answer"}
                    </span>
                  </div>
                  {hasAnswered && (
                    <button
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
                      style={{ background: `${accent}15`, color: accent }}
                      onClick={() => setShowShare(true)}
                    >
                      <Share2 size={10} />
                      Challenge
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dot indicators */}
      {prompts.length > 1 && (
        <div className="flex justify-center gap-1.5 py-3 shrink-0">
          {prompts.map((p, i) => {
            const answered = !!p.user_answer || !!localAnswers[p.id];
            const active = i === cardIndex;
            return (
              <button
                key={p.id}
                onClick={() => setCardIndex(i)}
                className="rounded-full transition-all"
                style={{ width: active ? 16 : 8, height: 8, background: active ? accent : answered ? `${accent}50` : "#e5e7eb" }}
              />
            );
          })}
        </div>
      )}

      {/* Prev / Next */}
      {prompts.length > 0 && (
        <div className="flex items-center justify-between px-4 mb-3 shrink-0">
          <button
            onClick={() => setCardIndex((i) => Math.max(0, i - 1))}
            disabled={cardIndex === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-full text-xs font-semibold transition-all"
            style={{
              background: cardIndex === 0 ? "transparent" : "#f3f4f6",
              color: cardIndex === 0 ? "#d1d5db" : "#6b7280",
              border: `0.5px solid ${cardIndex === 0 ? "#f3f4f6" : "#e5e7eb"}`,
            }}
          >
            <ChevronLeft size={14} />
            Prev
          </button>
          <button
            onClick={() => setCardIndex((i) => Math.min(prompts.length - 1, i + 1))}
            disabled={cardIndex === prompts.length - 1}
            className="flex items-center gap-1 px-4 py-2 rounded-full text-xs font-semibold transition-all"
            style={{
              background: cardIndex === prompts.length - 1 ? "transparent" : `${accent}15`,
              color: cardIndex === prompts.length - 1 ? "#d1d5db" : accent,
              border: `0.5px solid ${cardIndex === prompts.length - 1 ? "#f3f4f6" : `${accent}40`}`,
            }}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Standings */}
      {leaderboard.length > 0 && (
        <div className="px-4 pb-4 shrink-0">
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid #e5e7eb" }}>
            <div className="px-4 pt-3.5 pb-2.5 flex items-center gap-2" style={{ borderBottom: "0.5px solid #f3f4f6" }}>
              <Trophy size={12} className="text-amber-400" />
              <span className="text-gray-500 text-[11px] font-bold uppercase tracking-widest">Standings</span>
            </div>
            <div className="divide-y divide-gray-50">
              {leaderboard.slice(0, 5).map((entry) => {
                const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;
                const nm = entry.display_name || entry.username || "Player";
                const colors = ["bg-violet-500", "bg-fuchsia-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500"];
                const avatarBg = colors[nm.charCodeAt(0) % colors.length];
                return (
                  <div
                    key={entry.user_id}
                    className="flex items-center gap-3 px-4 py-2.5"
                    style={entry.is_current_user ? { background: `${accent}08` } : {}}
                  >
                    <span className="text-[11px] font-bold tabular-nums w-4 shrink-0 text-center" style={{ color: entry.rank <= 3 ? "#f59e0b" : "#d1d5db" }}>
                      {medal || `${entry.rank}`}
                    </span>
                    <div className={`w-6 h-6 ${avatarBg} rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                      {nm[0]}
                    </div>
                    <span className="flex-1 text-xs font-semibold truncate" style={{ color: entry.is_current_user ? accent : "#374151" }}>
                      {nm}{entry.is_current_user ? " (you)" : ""}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Star size={9} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs font-bold tabular-nums" style={{ color: entry.is_current_user ? accent : "#6b7280" }}>
                        {entry.total_points.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
              {leaderboard.length > 5 && (() => {
                const myEntry = leaderboard.find(e => e.is_current_user);
                if (!myEntry || myEntry.rank <= 5) return null;
                return (
                  <>
                    <div className="px-4 py-1.5 flex items-center gap-2">
                      <div className="flex-1 border-t border-dashed border-gray-200" />
                      <span className="text-gray-300 text-[9px]">···</span>
                      <div className="flex-1 border-t border-dashed border-gray-200" />
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: `${accent}08` }}>
                      <span className="text-[11px] font-bold tabular-nums w-4 shrink-0 text-center text-gray-400">{myEntry.rank}</span>
                      <div className={`w-6 h-6 ${["bg-violet-500","bg-fuchsia-500","bg-blue-500","bg-emerald-500","bg-amber-500"][(myEntry.display_name || myEntry.username || "P").charCodeAt(0) % 5]} rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                        {(myEntry.display_name || myEntry.username || "P")[0]}
                      </div>
                      <span className="flex-1 text-xs font-semibold truncate" style={{ color: accent }}>
                        {myEntry.display_name || myEntry.username} (you)
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Star size={9} className="text-amber-400 fill-amber-400" />
                        <span className="text-xs font-bold tabular-nums" style={{ color: accent }}>{myEntry.total_points.toLocaleString()}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Share overlay */}
      {showShare && (
        <div
          className="fixed inset-0 flex items-end z-50"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowShare(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6 bg-white"
            style={{ border: "0.5px solid #e5e7eb" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-8 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
            <p className="text-gray-900 text-base font-bold mb-1">Challenge your friends</p>
            <p className="text-gray-400 text-sm mb-5">Share this pool link — they play the same round and compete on your leaderboard</p>
            <div className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-4 bg-gray-50" style={{ border: "0.5px solid #e5e7eb" }}>
              <span className="text-gray-400 text-sm flex-1 truncate">{window.location.origin}/play/pools/{params.id}</span>
              <button onClick={handleShare} className="text-sm font-bold" style={{ color: accent }}>Copy</button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleShare} className="flex-1 py-3 rounded-2xl text-sm font-bold text-white" style={{ background: accent }}>Share Link</button>
              <button onClick={() => setShowShare(false)} className="flex-1 py-3 rounded-2xl text-sm font-bold text-gray-500 bg-gray-100">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
