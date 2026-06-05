import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, MessageCircle, Send, Trash2, MoreHorizontal, ChevronRight, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
  quote?: string;
  tags?: string[];
}

interface DnaClashFeedCardProps {
  user1: ClashUser;
  user2: ClashUser;
  mediaTitle: string;
  mediaType?: string;
  externalId?: string;
  externalSource?: string;
  posterUrl?: string;
  currentUserId?: string;
  session?: any;
  onOptOut?: () => void;
  poolId?: string;
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

export default function DnaClashFeedCard({
  user1,
  user2,
  mediaTitle,
  mediaType,
  externalId,
  externalSource,
  posterUrl,
  currentUserId,
  session: sessionProp,
  onOptOut,
  poolId,
}: DnaClashFeedCardProps) {
  const { session: authSession } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const activeSession = sessionProp || authSession;
  const token = activeSession?.access_token;

  const [voted, setVoted] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [optingOut, setOptingOut] = useState(false);
  const [optedOut, setOptedOut] = useState(false);
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({
    [user1.username]: 0,
    [user2.username]: 0,
  });

  // Fetch banner image via the existing media-search edge function (works for all media types)
  useEffect(() => {
    if (posterUrl) { setBannerUrl(posterUrl); return; }
    if (!mediaTitle) return;
    const anonKey = SUPABASE_ANON_KEY || token;
    if (!anonKey) return;

    const typeParam = mediaType ? `&type=${encodeURIComponent(mediaType)}` : '';
    const url = `${SUPABASE_URL}/functions/v1/media-search?q=${encodeURIComponent(mediaTitle)}&limit=1${typeParam}`;

    fetch(url, { headers: { Authorization: `Bearer ${anonKey}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const result = data?.results?.[0];
        if (!result) return;
        const img = result.poster_url || result.image || result.poster_path
          ? result.poster_url || result.image || `https://image.tmdb.org/t/p/w780${result.poster_path}`
          : null;
        if (img) setBannerUrl(img);
      })
      .catch(() => {});
  }, [posterUrl, mediaTitle, mediaType, token]);

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
      sendNotification(votedAgainst.userId, `Someone sided with ${votedFor.displayName} on "${mediaTitle}" in a DNA Clash.`, currentUserId, activeSession),
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
  const name1 = user1.displayName.split(' ')[0];
  const name2 = user2.displayName.split(' ')[0];

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-4">

      {/* ── Banner ── */}
      <div className="relative w-full" style={{ height: 200 }}>
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt={mediaTitle}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900 via-indigo-800 to-blue-900" />
        )}
        {/* Dark gradient overlay so text is readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* DNA CLASH pill — top left */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-white/15 backdrop-blur-sm border border-white/30">
          <Zap size={11} className="text-white shrink-0" fill="currentColor" />
          <span className="text-[11px] font-black text-white uppercase tracking-widest">DNA Clash</span>
        </div>

        {/* Opt-out / menu — top right */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {isInClash && !showOptOutConfirm && (
            <button onClick={() => setShowOptOutConfirm(true)}
              className="text-[10px] text-white/70 hover:text-white transition-colors">
              Opt out
            </button>
          )}
          <button className="w-7 h-7 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <MoreHorizontal size={14} className="text-white" />
          </button>
        </div>

        {/* Media title overlay — bottom of banner */}
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-white font-black text-[17px] leading-tight drop-shadow-lg uppercase tracking-wide line-clamp-2">
            {mediaTitle}
          </p>
        </div>
      </div>

      {/* Opt-out confirm */}
      {showOptOutConfirm && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 gap-2 bg-gray-50 border border-gray-200">
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

      {/* ── Body ── */}
      <div className="px-4 pt-4 pb-2">

        {/* Headline */}
        <p className="text-gray-900 font-black text-[20px] leading-tight text-center">Completely different takes.</p>
        <p className="text-gray-400 text-[13px] text-center mt-1 mb-4">Whose take do you agree with?</p>

        {/* Users row */}
        <div className="flex items-start justify-between gap-2 mb-4">
          {/* User 1 */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <div className="relative">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-purple-200 flex items-center justify-center text-white font-black text-lg"
                style={{ background: '#a855f7' }}>
                {user1.avatar
                  ? <img src={user1.avatar} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : user1.initials || name1[0]}
              </div>
              {/* Verified dot */}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center">
                <span className="text-white text-[8px] font-black">✓</span>
              </div>
            </div>
            <span className="font-bold text-gray-900 text-[14px] leading-tight">{name1}</span>
            <span className="text-purple-500 text-[11px] font-semibold leading-tight text-center">{user1.dnaLabel}</span>
            {/* Stars + rating */}
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(s => (
                <span key={s} style={{ fontSize: 11, color: s <= user1.rating ? '#a855f7' : '#e5e7eb' }}>★</span>
              ))}
            </div>
          </div>

          {/* VS */}
          <div className="flex items-center justify-center pt-5">
            <div className="rounded-full bg-gray-100 px-3 py-1">
              <span className="text-[12px] font-black text-gray-400 tracking-wide">VS</span>
            </div>
          </div>

          {/* User 2 */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <div className="relative">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-pink-200 flex items-center justify-center text-white font-black text-lg"
                style={{ background: '#ec4899' }}>
                {user2.avatar
                  ? <img src={user2.avatar} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : user2.initials || name2[0]}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-pink-500 border-2 border-white flex items-center justify-center">
                <span className="text-white text-[8px] font-black">✓</span>
              </div>
            </div>
            <span className="font-bold text-gray-900 text-[14px] leading-tight">{name2}</span>
            <span className="text-pink-500 text-[11px] font-semibold leading-tight text-center">{user2.dnaLabel}</span>
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(s => (
                <span key={s} style={{ fontSize: 11, color: s <= user2.rating ? '#ec4899' : '#e5e7eb' }}>★</span>
              ))}
            </div>
          </div>
        </div>

        {/* Quote blocks */}
        {(user1.quote || user2.quote) && (
          <div className="flex gap-2 mb-3">
            {/* Quote 1 */}
            <div className="flex-1 rounded-2xl px-3 pt-2 pb-3" style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.15)' }}>
              <span className="text-purple-400 font-black text-[28px] leading-none block" style={{ fontFamily: 'Georgia, serif', lineHeight: '0.6' }}>"</span>
              <p className="text-gray-800 text-[12px] leading-snug font-medium mt-1.5">
                {user1.quote || `${name1} gave this ${user1.rating} stars.`}
              </p>
              {user1.tags && user1.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {user1.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-semibold text-purple-600 bg-purple-100 rounded-full px-2 py-0.5">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Quote 2 */}
            <div className="flex-1 rounded-2xl px-3 pt-2 pb-3" style={{ background: 'rgba(236,72,153,0.07)', border: '1px solid rgba(236,72,153,0.15)' }}>
              <span className="text-pink-400 font-black text-[28px] leading-none block" style={{ fontFamily: 'Georgia, serif', lineHeight: '0.6' }}>"</span>
              <p className="text-gray-800 text-[12px] leading-snug font-medium mt-1.5">
                {user2.quote || `${name2} gave this ${user2.rating} stars.`}
              </p>
              {user2.tags && user2.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {user2.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-semibold text-pink-600 bg-pink-100 rounded-full px-2 py-0.5">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Vote section ── */}
        {!voted ? (
          /* Pre-vote: big percentage split + Vote now CTA */
          <div className="mt-1 mb-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[28px] font-black text-purple-500">{pct1}%</span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-gray-100">
                <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-500"
                  style={{ width: `${pct1}%` }} />
              </div>
              <span className="text-[28px] font-black text-pink-500">{pct2}%</span>
            </div>
            {total > 0 && <p className="text-gray-400 text-[11px] text-center">{total} {total === 1 ? 'vote' : 'votes'}</p>}
          </div>
        ) : (
          /* Post-vote: result bars */
          <div className="flex flex-col gap-1.5 mb-2">
            {[{ u: user1, pct: pct1, color: '#a855f7', voted: voted === user1.username }, { u: user2, pct: pct2, color: '#ec4899', voted: voted === user2.username }].map(({ u, pct, color, voted: isVoted }) => (
              <div key={u.username} className="flex items-center gap-2">
                <span className="text-[11px] font-semibold w-14 truncate shrink-0 text-gray-600">{u.displayName.split(' ')[0]}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden bg-gray-100">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="text-[12px] font-bold w-8 text-right shrink-0" style={{ color: isVoted ? color : '#6b7280' }}>{pct}%</span>
              </div>
            ))}
            <p className="text-gray-400 text-[10px] text-center mt-0.5">{total} {total === 1 ? 'vote' : 'votes'}</p>
          </div>
        )}
      </div>

      {/* ── Footer action bar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
        {/* Left: stacked avatars + vote count */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {[user1, user2].map((u, i) => (
              <div key={u.username} className="w-6 h-6 rounded-full border-2 border-white overflow-hidden flex items-center justify-center text-white text-[9px] font-bold"
                style={{ background: i === 0 ? '#a855f7' : '#ec4899', zIndex: i === 0 ? 2 : 1 }}>
                {u.avatar
                  ? <img src={u.avatar} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : u.initials?.slice(0, 1) || u.displayName[0]}
              </div>
            ))}
          </div>
          {total > 0 && (
            <span className="text-gray-500 text-[12px] font-medium">{total} total {total === 1 ? 'vote' : 'votes'}</span>
          )}
        </div>

        {/* Center: comments */}
        <button
          onClick={() => setShowComments(s => !s)}
          className={`flex items-center gap-1.5 transition-colors ${showComments ? 'text-purple-500' : 'text-gray-400'}`}
        >
          <MessageCircle size={16} fill={showComments ? 'currentColor' : 'none'} />
          {commentCount > 0 && <span className="text-[12px] font-medium">{commentCount}</span>}
        </button>

        {/* Right: vote CTA or winner result */}
        {!voted ? (
          <button
            onClick={() => handleVote(pct1 >= pct2 ? user1.username : user2.username)}
            className="flex items-center gap-1 text-purple-600 font-bold text-[13px] active:opacity-70 transition-opacity"
          >
            Vote now <ChevronRight size={15} />
          </button>
        ) : (
          <span className="text-[12px] font-semibold text-purple-500">
            {pct1 >= pct2 ? pct1 : pct2}% with {winnerName}
          </span>
        )}
      </div>

      {/* ── Comments ── */}
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
