import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, MessageCircle, Send, Trash2 } from "lucide-react";
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

// ─── Two-colored waveform ─────────────────────────────────────────────────────
function Waveform() {
  return (
    <div className="flex-1 flex items-center justify-center min-w-0">
      <svg width="100%" height="52" viewBox="0 0 80 52" fill="none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wave-left" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
          <linearGradient id="wave-right" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        {/* Left half — purple */}
        <path
          d="M0,26 L5,26 L8,10 L11,42 L14,14 L17,38 L20,26 L23,8 L26,44 L29,18 L32,26 L35,26"
          stroke="url(#wave-left)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
        {/* VS label */}
        <text x="40" y="30" textAnchor="middle" fontSize="9" fontWeight="800" fill="#9ca3af" letterSpacing="0.5">VS</text>
        {/* Right half — pink */}
        <path
          d="M45,26 L48,26 L51,12 L54,40 L57,16 L60,36 L63,26 L66,6 L69,46 L72,20 L75,26 L80,26"
          stroke="url(#wave-right)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ─── User side ────────────────────────────────────────────────────────────────
function UserSide({ user, side }: { user: ClashUser; side: 'left' | 'right' }) {
  const starColor = side === 'left' ? '#a855f7' : '#ec4899';
  const align = side === 'left' ? 'items-start' : 'items-end text-right';
  return (
    <div className={`flex-1 flex flex-col gap-1.5 ${align}`}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm shrink-0"
        style={{ background: side === 'left' ? '#a855f7' : '#ec4899' }}>
        {user.avatar
          ? <img src={user.avatar} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          : user.initials || user.displayName[0]?.toUpperCase()}
      </div>
      {/* Name */}
      <span className="text-gray-900 font-bold text-[14px] leading-tight">
        {user.displayName.split(' ')[0]}
      </span>
      {/* Stars */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <span key={s} style={{ fontSize: 13, color: s <= user.rating ? starColor : '#e2e2e8' }}>★</span>
        ))}
      </div>
      {/* DNA label */}
      <span className="text-gray-400 text-[10px] font-medium">{user.dnaLabel}</span>
    </div>
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
        headers: { 'Authorization': `Bearer ${activeSession.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool_id: poolId, content }),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      return res.json();
    },
    onSuccess: () => { setCommentText(''); qc.invalidateQueries({ queryKey: ['/api/clash-comments', poolId] }); },
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

  const handleVote = async (username: string) => {
    if (voted || !activeSession) return;
    setVoted(username);
    setLiveCounts(prev => ({ ...prev, [username]: (prev[username] || 0) + 1 }));
    if (poolId && activeSession?.access_token) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/predictions/predict`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${activeSession.access_token}`, 'Content-Type': 'application/json' },
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
  const winnerName = pct1 >= pct2 ? user1.displayName.split(' ')[0] : user2.displayName.split(' ')[0];

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <Zap size={11} className="text-purple-500 shrink-0" fill="currentColor" />
          <span className="text-[11px] font-bold text-purple-500 uppercase tracking-widest">DNA Clash</span>
        </div>
        {isInClash && !showOptOutConfirm && (
          <button onClick={() => setShowOptOutConfirm(true)} className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
            Opt out
          </button>
        )}
      </div>

      {/* Opt-out confirm */}
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

      {/* Headline */}
      <div className="px-4 pb-3">
        <p className="text-gray-900 font-extrabold text-[18px] leading-tight">Completely different takes.</p>
        <p className="text-gray-400 text-[13px] font-medium mt-0.5">on {mediaTitle}</p>
      </div>

      {/* Two sides + waveform */}
      <div className="flex items-start gap-0 px-4 pb-4">
        <UserSide user={user1} side="left" />
        <Waveform />
        <UserSide user={user2} side="right" />
      </div>

      {/* Vote buttons */}
      {!voted ? (
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={() => handleVote(user1.username)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all active:scale-[0.97]"
            style={{ background: '#a855f7' }}
          >
            I'm with {user1.displayName.split(' ')[0]}
          </button>
          <button
            onClick={() => handleVote(user2.username)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all active:scale-[0.97]"
            style={{ background: '#ec4899' }}
          >
            I'm with {user2.displayName.split(' ')[0]}
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4 flex flex-col gap-2">
          {/* Result bars */}
          {[{ u: user1, pct: pct1, color: '#a855f7' }, { u: user2, pct: pct2, color: '#ec4899' }].map(({ u, pct, color }) => (
            <div key={u.username} className="flex items-center gap-2">
              <span className="text-[11px] font-semibold w-16 truncate shrink-0 text-gray-600">{u.displayName.split(' ')[0]}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden bg-gray-100">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="text-[11px] font-bold w-7 text-right shrink-0 text-gray-700">{pct}%</span>
            </div>
          ))}
          <p className="text-gray-400 text-[10px] text-center mt-0.5">{total} {total === 1 ? 'vote' : 'votes'}</p>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
        <button
          onClick={() => setShowComments(s => !s)}
          className={`flex items-center gap-1.5 transition-colors ${showComments ? 'text-purple-500' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <MessageCircle size={15} fill={showComments ? 'currentColor' : 'none'} />
          <span className="text-[12px] font-medium">{commentCount > 0 ? commentCount : 'Debate'}</span>
        </button>
        {voted && total > 0 && (
          <span className="text-[11px] font-semibold text-purple-500">
            {pct1 >= pct2 ? pct1 : pct2}% sided with {winnerName}
          </span>
        )}
      </div>

      {/* Comments */}
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
                  {c.user_id === activeSession?.user?.id && (
                    <button onClick={() => deleteCommentMutation.mutate(String(c.id))}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all shrink-0">
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
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commentMutation.mutate(commentText.trim()); } }}
                placeholder="Add your take…"
                className="flex-1 text-[13px] text-gray-800 bg-transparent outline-none placeholder:text-gray-400"
              />
              <button onClick={() => commentMutation.mutate(commentText.trim())}
                disabled={!commentText.trim() || commentMutation.isPending}
                className="p-1.5 rounded-lg transition-all disabled:opacity-30 shrink-0 bg-purple-500">
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
