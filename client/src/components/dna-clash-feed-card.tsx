import { useState, useEffect } from "react";
import { Zap, Check, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

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

function Avatar({ user }: { user: ClashUser }) {
  const firstName = user.displayName.split(" ")[0];
  return (
    <div
      className="shrink-0 flex flex-col items-center justify-center font-bold text-white text-center gap-1"
      style={{
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 12,
        paddingBottom: 12,
        borderRadius: 16,
        background: user.color,
        minWidth: 90,
        boxShadow: `0 0 0 2px rgba(255,255,255,0.15)`,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1.1, fontWeight: 800 }}>{firstName}</span>
      <span style={{ fontSize: 13, letterSpacing: 1.5, lineHeight: 1, opacity: 0.95 }}>
        {"★".repeat(user.rating)}{"☆".repeat(5 - user.rating)}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85, lineHeight: 1.2, textAlign: 'center' }}>
        {user.dnaLabel}
      </span>
    </div>
  );
}

function Waveform() {
  return (
    <svg width="90" height="48" viewBox="0 0 90 48" fill="none" className="shrink-0">
      <defs>
        <filter id="clash-glow">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="clash-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <path
        d="M0,24 L8,24 L11,6 L14,42 L17,10 L20,38 L25,24 L30,2 L33,46 L36,12 L40,24 L43,4 L46,44 L49,14 L54,24 L58,8 L61,40 L64,16 L69,28 L73,24 L82,24 L90,24"
        stroke="url(#clash-wave)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#clash-glow)"
      />
    </svg>
  );
}

async function sendNotification(
  userId: string,
  message: string,
  triggeredBy: string | undefined,
  session: any
) {
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
  currentUserId,
  session,
  onOptOut,
  poolId,
}: DnaClashFeedCardProps) {
  const [voted, setVoted] = useState<string | null>(null);
  const [optingOut, setOptingOut] = useState(false);
  const [optedOut, setOptedOut] = useState(false);
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({
    [user1.username]: user1.votes,
    [user2.username]: user2.votes,
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

  // Send "you're featured" notification once per clash per session
  useEffect(() => {
    if (!isInClash || !currentUserId || !session) return;
    if (sessionStorage.getItem(clashKey)) return;
    sessionStorage.setItem(clashKey, '1');
    sendNotification(
      currentUserId,
      `You're featured in a DNA Clash on "${mediaTitle}" — people are voting now!`,
      undefined,
      session
    );
  }, [isInClash, currentUserId]);

  const handleVote = async (username: string) => {
    if (voted || !session) return;

    // Optimistic update
    setVoted(username);
    setLiveCounts(prev => ({ ...prev, [username]: (prev[username] || 0) + 1 }));

    // Persist to user_predictions if we have a poolId
    if (poolId && session?.access_token) {
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
          // Rollback optimistic update on failure
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

    // Notify both featured users
    const votedFor = username === user1.username ? user1 : user2;
    const votedAgainst = username === user1.username ? user2 : user1;
    await Promise.all([
      sendNotification(
        votedFor.userId,
        `Someone agreed with your take on "${mediaTitle}" in a DNA Clash!`,
        currentUserId,
        session
      ),
      sendNotification(
        votedAgainst.userId,
        `Someone sided with ${votedFor.displayName} over you on "${mediaTitle}" in a DNA Clash.`,
        currentUserId,
        session
      ),
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

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-4 shadow-lg"
      style={{ background: "linear-gradient(135deg, #1e0a3c 0%, #2d1465 45%, #3b1a78 100%)" }}
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Label row + opt-out button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap size={11} className="text-purple-300 shrink-0" fill="currentColor" />
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">DNA Clash</span>
          </div>
          {isInClash && !showOptOutConfirm && (
            <button
              onClick={() => setShowOptOutConfirm(true)}
              className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
            >
              Opt out
            </button>
          )}
        </div>

        {/* Opt-out confirmation */}
        {showOptOutConfirm && (
          <div className="flex items-center justify-between rounded-xl px-3 py-2.5 gap-2" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <span className="text-white/70 text-[11px] leading-snug">Remove yourself from DNA Clash cards?</span>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleOptOut}
                disabled={optingOut}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white"
                style={{ background: '#a855f7' }}
              >
                {optingOut ? '…' : 'Yes'}
              </button>
              <button
                onClick={() => setShowOptOutConfirm(false)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white/60"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Headline + media title */}
        <div className="-mt-1">
          <p className="text-white font-extrabold text-[18px] leading-tight">Completely different takes.</p>
          <p className="text-white/60 text-[14px] font-semibold mt-0.5">on {mediaTitle}</p>
        </div>

        {/* Avatars + waveform */}
        <div className="flex items-center justify-center gap-0">
          <Avatar user={user1} />
          <Waveform />
          <Avatar user={user2} />
        </div>

        {/* CTA + vote buttons */}
        {!voted ? (
          <div className="flex flex-col gap-2">
            <p className="text-white/50 text-[11px] font-semibold text-center uppercase tracking-widest">Which side are you on?</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleVote(user1.username)}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all border"
                style={{ background: `${user1.color}22`, borderColor: `${user1.color}55`, color: user1.color }}
              >
                {user1.displayName}'s side
              </button>
              <button
                onClick={() => handleVote(user2.username)}
                className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all border"
                style={{ background: `${user2.color}22`, borderColor: `${user2.color}55`, color: user2.color }}
              >
                {user2.displayName}'s side
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {[{ u: user1, pct: pct1, v: v1 }, { u: user2, pct: pct2, v: v2 }].map(({ u, pct }) => (
              <div key={u.username} className="flex items-center gap-2">
                <span className="text-[10px] font-semibold w-[72px] truncate" style={{ color: u.color }}>
                  {voted === u.username && <Check size={9} className="inline mr-0.5" />}
                  {u.displayName}
                </span>
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: u.color }} />
                </div>
                <span className="text-[11px] font-bold w-8 text-right" style={{ color: u.color }}>{pct}%</span>
              </div>
            ))}
            <p className="text-white/35 text-[10px] text-center">{total} votes</p>
          </div>
        )}
      </div>
    </div>
  );
}
