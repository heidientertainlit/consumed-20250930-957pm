import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Check, MessageCircle, Send, Trash2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

export interface ClashUser {
  displayName: string;
  username: string;
  userId: string;
  dnaLabel: string;
  rating: number;
  initials: string;
  color: string;
  votes: number;
  avatar?: string | null;
}

interface DnaClashFeedCardProps {
  user1: ClashUser;
  user2: ClashUser;
  mediaTitle: string;
  mediaType?: string;
  externalId?: string;
  externalSource?: string;
  currentUserId?: string;
  session?: any;
  onOptOut?: () => void;
  poolId?: string;
}

// ─── Avatar card matching the screenshot design ───────────────────────────────
function UserCard({
  user,
  isMyVote,
  onVote,
  hasVoted,
  side,
}: {
  user: ClashUser;
  isMyVote: boolean;
  onVote: () => void;
  hasVoted: boolean;
  side: 'left' | 'right';
}) {
  const accentColor = side === 'left' ? '#a855f7' : '#6366f1';
  return (
    <button
      onClick={onVote}
      disabled={hasVoted}
      className="flex-1 flex flex-col gap-2.5 p-3 rounded-xl text-left transition-all active:scale-[0.97]"
      style={{
        background: isMyVote ? 'rgba(139,92,246,0.08)' : '#f9f9fb',
        border: `1.5px solid ${isMyVote ? 'rgba(139,92,246,0.30)' : '#ebebf0'}`,
      }}
    >
      {/* Name row */}
      <div className="flex items-center gap-1.5">
        <span className="text-gray-900 font-bold text-[14px] leading-tight truncate">
          {user.displayName.split(' ')[0]}
        </span>
        {isMyVote && <Check size={11} className="text-purple-500 shrink-0 ml-auto" />}
      </div>

      {/* Stars */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <span key={s} style={{ fontSize: 13, lineHeight: 1, color: s <= user.rating ? accentColor : '#e2e2e8' }}>
            {s <= user.rating ? '★' : '★'}
          </span>
        ))}
      </div>

      {/* DNA label pill */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full self-start bg-white border border-gray-200">
        <Sparkles size={9} className="text-purple-400 shrink-0" />
        <span className="text-gray-500 text-[10px] font-medium leading-none">{user.dnaLabel}</span>
      </div>
    </button>
  );
}

// ─── Animated waveform between the two cards ──────────────────────────────────
function Waveform() {
  return (
    <svg width="72" height="52" viewBox="0 0 72 52" fill="none" className="shrink-0">
      <defs>
        <filter id="clash-glow2">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="clash-wave2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <path
        d="M0,26 L6,26 L9,8 L12,44 L15,12 L18,40 L22,26 L26,4 L29,48 L32,14 L36,26 L39,6 L42,46 L45,16 L50,26 L54,10 L57,42 L60,18 L64,30 L68,26 L72,26"
        stroke="url(#clash-wave2)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#clash-glow2)"
      />
    </svg>
  );
}

async function sendNotification(userId: string, message: string, triggeredBy: string | undefined, session: any) {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'dna_clash',
      message,
      triggered_by_user_id: triggeredBy || null,
      read: false,
    });
  } catch (e) {
    console.error('[clash notify error]', e);
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DnaClashFeedCard({
  user1,
  user2,
  mediaTitle,
  currentUserId,
  session: sessionProp,
  onOptOut,
  poolId,
}: DnaClashFeedCardProps) {
  const { session: authSession } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const activeSession = sessionProp || authSession;

  const [voted, setVoted] = useState<string | null>(null);
  const [optingOut, setOptingOut] = useState(false);
  const [optedOut, setOptedOut] = useState(false);
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({
    [user1.username]: 0,
    [user2.username]: 0,
  });

  const clashKey = `clash_notified_${user1.username}_${user2.username}_${mediaTitle}`;
  const isInClash = currentUserId && (currentUserId === user1.userId || currentUserId === user2.userId);

  // Load live vote counts + check if current user already voted
  useEffect(() => {
    if (!poolId) return;
    async function loadVotes() {
      const { data } = await supabase
        .from('user_predictions')
        .select('prediction, user_id')
        .eq('pool_id', poolId);
      if (!data) return;
      const counts: Record<string, number> = {};
      let myVote: string | null = null;
      data.forEach((row: any) => {
        counts[row.prediction] = (counts[row.prediction] || 0) + 1;
        if (currentUserId && row.user_id === currentUserId) myVote = row.prediction;
      });
      setLiveCounts(prev => ({ ...prev, ...counts }));
      if (myVote) setVoted(myVote);
    }
    loadVotes();
  }, [poolId, currentUserId]);

  // "You're featured" notification — once per session
  useEffect(() => {
    if (!isInClash || !currentUserId || !activeSession) return;
    if (sessionStorage.getItem(clashKey)) return;
    sessionStorage.setItem(clashKey, '1');
    sendNotification(
      currentUserId,
      `You're featured in a DNA Clash on "${mediaTitle}" — people are voting now!`,
      undefined,
      activeSession
    );
  }, [isInClash, currentUserId]);

  // ── Comments ────────────────────────────────────────────────────────────────
  const { data: commentsData } = useQuery({
    queryKey: ['/api/clash-comments', poolId],
    queryFn: async () => {
      if (!activeSession?.access_token || !poolId) return { comments: [] };
      const res = await fetch(`${SUPABASE_URL}/functions/v1/prediction-comments?pool_id=${poolId}&include=meta`, {
        headers: { 'Authorization': `Bearer ${activeSession.access_token}` },
      });
      if (!res.ok) return { comments: [] };
      return res.json();
    },
    enabled: showComments && !!poolId && !!activeSession?.access_token,
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!activeSession?.access_token || !poolId) return;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/prediction-comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pool_id: poolId, content }),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      return res.json();
    },
    onSuccess: () => {
      setCommentText('');
      qc.invalidateQueries({ queryKey: ['/api/clash-comments', poolId] });
    },
    onError: () => toast({ title: 'Failed to post comment', variant: 'destructive' }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!activeSession?.access_token) return;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/prediction-comments?comment_id=${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${activeSession.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to delete comment');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/clash-comments', poolId] }),
  });

  const handlePostComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed || commentMutation.isPending) return;
    commentMutation.mutate(trimmed);
  };

  // ── Voting ──────────────────────────────────────────────────────────────────
  const handleVote = async (username: string) => {
    if (voted || !activeSession) return;
    setVoted(username);
    setLiveCounts(prev => ({ ...prev, [username]: (prev[username] || 0) + 1 }));

    if (poolId && activeSession?.access_token) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/predictions/predict`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeSession.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pool_id: poolId, prediction: username }),
        });
        if (!res.ok) {
          setVoted(null);
          setLiveCounts(prev => ({ ...prev, [username]: Math.max(0, (prev[username] || 1) - 1) }));
          return;
        }
      } catch {
        setVoted(null);
        setLiveCounts(prev => ({ ...prev, [username]: Math.max(0, (prev[username] || 1) - 1) }));
        return;
      }
    }

    const votedFor = username === user1.username ? user1 : user2;
    const votedAgainst = username === user1.username ? user2 : user1;
    await Promise.all([
      sendNotification(votedFor.userId, `Someone agreed with your take on "${mediaTitle}" in a DNA Clash!`, currentUserId, activeSession),
      sendNotification(votedAgainst.userId, `Someone sided with ${votedFor.displayName} over you on "${mediaTitle}" in a DNA Clash.`, currentUserId, activeSession),
    ]);
  };

  const handleOptOut = async () => {
    if (!currentUserId) return;
    setOptingOut(true);
    try {
      await supabase.from('users').update({ clash_opt_out: true }).eq('id', currentUserId);
      setOptedOut(true);
      setShowOptOutConfirm(false);
      onOptOut?.();
    } catch (e) {
      console.error('[clash opt-out error]', e);
    } finally {
      setOptingOut(false);
    }
  };

  if (optedOut) return null;

  const v1 = liveCounts[user1.username] || 0;
  const v2 = liveCounts[user2.username] || 0;
  const total = v1 + v2;
  const pct1 = total > 0 ? Math.round((v1 / total) * 100) : 50;
  const pct2 = 100 - pct1;
  const commentCount = commentsData?.comments?.length ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">

      {/* White header row — matches rate card structure */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <Zap size={11} className="text-purple-500 shrink-0" fill="currentColor" />
          <span className="text-[11px] font-bold text-purple-500 uppercase tracking-widest">DNA Clash</span>
        </div>
        <div className="flex items-center gap-2">
          {isInClash && !showOptOutConfirm && (
            <button onClick={() => setShowOptOutConfirm(true)} className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
              Opt out
            </button>
          )}
        </div>
      </div>

      {/* Opt-out confirm — white bg */}
      {showOptOutConfirm && (
        <div className="mx-4 mb-2 flex items-center justify-between rounded-xl px-3 py-2.5 gap-2 bg-gray-50 border border-gray-200">
          <span className="text-gray-600 text-[11px] leading-snug">Remove yourself from DNA Clash cards?</span>
          <div className="flex gap-2 shrink-0">
            <button onClick={handleOptOut} disabled={optingOut}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white bg-purple-500">
              {optingOut ? '…' : 'Yes'}
            </button>
            <button onClick={() => setShowOptOutConfirm(false)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-gray-500 bg-gray-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-3 flex flex-col gap-3">

        {/* Headline */}
        <div>
          <p className="text-gray-900 font-extrabold text-[17px] leading-tight">Completely different takes.</p>
          <p className="text-gray-400 text-[13px] font-medium mt-0.5">on {mediaTitle}</p>
        </div>

        {/* Two user cards + waveform */}
        <div className="flex items-center gap-1">
          <UserCard user={user1} isMyVote={voted === user1.username} onVote={() => handleVote(user1.username)} hasVoted={!!voted} side="left" />
          <Waveform />
          <UserCard user={user2} isMyVote={voted === user2.username} onVote={() => handleVote(user2.username)} hasVoted={!!voted} side="right" />
        </div>

        {/* Which side CTA — pre-vote */}
        {!voted && (
          <p className="text-gray-400 text-[10px] font-semibold text-center uppercase tracking-widest -mt-1">
            Tap a card — which side are you on?
          </p>
        )}

        {/* Vote bars — post-vote */}
        {voted && (
          <div className="flex flex-col gap-1.5">
            {[{ u: user1, pct: pct1 }, { u: user2, pct: pct2 }].map(({ u, pct }) => {
              const isMine = voted === u.username;
              const barColor = isMine ? '#a855f7' : '#6366f1';
              return (
                <div key={u.username} className="flex items-center gap-2">
                  {isMine && <Check size={9} className="text-purple-500 shrink-0" />}
                  <span className={`text-[11px] font-semibold w-[70px] truncate shrink-0 ${isMine ? 'text-purple-600' : 'text-gray-400'}`}
                    style={!isMine ? { marginLeft: 13 } : {}}>
                    {u.displayName.split(' ')[0]}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
                    <div className="h-full rounded-full transition-all duration-600"
                      style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                  <span className={`text-[11px] font-bold w-7 text-right shrink-0 ${isMine ? 'text-purple-600' : 'text-gray-400'}`}>
                    {pct}%
                  </span>
                </div>
              );
            })}
            <p className="text-gray-400 text-[10px] text-center">{total} {total === 1 ? 'vote' : 'votes'}</p>
          </div>
        )}

      </div>

      {/* White action bar — matches rate card */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100">
        <button
          onClick={() => setShowComments(s => !s)}
          className={`flex items-center gap-1.5 transition-colors ${showComments ? 'text-purple-500' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <MessageCircle size={15} fill={showComments ? 'currentColor' : 'none'} />
          <span className="text-[12px] font-medium">{commentCount > 0 ? commentCount : 'Debate'}</span>
        </button>
      </div>

      {/* Comments section — white bg */}
      {showComments && (
        <div className="flex flex-col gap-3 px-4 pt-3 pb-4 border-t border-gray-100">
          {(commentsData?.comments || []).length === 0 ? (
            <p className="text-gray-400 text-[12px] text-center py-1">No comments yet. Start the debate.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {commentsData.comments.map((c: any) => (
                <div key={c.id} className="flex items-start gap-2 group">
                  <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-bold bg-purple-400">
                    {(c.username || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-purple-600 text-[11px] font-semibold mr-1.5">{c.username}</span>
                    <span className="text-gray-800 text-[13px] break-words leading-snug">{c.content}</span>
                  </div>
                  {c.user_id === (activeSession?.user?.id) && (
                    <button
                      onClick={() => deleteCommentMutation.mutate(String(c.id))}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {activeSession ? (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-gray-50 border border-gray-200">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(); } }}
                placeholder="Add your take…"
                className="flex-1 text-[13px] text-gray-800 bg-transparent outline-none placeholder:text-gray-400"
              />
              <button
                onClick={handlePostComment}
                disabled={!commentText.trim() || commentMutation.isPending}
                className="p-1.5 rounded-lg transition-all disabled:opacity-30 shrink-0 bg-purple-500"
              >
                <Send size={12} className="text-white" />
              </button>
            </div>
          ) : (
            <p className="text-gray-400 text-[11px] text-center">Sign in to join the debate</p>
          )}
        </div>
      )}

    </div>
  );
}
