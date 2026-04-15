import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Star, Flame, CheckCircle2, X, Share2, Users, Brain, Globe } from "lucide-react";
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
  } catch (e: any) {
    return { error: e.message || "Network error" };
  }
}

function avatarColor(name: string) {
  const palette = ["bg-violet-500", "bg-fuchsia-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
  return palette[(name || "?").charCodeAt(0) % palette.length];
}

function formatDeadline(deadline: string | null | undefined): string | null {
  if (!deadline) return null;
  try {
    const diffMs = new Date(deadline).getTime() - Date.now();
    if (diffMs < 0) return "Round closed";
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return "Closes soon";
    if (diffH < 24) return `Closes in ${diffH}h`;
    return `Closes in ${Math.floor(diffH / 24)}d`;
  } catch { return null; }
}

/* ── Progress bar ────────────────────────────────────── */
function ProgressBar({ answered, total, accent }: { answered: number; total: number; accent: string }) {
  const pct = total > 0 ? (answered / total) * 100 : 0;
  return (
    <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: accent }}
      />
    </div>
  );
}

/* ── Single question card ────────────────────────────── */
function QuestionCard({
  prompt, index, total, localAnswer, submitting, onAnswer, onPrev, onNext,
}: {
  prompt: any; index: number; total: number;
  localAnswer: string | null; submitting: boolean;
  onAnswer: (a: string) => void; onPrev: () => void; onNext: () => void;
}) {
  const opts: string[] = prompt.options || [];
  const myAnswer = prompt.user_answer?.answer || localAnswer || null;
  const hasAnswered = !!myAnswer;
  const isResolved = prompt.status === "resolved";
  const isCorrect = prompt.user_answer?.is_correct ?? null;
  const voteCounts: Record<string, number> = prompt.vote_counts || {};
  const totalVotes = Object.values(voteCounts).reduce((s, n) => s + (n as number), 0);
  const allAnswers: any[] = prompt.all_answers || [];
  const pts = prompt.points_value || 2;

  // Unique players from all_answers
  const playerNames: string[] = [];
  const seen = new Set<string>();
  for (const a of allAnswers) {
    const nm = a.users?.display_name || a.users?.user_name;
    if (nm && !seen.has(a.user_id)) { seen.add(a.user_id); playerNames.push(nm); if (playerNames.length >= 4) break; }
  }
  const playerCount = seen.size || totalVotes;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{ border: "0.5px solid #e5e7eb" }}>
      {/* Card header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Q{index + 1} / {total}</span>
        <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{pts} pts</span>
      </div>

      {/* Question text */}
      <div className="px-4 pb-4">
        <p className="text-gray-900 text-[15px] font-semibold leading-snug">{prompt.prompt_text}</p>
      </div>

      {/* Options or results */}
      <div className="px-4 pb-4 space-y-2">
        {!hasAnswered ? (
          opts.map((opt) => (
            <button
              key={opt}
              disabled={submitting}
              onClick={() => onAnswer(opt)}
              className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border border-gray-200 bg-gray-50 text-gray-700 active:scale-[0.98]"
              style={{ opacity: submitting ? 0.6 : 1 }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#f3f0ff";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#7c3aed";
                (e.currentTarget as HTMLButtonElement).style.color = "#7c3aed";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb";
                (e.currentTarget as HTMLButtonElement).style.color = "#374151";
              }}
            >
              {opt}
            </button>
          ))
        ) : (
          opts.map((opt) => {
            const count = voteCounts[opt] || 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isMine = opt === myAnswer;
            const isCorrectOpt = isResolved && prompt.correct_answer === opt;
            return (
              <div key={opt} className="relative">
                <div
                  className={`relative rounded-xl px-4 py-2.5 overflow-hidden ${
                    isCorrectOpt ? "border border-green-300" : isMine ? "border border-purple-300" : "border border-gray-100"
                  }`}
                >
                  <div
                    className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-700 ${
                      isCorrectOpt ? "bg-green-50" : isMine ? "bg-purple-50" : "bg-gray-50"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isMine && isCorrect === true && <CheckCircle2 size={13} className="text-green-500 shrink-0" />}
                      {isMine && isCorrect === false && <X size={13} className="text-red-400 shrink-0" />}
                      {isMine && isCorrect === null && <CheckCircle2 size={13} className="text-purple-400 shrink-0" />}
                      {isCorrectOpt && !isMine && <CheckCircle2 size={13} className="text-green-500 shrink-0" />}
                      <span
                        className="text-sm font-medium truncate"
                        style={{ color: isCorrectOpt ? "#16a34a" : isMine ? "#7c3aed" : "#6b7280" }}
                      >
                        {opt}
                      </span>
                    </div>
                    <span
                      className="text-xs font-bold tabular-nums shrink-0"
                      style={{ color: isCorrectOpt ? "#16a34a" : isMine ? "#7c3aed" : "#9ca3af" }}
                    >
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
      <div className="px-4 py-2.5 bg-gray-50 flex items-center justify-between" style={{ borderTop: "0.5px solid #f3f4f6" }}>
        <div className="flex items-center gap-2">
          {playerNames.length > 0 && (
            <div className="flex -space-x-1">
              {playerNames.slice(0, 3).map((n) => (
                <div key={n} className={`w-4 h-4 ${avatarColor(n)} rounded-full flex items-center justify-center text-[7px] font-bold text-white border border-white`}>{n[0]}</div>
              ))}
            </div>
          )}
          <span className="text-gray-400 text-[10px]">
            {hasAnswered ? `${playerCount || "—"} answered` : "Be the first to answer"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrev}
            disabled={index === 0}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${index === 0 ? "text-gray-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={onNext}
            disabled={index === total - 1}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${index === total - 1 ? "text-gray-200" : "bg-purple-100 text-purple-600 hover:bg-purple-200"}`}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────── */
export default function PlayPoolsDetailPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = session?.access_token ?? "";

  const [cardIndex, setCardIndex] = useState(0);
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pool-detail", params.id],
    queryFn: async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-pool-details?pool_id=${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    enabled: !!token && !!params.id,
  });

  const pool = data?.pool;
  const accent = pool?.accent_color || "#7c3aed";
  const accentLight = accent + "18";
  const members: any[] = data?.members || [];

  // Questions: any pool_prompt that has selectable options
  const allPosts: any[] = data?.posts || [];
  const quizPrompts = allPosts.filter((p: any) => (p.options || []).length > 0);

  const answeredCount = quizPrompts.filter((p: any) => !!p.user_answer || !!localAnswers[p.id]).length;
  const totalPoints = quizPrompts.reduce((sum: number, p: any) => sum + (p.user_answer?.points_earned || 0), 0);
  const deadlineLabel = pool?.deadline ? formatDeadline(pool.deadline) : null;
  const currentPrompt = quizPrompts[cardIndex] || null;

  // Auto-clamp index
  useEffect(() => {
    if (cardIndex >= quizPrompts.length && quizPrompts.length > 0) setCardIndex(quizPrompts.length - 1);
  }, [quizPrompts.length]);

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
      queryClient.invalidateQueries({ queryKey: ["pool-detail", params.id] });
      // Auto-advance to next unanswered
      const nextUnanswered = quizPrompts.findIndex(
        (p: any, i: number) => i > cardIndex && !p.user_answer && !localAnswers[p.id] && p.id !== promptId
      );
      if (nextUnanswered !== -1) setTimeout(() => setCardIndex(nextUnanswered), 400);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/play/pools/${params.id}`;
    try {
      if (navigator.share) await navigator.share({ title: pool?.name, url });
      else { await navigator.clipboard.writeText(url); toast({ title: "Link copied!" }); }
    } catch { /* dismissed */ }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div style={{ background: "linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)" }} className="px-4 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/play/pools")} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
              <ChevronLeft size={14} className="text-white/70" />
            </button>
            <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
        <div className="px-4 pt-4 space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-32 rounded-2xl bg-gray-200 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f9fafb" }}>
      <Navigation />

      {/* Dark gradient header */}
      <div
        className="px-4 pt-6 pb-4"
        style={{ background: "linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)" }}
      >
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => setLocation("/play/pools")}
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <ChevronLeft size={14} className="text-white/70" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest leading-none mb-0.5">Pools</p>
            <p className="text-white text-lg font-bold leading-tight truncate" style={{ fontFamily: "Poppins, sans-serif" }}>
              {pool?.name || "Loading..."}
            </p>
          </div>
          {deadlineLabel && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full shrink-0"
              style={{ background: "rgba(249,115,22,0.2)", border: "0.5px solid rgba(249,115,22,0.4)" }}
            >
              <Flame size={10} className="text-orange-400" />
              <span className="text-orange-300 text-[10px] font-bold">{deadlineLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* Light content */}
      <div className="bg-gray-50 px-4 pt-4 pb-28">

        {/* Progress + points row */}
        {quizPrompts.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-gray-400 text-xs">{answeredCount} of {quizPrompts.length} answered</span>
              {totalPoints > 0 && (
                <div className="flex items-center gap-1">
                  <Star size={11} className="text-amber-400 fill-amber-400" />
                  <span className="text-amber-600 text-xs font-bold">{totalPoints} pts earned</span>
                </div>
              )}
            </div>
            <ProgressBar answered={answeredCount} total={quizPrompts.length} accent={accent} />
          </div>
        )}

        {/* Members strip */}
        {members.length > 0 && (
          <div className="bg-white rounded-2xl px-3 py-2.5 flex items-center justify-between mb-4 shadow-sm" style={{ border: "0.5px solid #e5e7eb" }}>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {members.slice(0, 5).map((m: any) => {
                  const nm = m.display_name || m.username || "?";
                  return (
                    <div key={m.user_id} className={`w-6 h-6 ${avatarColor(nm)} rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-white`}>
                      {nm[0].toUpperCase()}
                    </div>
                  );
                })}
              </div>
              <span className="text-gray-500 text-xs">{members.length} {members.length === 1 ? "member" : "members"}</span>
            </div>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-600 bg-purple-50"
            >
              <Share2 size={11} />
              Challenge
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && quizPrompts.length === 0 && (
          <div className="bg-white rounded-2xl py-12 text-center border border-dashed border-gray-200">
            <Brain size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">No questions yet</p>
            <p className="text-gray-300 text-xs mt-1">Check back soon for the next round</p>
          </div>
        )}

        {/* Question carousel */}
        {currentPrompt && (
          <QuestionCard
            prompt={currentPrompt}
            index={cardIndex}
            total={quizPrompts.length}
            localAnswer={localAnswers[currentPrompt.id] || null}
            submitting={submitting === currentPrompt.id}
            onAnswer={(answer) => handleAnswer(currentPrompt.id, answer)}
            onPrev={() => setCardIndex((i) => Math.max(0, i - 1))}
            onNext={() => setCardIndex((i) => Math.min(quizPrompts.length - 1, i + 1))}
          />
        )}

        {/* Dot indicators */}
        {quizPrompts.length > 1 && (
          <div className="flex justify-center gap-1.5 py-4">
            {quizPrompts.map((p: any, i: number) => {
              const isAnswered = !!p.user_answer || !!localAnswers[p.id];
              const isActive = i === cardIndex;
              return (
                <button
                  key={p.id}
                  onClick={() => setCardIndex(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: isActive ? 20 : 8,
                    height: 8,
                    background: isActive ? accent : isAnswered ? accent + "50" : "#d1d5db",
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Share CTA */}
        {quizPrompts.length > 0 && (
          <div className="mt-2">
            <button
              onClick={handleShare}
              className="w-full bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform"
              style={{ border: "0.5px dashed #c4b5fd" }}
            >
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                <Share2 size={16} className="text-purple-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-gray-900 text-sm font-semibold">Challenge your friends</p>
                <p className="text-gray-400 text-xs mt-0.5">Share this pool and compete on the same round</p>
              </div>
              <ChevronRight size={14} className="text-gray-300 shrink-0" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
