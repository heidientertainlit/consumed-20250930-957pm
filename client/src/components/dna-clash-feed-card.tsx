import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Send, Trash2, MoreHorizontal, ArrowRight, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatFeedName } from "@/lib/feed-name";

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
  const [isVoting, setIsVoting] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [optingOut, setOptingOut] = useState(false);
  const [optedOut, setOptedOut] = useState(false);
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);
  const [showVoters, setShowVoters] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({
    [user1.username]: 0,
    [user2.username]: 0,
  });
  const [voters, setVoters] = useState<Array<{ userId: string; prediction: string; displayName: string; initials: string }>>([]);

  // Fetch banner image via get-media-details (same pattern used throughout the app)
  useEffect(() => {
    if (posterUrl) {
      setBannerUrl(posterUrl);
      return;
    }
    if (!externalId || !externalSource) return;
    const anonKey = SUPABASE_ANON_KEY;
    const authKey = token || anonKey;
    if (!authKey) return;

    const typeParam = mediaType ? `&media_type=${encodeURIComponent(mediaType)}` : '';
    const url = `${SUPABASE_URL}/functions/v1/get-media-details?source=${encodeURIComponent(externalSource)}&external_id=${encodeURIComponent(externalId)}${typeParam}`;

    fetch(url, { headers: { apikey: anonKey, Authorization: `Bearer ${authKey}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const img = data?.artwork || data?.poster_url || data?.image_url || null;
        if (img) setBannerUrl(img);
      })
      .catch(() => {});
  }, [posterUrl, externalId, externalSource, mediaType, token]);

  const clashKey = `clash_notified_${user1.username}_${user2.username}_${mediaTitle}`;
  const isInClash = currentUserId && (currentUserId === user1.userId || currentUserId === user2.userId);

  function mkInitials(name: string) {
    const parts = name.trim().split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

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
       if (myVote === user1.username || myVote === user2.username) {
         setVoted(myVote);
       } else {
         setVoted(null);
       }

      // Fetch display names for voter breakdown
      const voterIds = [...new Set(data.map((r: any) => r.user_id as string))];
      if (voterIds.length > 0) {
        const { data: usersData } = await supabase
          .from('public_user_profiles')
          .select('id, display_name, user_name, first_name, last_name')
          .in('id', voterIds);
        const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]));
        setVoters(data.map((row: any) => {
          const u = usersMap.get(row.user_id);
          const name = formatFeedName(
            u?.display_name,
            u?.user_name,
            u?.first_name,
            u?.last_name,
          );
          return { userId: row.user_id, prediction: row.prediction, displayName: name, initials: mkInitials(name) };
        }));
      }
    }
    loadVotes();
  }, [poolId, currentUserId, user1.username, user2.username]);

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
    queryKey: ['/api/clash-comments', poolId, activeSession?.user?.id ?? null],
    queryFn: async () => {
      if (!activeSession?.access_token || !poolId) return { comments: [] };
      const res = await fetch(`${SUPABASE_URL}/functions/v1/prediction-comments?pool_id=${poolId}&include=meta`, {
        headers: { 'Authorization': `Bearer ${activeSession.access_token}` },
      });
      if (!res.ok) return { comments: [] };
      return res.json();
    },
    enabled: !!poolId && !!activeSession?.access_token,
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
    if (isVoting || voted === username) return;

    const session = activeSession || (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) {
      toast({
        title: 'Sign in to pick a side',
        description: 'Create an account or sign in to cast your vote.',
      });
      return;
    }

    if (!poolId) {
      toast({
        title: 'This clash is unavailable',
        description: 'Refresh the feed and try again.',
        variant: 'destructive',
      });
      return;
    }

    const previousVote = voted;
    setIsVoting(true);
    setVoted(username);
    setLiveCounts(prev => ({
      ...prev,
      ...(previousVote && previousVote !== username
        ? { [previousVote]: Math.max(0, (prev[previousVote] || 1) - 1) }
        : {}),
      [username]: (prev[username] || 0) + 1,
    }));

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/predictions/predict`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pool_id: poolId, prediction: username }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to cast vote');
      }

      const votedFor = username === user1.username ? user1 : user2;
      const votedAgainst = username === user1.username ? user2 : user1;
      await Promise.all([
        sendNotification(votedFor.userId, `Someone agreed with your take on "${mediaTitle}" in a DNA Clash!`, currentUserId, session),
        sendNotification(votedAgainst.userId, `Someone sided with ${votedFor.displayName} on "${mediaTitle}" in a DNA Clash.`, currentUserId, session),
      ]);
    } catch (error) {
      console.error('[clash vote error]', error);
      setVoted(previousVote);
      setLiveCounts(prev => ({
        ...prev,
        [username]: Math.max(0, (prev[username] || 1) - 1),
        ...(previousVote && previousVote !== username
          ? { [previousVote]: (prev[previousVote] || 0) + 1 }
          : {}),
      }));
      toast({
        title: 'Failed to cast vote',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsVoting(false);
    }
  };

  const handleOptOut = async () => {
    if (!currentUserId) return;
    setOptingOut(true);
    try {
      const { error } = await supabase.rpc('set_my_clash_opt_out', { p_opt_out: true });
      if (error) throw error;
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
  const name1 = formatFeedName(user1.displayName, user1.username);
  const name2 = formatFeedName(user2.displayName, user2.username);
  const mediaTypeLabel = ({
    book: 'Book',
    movie: 'Movie',
    tv: 'TV Show',
    music: 'Music',
    podcast: 'Podcast',
    game: 'Game',
    youtube: 'YouTube',
  } as Record<string, string>)[String(mediaType || '').toLowerCase()] || 'Media';
  return (
    <article className="relative mb-4 overflow-hidden rounded-[24px] border border-[#e8e1eb] bg-white shadow-[0_10px_30px_rgba(43,23,53,.06)]">
      <div className="relative px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e5d4f1] bg-[#f3eafa] px-3 py-1.5 text-[#7426ae]">
            <Zap size={13} aria-hidden="true" fill="currentColor" />
            <span className="text-[11px] font-extrabold uppercase tracking-[.12em]">DNA Clash</span>
          </div>
          <div className="relative">
            <button
              type="button"
              aria-label="Clash options"
              aria-expanded={showMenu}
              onClick={() => setShowMenu(value => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#4a3155] hover:bg-[#f6f1f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7c2db5]"
            >
              <MoreHorizontal size={21} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-11 z-20 min-w-40 rounded-xl border border-[#e8e1eb] bg-white p-1.5 shadow-lg">
                {isInClash && !showOptOutConfirm && (
                  <button
                    type="button"
                    onClick={() => { setShowOptOutConfirm(true); setShowMenu(false); }}
                    className="min-h-10 w-full rounded-lg px-3 text-left text-[13px] font-medium text-[#493850] hover:bg-[#f7f2f9]"
                  >
                    Opt out of clashes
                  </button>
                )}
                {!isInClash && <p className="px-3 py-2 text-[12px] text-[#776b7d]">Clash options</p>}
              </div>
            )}
          </div>
        </div>

        <h2 className="font-serif text-center text-[27px] font-medium leading-[1.08] tracking-[-.035em] text-[#281632] sm:text-[32px]">
          Same {mediaTypeLabel}. Different Takes.
        </h2>
        <p className="mb-5 mt-1 text-center text-[14px] text-[#827589] sm:text-[16px]">Whose side are you on?</p>

        <div className="mx-auto grid max-w-[520px] grid-cols-[minmax(0,1fr)_82px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_112px_minmax(0,1fr)] sm:gap-4">
          <div className="flex min-w-0 flex-col items-center text-center">
            <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#a765dc] text-[19px] font-bold text-white sm:h-[68px] sm:w-[68px]">
              {mkInitials(name1)}
              {user1.avatar && <img src={user1.avatar} alt="" className="absolute inset-0 h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
            </div>
            <span className="mt-2 max-w-full truncate text-[14px] font-bold leading-tight text-[#2b1835] sm:text-[17px]">{name1}</span>
            <span className="mt-1 font-serif text-[26px] leading-none tracking-[-.04em] text-[#7924b8] sm:text-[31px]">
              {Number(user1.rating).toFixed(1)} <Star className="inline-block align-[-2px]" size={19} fill="currentColor" aria-hidden="true" />
            </span>
          </div>

          <div className="flex h-full items-center justify-center border-x border-[#e7e0e9] px-0 sm:px-2">
            {bannerUrl ? (
              <img
                src={bannerUrl}
                alt={`${mediaTitle} poster`}
                className="h-[112px] w-[76px] rounded-[9px] object-cover shadow-[0_5px_12px_rgba(39,22,48,.18)] sm:h-[148px] sm:w-[100px]"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="flex h-[112px] w-[76px] items-end rounded-[9px] bg-gradient-to-b from-[#705943] via-[#272a22] to-[#101312] p-2 text-center shadow-[0_5px_12px_rgba(39,22,48,.18)] sm:h-[148px] sm:w-[100px]">
                <span className="font-serif text-[10px] leading-tight text-[#f4e8c8] sm:text-[12px]">{mediaTitle}</span>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col items-center text-center">
            <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#a765dc] text-[19px] font-bold text-white sm:h-[68px] sm:w-[68px]">
              {mkInitials(name2)}
              {user2.avatar && <img src={user2.avatar} alt="" className="absolute inset-0 h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
            </div>
            <span className="mt-2 max-w-full truncate text-[14px] font-bold leading-tight text-[#2b1835] sm:text-[17px]">{name2}</span>
            <span className="mt-1 font-serif text-[26px] leading-none tracking-[-.04em] text-[#7924b8] sm:text-[31px]">
              {Number(user2.rating).toFixed(1)} <Star className="inline-block align-[-2px]" size={19} fill="currentColor" aria-hidden="true" />
            </span>
          </div>
        </div>
        <p className="mx-auto mt-4 max-w-[44rem] text-center text-[15px] font-medium leading-snug text-[#30203b] sm:text-[18px]">
          {mediaTitle}
        </p>
      </div>

      {/* Opt-out confirm */}
      {showOptOutConfirm && (
        <div className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-xl border border-[#e8e1eb] bg-[#faf7fb] px-3 py-2.5">
          <span className="text-[11px] leading-snug text-[#65596b]">Remove yourself from DNA Clash cards?</span>
          <div className="flex gap-2 shrink-0">
            <button onClick={handleOptOut} disabled={optingOut}
              className="min-h-9 rounded-lg bg-[#7526b2] px-3 text-[11px] font-semibold text-white">
              {optingOut ? 'Removing…' : 'Yes, remove me'}
            </button>
            <button onClick={() => setShowOptOutConfirm(false)}
              className="min-h-9 rounded-lg bg-[#eee8f1] px-3 text-[11px] font-semibold text-[#61546a]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {(user1.quote || user2.quote || user1.tags?.length || user2.tags?.length) && (
        <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:px-6">
          {[{ user: user1, name: name1 }, { user: user2, name: name2 }].map(({ user, name }) => (
            <div key={user.username} className="min-w-0 rounded-xl border border-[#eee6f1] bg-[#fbf9fc] p-2.5">
              {user.quote && <p className="text-[12px] leading-snug text-[#4b3d53]">“{user.quote}”</p>}
              {user.tags && user.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {user.tags.map(tag => <span key={tag} className="rounded-full bg-[#f0e5f7] px-2 py-0.5 text-[10px] font-semibold text-[#7025a9]">{tag}</span>)}
                </div>
              )}
              {!user.quote && !user.tags?.length && <p className="text-[11px] text-[#776b7d]">{name}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="mx-4 border-t border-[#eee8f0] pb-0 pt-3 sm:mx-6">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[.14em] text-[#817487]">Pick a side</p>
        <div data-testid="clash-vote-controls" className="grid grid-cols-2 gap-2.5">
          {[{ user: user1, name: name1 }, { user: user2, name: name2 }].map(({ user, name }) => {
            const selected = voted === user.username;
            return (
              <button
                key={user.username}
                type="button"
                onClick={() => handleVote(user.username)}
                disabled={isVoting}
                aria-pressed={selected}
                className={`min-h-[58px] rounded-[22px] border px-2 text-center text-[13px] font-bold leading-tight text-[#4a285b] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7628b3] sm:min-h-[68px] sm:text-[15px] ${selected ? 'border-[#c8acdf] bg-[#f7f0fb]' : 'border-[#e8e1eb] bg-white hover:bg-[#fbf7fd]'}`}
              >
                {selected ? `You’re with ${name.split(' ')[0]}` : `I’m with ${name.split(' ')[0]}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Footer action bar ── */}
      <div className="flex items-center justify-between gap-2 px-4 pb-1 sm:px-6">
        <button
          type="button"
          aria-label={`${total} total ${total === 1 ? 'vote' : 'votes'}`}
          className="min-h-11 shrink-0 text-left text-[14px] font-medium text-[#766b7e] active:opacity-70"
          onClick={() => setShowVoters(s => !s)}
        >
          {total} total {total === 1 ? 'vote' : 'votes'}
        </button>
        <button
          type="button"
          aria-expanded={showVoters}
          onClick={() => setShowVoters(s => !s)}
          className="flex min-h-11 items-center gap-1 whitespace-nowrap text-[14px] font-semibold text-[#7426ae] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7628b3] sm:gap-2 sm:text-[16px]"
        >
          {showVoters ? 'Hide results' : 'View results'} <ArrowRight size={18} />
        </button>
      </div>

      {/* ── Voter breakdown ── */}
      {showVoters && (
        <div className="border-t border-[#eee8f0] px-4 pb-4 pt-3 sm:px-6">
          {total > 0 ? (
            <div className="mb-4 grid grid-cols-2 gap-2 text-[11px] font-semibold leading-snug">
              <p className="text-[#7426ae]">{pct1}% sided with {name1}</p>
              <p className="text-right text-[#7426ae]">{pct2}% sided with {name2}</p>
            </div>
          ) : (
            <p className="mb-4 text-center text-[13px] text-[#817487]">No votes yet. Be the first to pick a side.</p>
          )}
          <div className="flex gap-4">
            {[
              { user: user1, color: '#7924b8' },
              { user: user2, color: '#7924b8' },
            ].map(({ user, color }) => {
              const sideVoters = voters.filter(v => v.prediction === user.username);
              return (
                <div key={user.username} className="flex-1">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{formatFeedName(user.displayName, user.username)}</p>
                  {sideVoters.length === 0 ? (
                    <p className="text-gray-400 text-[10px]">No votes yet</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {sideVoters.map(v => (
                        <div key={v.userId} className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-white text-[8px] font-bold"
                            style={{ background: color }}>
                            {v.initials.slice(0, 1)}
                          </div>
                            <span className="truncate text-[11px] text-[#574b5e]">{formatFeedName(v.displayName)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Comments ── */}
        <section aria-label="Clash comments" className="flex flex-col gap-3 border-t border-[#eee8f0] px-4 pb-4 pt-3 sm:px-6">
          {activeSession?.access_token ? (
            <div data-testid="clash-comment-field" className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#e5e5eb] bg-transparent pl-3 pr-1">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (commentText.trim() && !commentMutation.isPending) commentMutation.mutate(commentText.trim());
                  }
                }}
                placeholder="Add a comment…"
                aria-label="Write a comment"
                className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-[13px] font-normal text-[#362c3c] shadow-none outline-none placeholder:text-[#9a9ba3] focus-visible:ring-0"
              />
              <button onClick={() => commentMutation.mutate(commentText.trim())}
                disabled={!commentText.trim() || commentMutation.isPending}
                aria-label="Post comment"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#9d88b2] transition-colors hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-60">
                <Send size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <p className="text-center text-[11px] text-[#817487]">Sign in to join the debate</p>
          )}
          {activeSession?.access_token && (commentsData?.comments || []).length > 0 && (
            <div className="flex flex-col gap-3">
              {commentsData.comments.map((c: any) => (
                <div key={c.id} className="group flex items-start gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#a765dc] text-[10px] font-bold text-white">
                    {formatFeedName(undefined, c.username).slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="mr-1.5 text-[11px] font-semibold text-[#7426ae]">{formatFeedName(undefined, c.username)}</span>
                    <span className="break-words text-[13px] leading-snug text-[#362c3c]">{c.content}</span>
                  </div>
                  {c.user_id === activeSession?.user?.id && (
                    <button onClick={() => deleteCommentMutation.mutate(String(c.id))}
                      aria-label="Delete comment"
                      className="shrink-0 p-2 text-[#9b8fa1] transition-all hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

    </article>
  );
}
