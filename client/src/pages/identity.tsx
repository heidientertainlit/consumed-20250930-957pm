import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Navigation from '@/components/navigation';
import { useLocation } from 'wouter';
import {
  Sparkles, Flame, Star, Brain, Trophy, ChevronRight, RefreshCw,
  Users, Film, Tv, BookOpen, Music, Mic, Gamepad2, ChevronLeft,
  Share2, Edit2, Dna, Zap, Clock, Heart, CheckCircle2, Lock,
  TrendingUp, MessageCircle, UserPlus, Globe, BarChart3
} from 'lucide-react';
import { getGameAlignment } from '@/lib/identity-feedback';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DnaProfile {
  label: string; tagline: string; profile_text: string;
  favorite_genres: string[]; favorite_media_types: string[];
  core_archetype: string | null; secondary_archetypes: string[] | null;
  current_era: string | null; flavor_notes: string[] | null;
  evolution_note: string | null; confidence_score: number | null;
  updated_at: string;
}
interface UserPoints { trivia_points: number; all_time: number; movies_watched: number; tv_shows_watched: number; books_read: number; }
interface DnaSignal { signal_type: string; signal_value: string; strength: string; source_count: number; sources: any; }
interface ListItem { id: string; title: string; media_type: string | null; image_url: string | null; created_at: string; }
interface UserList { id: string; title: string; media_type: string | null; is_pinned: boolean; is_default: boolean; }
interface ReputationTitle { title_key: string; tier: number; score: number; progress_pct: number; genre_context: string | null; }
interface DnaSnapshot { snapshot_month: string; core_archetype: string; current_era: string | null; flavor_traits: string[] | null; ai_summary: string | null; evolution_note: string | null; }
interface Friend { id: string; user_name: string; avatar: string | null; }

// ─── Archetype config ─────────────────────────────────────────────────────────

const ARCHETYPE_CONFIG: Record<string, { eraTitle: string; eraDesc: string; icon: string; color: string; }> = {
  social_watcher:    { eraTitle: 'Story-Sharing Phase',  eraDesc: "You're watching things you can't wait to talk about. Your taste is becoming the conversation.",         icon: '🎭', color: '#7c3aed' },
  emotional_binger:  { eraTitle: 'Deep Feelings Era',    eraDesc: "You're seeking stories that hit different. Emotional resonance is your compass right now.",              icon: '💫', color: '#db2777' },
  binge_machine:     { eraTitle: 'Consumption Surge',    eraDesc: "You're in full binge mode. Once you start, stopping isn't an option.",                                   icon: '⚡', color: '#d97706' },
  completionist:     { eraTitle: 'Completionist Phase',  eraDesc: "You finish what you start. Every series, every book. The full picture matters to you.",                  icon: '✅', color: '#059669' },
  taste_curator:     { eraTitle: 'Curation Mode',        eraDesc: "You're selective, intentional, and building a taste profile that others will reference.",                 icon: '🎨', color: '#0891b2' },
  genre_specialist:  { eraTitle: 'Specialist Phase',     eraDesc: "You've found your lane and you're going deep. Genre mastery is your superpower.",                        icon: '🎯', color: '#7c3aed' },
  nostalgia_dweller: { eraTitle: 'Nostalgia Wave',       eraDesc: "You're revisiting the classics. Comfort, memory, and familiarity are shaping your choices.",             icon: '🕰️', color: '#92400e' },
  prediction_oracle: { eraTitle: 'Oracle Mode',          eraDesc: "You're calling things before they happen. Pattern recognition is your edge.",                            icon: '🔮', color: '#6d28d9' },
  lore_hunter:       { eraTitle: 'Lore Hunt Phase',      eraDesc: "You're going deep — theories, context, backstory. Surface-level isn't enough.",                         icon: '🗺️', color: '#1d4ed8' },
  contrarian_voice:  { eraTitle: 'Contrarian Wave',      eraDesc: "You're watching what others write off. Your taste isn't shaped by what's trending.",                     icon: '🌊', color: '#0f766e' },
  prestige_chaser:   { eraTitle: 'Prestige Phase',       eraDesc: "You're gravitating toward the critically praised and culturally significant. Quality over quantity.",    icon: '👑', color: '#b45309' },
  comfort_rewatcher: { eraTitle: 'Comfort Era',          eraDesc: "You're returning to the familiar. Safe, warm, and exactly what you needed.",                             icon: '🏠', color: '#6d28d9' },
  trivia_titan:      { eraTitle: 'Trivia Titan Phase',   eraDesc: "Your knowledge is a superpower. You're not just watching — you're studying.",                           icon: '🧠', color: '#7c3aed' },
  cinephile:         { eraTitle: 'Cinephile Mode',       eraDesc: "Film as art, craft, and language. You're watching with your whole brain.",                               icon: '🎬', color: '#1e40af' },
  bookworm:          { eraTitle: 'Literary Phase',        eraDesc: "Pages over screens. You're in a reading season and loving every chapter.",                               icon: '📚', color: '#166534' },
  soundtrack_driven: { eraTitle: 'Soundtrack Phase',     eraDesc: "Music isn't background noise — it's shaping your whole mood and story choices.",                        icon: '🎵', color: '#be123c' },
  discovery_engine:  { eraTitle: 'Discovery Mode',       eraDesc: "You're finding things no one else is watching yet. Early adopter energy, all the time.",                 icon: '🔍', color: '#0369a1' },
  chaos_viewer:      { eraTitle: 'Chaos Spiral',         eraDesc: "You're watching everything, in no particular order. The chaos is the point.",                           icon: '🌀', color: '#7c3aed' },
};

const REPUTATION_LABELS: Record<string, { label: string; icon: string; description: string }> = {
  theory_crafter:    { label: 'Theory Crafter',     icon: '🔍', description: 'Your predictions are accurate beyond 80% of users.' },
  trusted_predictor: { label: 'Trusted Predictor',  icon: '🎯', description: 'Friends come to you for what happens next.' },
  canon_builder:     { label: 'Canon Builder',      icon: '📖', description: 'You remember the details others miss.' },
  binge_analyst:     { label: 'Certified Binge Analyst', icon: '📊', description: 'You finish what you start, always.' },
  action_addict:     { label: 'Action Addict',      icon: '⚡', description: 'High-intensity content is your default mode.' },
  chaos_viewer:      { label: 'Chaos Viewer',       icon: '🌀', description: 'Genre rules don\'t apply to you.' },
  social_connector:  { label: 'Social Connector',   icon: '🎭', description: 'You make entertainment a shared experience.' },
  prestige_hunter:   { label: 'Prestige Hunter',    icon: '👑', description: 'Quality-first, every time.' },
};

function getDnaInfluenceLabel(mediaType: string | null, signals: DnaSignal[]): string {
  const mt = (mediaType || '').toLowerCase();
  const sig = signals.find(s => s.signal_type === 'media_type' && s.signal_value === mt);
  const strength = sig ? parseFloat(sig.strength) : 0;
  if (mt === 'movie')   return strength > 0.9 ? 'Cinematic Core' : 'Movie Pull';
  if (mt === 'tv')      return strength > 0.8 ? 'Binge Signal' : 'Story Arc Fuel';
  if (mt === 'book')    return strength > 0.5 ? 'Deep Reader' : 'Narrative Dive';
  if (mt === 'music')   return 'Mood Fuel';
  if (mt === 'podcast') return 'Knowledge Pull';
  return 'Recently Added';
}

function formatArchetypeName(key: string | null): string {
  if (!key) return '';
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
}

const MEDIA_ICONS: Record<string, any> = {
  movie: Film, tv: Tv, book: BookOpen, music: Music, podcast: Mic, game: Gamepad2,
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IdentityPage() {
  const { user, session } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'dna' | 'friends' | 'media'>('dna');

  // Core data
  const [profile, setProfile] = useState<any>(null);
  const [dna, setDna] = useState<DnaProfile | null>(null);
  const [points, setPoints] = useState<UserPoints | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [signals, setSignals] = useState<DnaSignal[]>([]);
  const [reputationTitles, setReputationTitles] = useState<ReputationTitle[]>([]);
  const [snapshots, setSnapshots] = useState<DnaSnapshot[]>([]);
  const [recentItems, setRecentItems] = useState<ListItem[]>([]);
  const [userLists, setUserLists] = useState<UserList[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [mediaFilter, setMediaFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);

  // ── Load core data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    Promise.all([
      supabase.from('users').select('*').eq('id', uid).single(),
      supabase.from('dna_profiles').select('*').eq('user_id', uid).single(),
      supabase.from('user_points').select('trivia_points, all_time, movies_watched, tv_shows_watched, books_read').eq('user_id', uid).single(),
      supabase.from('login_streaks').select('current_streak').eq('user_id', uid).single(),
      supabase.from('user_dna_signals').select('*').eq('user_id', uid).in('signal_type', ['media_type', 'genre']).order('strength', { ascending: false }).limit(12),
      supabase.from('user_reputation_titles').select('*').eq('user_id', uid).order('score', { ascending: false }).limit(6),
      supabase.from('dna_snapshots').select('*').eq('user_id', uid).order('snapshot_month', { ascending: false }).limit(6),
    ]).then(([profileRes, dnaRes, pointsRes, streakRes, signalsRes, repRes, snapRes]) => {
      if (profileRes.data) setProfile(profileRes.data);
      if (dnaRes.data) setDna(dnaRes.data as DnaProfile);
      if (pointsRes.data) setPoints(pointsRes.data as UserPoints);
      if (streakRes.data) setStreak(streakRes.data.current_streak || 0);
      if (signalsRes.data) setSignals(signalsRes.data as DnaSignal[]);
      if (repRes.data) setReputationTitles(repRes.data as ReputationTitle[]);
      if (snapRes.data) setSnapshots(snapRes.data as DnaSnapshot[]);
      setLoading(false);
    });
  }, [user?.id]);

  // ── Load friends (lazy) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'friends' || friendsLoaded || !user?.id) return;
    const uid = user.id;
    supabase.from('friendships').select('user_id, friend_id').eq('status', 'accepted')
      .or(`user_id.eq.${uid},friend_id.eq.${uid}`)
      .limit(20)
      .then(async ({ data }) => {
        if (!data?.length) { setFriendsLoaded(true); return; }
        const friendIds = data.map(f => f.user_id === uid ? f.friend_id : f.user_id);
        const { data: users } = await supabase.from('users').select('id, user_name, avatar').in('id', friendIds);
        setFriends((users || []) as Friend[]);
        setFriendsLoaded(true);
      });
  }, [activeTab, friendsLoaded, user?.id]);

  // ── Load media (lazy) ───────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'media' || mediaLoaded || !user?.id) return;
    const uid = user.id;
    Promise.all([
      supabase.from('list_items').select('id, title, media_type, image_url, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(40),
      supabase.from('lists').select('id, title, media_type, is_pinned, is_default').eq('user_id', uid).order('is_pinned', { ascending: false }),
    ]).then(([itemsRes, listsRes]) => {
      if (itemsRes.data) setRecentItems(itemsRes.data as ListItem[]);
      if (listsRes.data) setUserLists(listsRes.data as UserList[]);
      setMediaLoaded(true);
    });
  }, [activeTab, mediaLoaded, user?.id]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const archetypeKey = dna?.core_archetype || null;
  const archetypeConfig = archetypeKey ? ARCHETYPE_CONFIG[archetypeKey] : null;
  const displayName = user?.user_metadata?.display_name
    || profile?.first_name
    || profile?.user_name
    || user?.user_metadata?.first_name
    || user?.email?.split('@')[0] || 'You';
  const username = profile?.user_name || user?.user_metadata?.user_name || '';
  const avatarUrl = profile?.avatar || user?.user_metadata?.avatar_url || null;
  const alignmentLine = getGameAlignment(archetypeKey, 'trivia');

  const filteredItems = recentItems.filter(i => {
    if (mediaFilter === 'all') return true;
    return (i.media_type || '').toLowerCase() === mediaFilter;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0720' }}>
        <div className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'inherit' }}>
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(180deg, #0a0618 0%, #12082a 40%, #1a0a35 70%, #f8f8ff 100%)', paddingBottom: 0 }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-12 pb-2">
          <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'rgba(160,120,255,0.6)' }}>consumed</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation('/search')} style={{ color: 'rgba(255,255,255,0.5)' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
            <button onClick={() => setLocation('/notifications')} style={{ color: 'rgba(255,255,255,0.5)' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </button>
          </div>
        </div>

        {/* Profile core */}
        <div className="px-4 pt-4 pb-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden" style={{ border: '3px solid rgba(124,58,237,0.5)', background: 'rgba(124,58,237,0.2)' }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center" style={{ color: '#9b7fe8', fontSize: 28, fontWeight: 700 }}>{displayName[0]?.toUpperCase()}</div>
                }
              </div>
              {/* Archetype level ring accent */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#7c3aed', border: '2px solid #0f0720' }}>
                <Dna size={11} color="white" />
              </div>
            </div>

            {/* Name + identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-bold text-white leading-tight">{displayName}</h1>
                <button onClick={() => setLocation('/me')} style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <Edit2 size={14} />
                </button>
              </div>
              {username && <p className="text-[12px] mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>@{username}</p>}

              {/* Archetype + tagline */}
              {dna?.label && (
                <div className="mb-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Sparkles size={11} style={{ color: '#a78bfa' }} />
                    <span className="text-[12px] font-bold" style={{ color: '#c4b5fd' }}>{dna.label}</span>
                  </div>
                  {dna.tagline && <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{dna.tagline}</p>}
                </div>
              )}

              {/* Reputation pills */}
              {reputationTitles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {reputationTitles.slice(0, 3).map(t => (
                    <span key={t.title_key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase" style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.35)', color: '#c4b5fd' }}>
                      {REPUTATION_LABELS[t.title_key]?.icon} {REPUTATION_LABELS[t.title_key]?.label || t.title_key.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Streak + Points row */}
          <div className="flex items-center gap-3 mt-4">
            {streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)' }}>
                <Flame size={12} color="#fb923c" fill="#fb923c" />
                <span className="text-[11px] font-bold" style={{ color: '#fb923c' }}>{streak} day streak</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)' }}>
              <Star size={12} color="#eab308" fill="#eab308" />
              <span className="text-[11px] font-bold" style={{ color: '#eab308' }}>{(points?.all_time || 0).toLocaleString()} pts</span>
            </div>
          </div>

          {/* Points progress bar */}
          {points && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {points.all_time.toLocaleString()} / 20,000
                </span>
                <span className="text-[10px] font-medium" style={{ color: '#a78bfa' }}>
                  Top 8% of Consumed
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #7c3aed, #a78bfa)', width: `${Math.min(100, (points.all_time / 20000) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* ── TAB BAR ─────────────────────────────────────────────────────── */}
        <div className="px-4 pb-0">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)' }}>
            {[
              { key: 'dna',     label: 'My DNA',    icon: <Dna size={13} /> },
              { key: 'friends', label: 'Friends',   icon: <Users size={13} /> },
              { key: 'media',   label: 'All Media', icon: <Film size={13} /> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition-all"
                style={activeTab === tab.key
                  ? { background: 'white', color: '#7c3aed', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }
                  : { color: 'rgba(255,255,255,0.5)' }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gradient bridge to white */}
        <div style={{ height: 24, background: 'linear-gradient(to bottom, #1a0a35, #f8f8ff)' }} />
      </div>

      {/* ── TAB CONTENT ───────────────────────────────────────────────────── */}
      <div className="bg-white min-h-screen pb-24">

        {/* ═══════════════════════════════════════════════════════════════════
            MY DNA TAB
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'dna' && (
          <div className="px-4 pt-4 space-y-5">

            {/* CURRENT ERA */}
            {archetypeConfig && (
              <div className="rounded-2xl p-4 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #1a0a35 0%, #2d1060 100%)', border: '1px solid rgba(124,58,237,0.3)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'rgba(124,58,237,0.3)' }}>
                    {archetypeConfig.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(196,181,253,0.6)' }}>Your Current Era</p>
                    <h3 className="text-base font-bold text-white mb-1">{dna?.current_era || archetypeConfig.eraTitle}</h3>
                    <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{archetypeConfig.eraDesc}</p>
                  </div>
                </div>

                {/* Influenced by */}
                {recentItems.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(196,181,253,0.5)' }}>Influenced by recently</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recentItems.slice(0, 4).map(item => (
                        <span key={item.id} className="px-2 py-1 rounded-lg text-[11px] font-medium" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
                          {item.title.length > 20 ? item.title.slice(0, 19) + '…' : item.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* WHAT'S SHAPING YOUR DNA */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-gray-900">What's Shaping Your DNA</h3>
                <button className="text-[11px] font-medium text-purple-600 flex items-center gap-0.5">View all <ChevronRight size={12} /></button>
              </div>
              {recentItems.length === 0 ? (
                <div className="rounded-xl p-4 text-center" style={{ background: '#f8f5ff', border: '1px solid #e9d5ff' }}>
                  <p className="text-[12px] text-gray-500">Add media to see what's shaping your DNA</p>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                  {recentItems.slice(0, 10).map(item => (
                    <div key={item.id} className="flex-shrink-0 w-24">
                      <div className="w-24 h-32 rounded-xl overflow-hidden mb-1.5 relative" style={{ background: '#e9d5ff' }}>
                        {item.image_url
                          ? <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Film size={20} color="#9b7fe8" /></div>
                        }
                        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                          <span className="text-[8px] font-bold uppercase tracking-wide text-white">{getDnaInfluenceLabel(item.media_type, signals)}</span>
                        </div>
                      </div>
                      <p className="text-[10px] font-medium text-gray-700 leading-tight line-clamp-2">{item.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DNA EVOLUTION TIMELINE */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-gray-900">Your DNA Evolution</h3>
                {snapshots.length > 0 && <button className="text-[11px] font-medium text-purple-600 flex items-center gap-0.5">Full timeline <ChevronRight size={12} /></button>}
              </div>
              {snapshots.length === 0 ? (
                <div className="rounded-xl p-4" style={{ background: '#f8f5ff', border: '1px solid #e9d5ff' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)' }}>
                      <TrendingUp size={16} color="#7c3aed" />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-gray-700">Your evolution starts now</p>
                      <p className="text-[11px] text-gray-500">Monthly snapshots build your timeline as you consume and play.</p>
                    </div>
                  </div>
                  {/* Show current as the start */}
                  {dna && (
                    <div className="mt-3 flex items-center gap-2.5">
                      <div className="w-1 h-12 rounded-full" style={{ background: 'linear-gradient(to bottom, #7c3aed, rgba(124,58,237,0.2))' }} />
                      <div className="flex-1 rounded-xl p-3" style={{ background: 'white', border: '1px solid rgba(124,58,237,0.2)' }}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-purple-600">Now</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#7c3aed', color: 'white' }}>CURRENT</span>
                        </div>
                        <p className="text-[12px] font-semibold text-gray-800">{archetypeConfig?.eraTitle || dna.label}</p>
                        {dna.evolution_note && <p className="text-[10px] text-gray-500 mt-0.5">{dna.evolution_note}</p>}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                  {snapshots.map((snap, i) => {
                    const cfg = ARCHETYPE_CONFIG[snap.core_archetype] || { icon: '🎭', eraTitle: snap.core_archetype, color: '#7c3aed' };
                    return (
                      <div key={snap.snapshot_month} className="flex-shrink-0 w-36 rounded-xl p-3" style={{ background: i === 0 ? 'linear-gradient(135deg,#1a0a35,#2d1060)' : '#f8f5ff', border: i === 0 ? '1px solid rgba(124,58,237,0.4)' : '1px solid #e9d5ff' }}>
                        <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: i === 0 ? 'rgba(196,181,253,0.7)' : '#9b7fe8' }}>{formatMonth(snap.snapshot_month)}</p>
                        <div className="text-lg mb-1">{cfg.icon}</div>
                        <p className="text-[11px] font-bold leading-tight" style={{ color: i === 0 ? 'white' : '#4c1d95' }}>{snap.current_era || cfg.eraTitle}</p>
                        {snap.evolution_note && <p className="text-[9px] mt-1 leading-tight" style={{ color: i === 0 ? 'rgba(255,255,255,0.5)' : '#9b7fe8' }}>{snap.evolution_note}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* REPUTATION */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-gray-900">Your Reputation</h3>
                {reputationTitles.length > 0 && <button className="text-[11px] font-medium text-purple-600 flex items-center gap-0.5">View all <ChevronRight size={12} /></button>}
              </div>
              {reputationTitles.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-gray-500 mb-3">Your reputation builds through consistent play. Titles unlock as your patterns emerge.</p>
                  {Object.entries(REPUTATION_LABELS).slice(0, 3).map(([key, rep]) => (
                    <div key={key} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8f5ff', border: '1px solid #e9d5ff', opacity: 0.6 }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: 'rgba(124,58,237,0.08)' }}>
                        <Lock size={14} color="#9b7fe8" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-gray-400">{rep.label}</p>
                        <p className="text-[10px] text-gray-400">{rep.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {reputationTitles.map(t => {
                    const rep = REPUTATION_LABELS[t.title_key] || { label: t.title_key.replace(/_/g, ' '), icon: '🏆', description: '' };
                    return (
                      <div key={t.title_key} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #1a0a35, #2d1060)', border: '1px solid rgba(124,58,237,0.3)' }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: 'rgba(124,58,237,0.25)' }}>
                          {rep.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-white">{rep.label}</p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{rep.description}</p>
                        </div>
                        {t.progress_pct > 0 && (
                          <div className="flex-shrink-0 text-right">
                            <p className="text-[10px] font-bold text-purple-300">{Math.round(t.progress_pct)}%</p>
                            <div className="w-12 h-1 rounded-full mt-1" style={{ background: 'rgba(255,255,255,0.1)' }}>
                              <div className="h-full rounded-full" style={{ background: '#a78bfa', width: `${t.progress_pct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* DNA SIGNALS / TASTE PROFILE */}
            {signals.length > 0 && (
              <div>
                <h3 className="text-[13px] font-bold text-gray-900 mb-3">Your Taste Signals</h3>
                <div className="rounded-2xl p-4" style={{ background: '#f8f5ff', border: '1px solid #e9d5ff' }}>
                  {signals.filter(s => s.signal_type === 'media_type').slice(0, 4).map(sig => (
                    <div key={sig.signal_value} className="flex items-center gap-3 mb-3 last:mb-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.12)' }}>
                        {(() => { const Icon = MEDIA_ICONS[sig.signal_value] || Film; return <Icon size={13} color="#7c3aed" />; })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-semibold text-gray-700 capitalize">{sig.signal_value}</span>
                          <span className="text-[10px] font-bold text-purple-600">{sig.source_count} items</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(124,58,237,0.1)' }}>
                          <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #7c3aed, #a78bfa)', width: `${Math.round(parseFloat(sig.strength) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* REFINE YOUR DNA */}
            <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #1a0a35 0%, #0f1a40 100%)', border: '1px solid rgba(124,58,237,0.25)' }}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.25)' }}>
                  <RefreshCw size={16} color="#a78bfa" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-white mb-0.5">Refine Your DNA</h3>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Your DNA evolves with you. Keep your profile, recommendations, and compatibility spot-on.</p>
                  {dna?.updated_at && (
                    <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      Last updated {new Date(dna.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white flex items-center justify-center gap-1.5" style={{ background: 'linear-gradient(90deg, #7c3aed, #4f46e5)' }}>
                  <Zap size={13} />
                  Update My DNA
                </button>
                <button className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <Brain size={13} />
                  Take Mini Quiz
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            FRIENDS TAB
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'friends' && (
          <div className="px-4 pt-4 space-y-5">

            {/* COMPARE DNA */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-gray-900">Compare DNA</h3>
                <button className="text-[11px] font-medium text-purple-600 flex items-center gap-0.5">View all <ChevronRight size={12} /></button>
              </div>
              {!friendsLoaded ? (
                <div className="flex items-center justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" /></div>
              ) : friends.length === 0 ? (
                <div className="rounded-xl p-5 text-center" style={{ background: '#f8f5ff', border: '1px solid #e9d5ff' }}>
                  <Users size={24} color="#9b7fe8" className="mx-auto mb-2" />
                  <p className="text-[12px] font-semibold text-gray-700 mb-1">Find your people</p>
                  <p className="text-[11px] text-gray-500 mb-3">Connect with friends to compare your entertainment DNA.</p>
                  <button onClick={() => setLocation('/me')} className="px-4 py-2 rounded-full text-[11px] font-bold text-white" style={{ background: '#7c3aed' }}>
                    Find Friends
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map(friend => (
                    <div key={friend.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8f5ff', border: '1px solid #e9d5ff' }}>
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'rgba(124,58,237,0.2)' }}>
                        {friend.avatar
                          ? <img src={friend.avatar} alt={friend.user_name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-purple-600 font-bold text-sm">{(friend.user_name || '?')[0].toUpperCase()}</div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-gray-800">@{friend.user_name}</p>
                        <p className="text-[10px] text-gray-500">Tap to compare DNA</p>
                      </div>
                      <button className="px-3 py-1.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.25)' }}>
                        Compare
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CIRCLE'S VIBE */}
            <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #1a0a35, #2d1060)', border: '1px solid rgba(124,58,237,0.3)' }}>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={14} color="#a78bfa" />
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(196,181,253,0.6)' }}>Your Circle's Vibe</p>
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                {friends.length > 0 ? 'Your circle is active' : 'Add friends to see your circle'}
              </h3>
              <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {friends.length > 0
                  ? 'See what genres and moods are trending in your network this week.'
                  : 'Connect with friends to see collective mood, trending genres, and shared taste moments.'}
              </p>
            </div>

            {/* SHARED UNIVERSES */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-gray-900">Shared Universes</h3>
              </div>
              <div className="rounded-xl p-4" style={{ background: '#f8f5ff', border: '1px solid #e9d5ff' }}>
                <div className="flex items-center gap-3">
                  <Globe size={18} color="#9b7fe8" className="flex-shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-gray-700">Overlapping fandoms coming soon</p>
                    <p className="text-[11px] text-gray-500">Shows, movies, and books you both love — all in one place.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* FIND YOUR PEOPLE */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-gray-900">Find Your People</h3>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: '#f8f5ff', border: '1px solid #e9d5ff' }}>
                <UserPlus size={20} color="#9b7fe8" className="mx-auto mb-2" />
                <p className="text-[12px] font-semibold text-gray-700 mb-1">People with similar taste</p>
                <p className="text-[11px] text-gray-500 mb-3">Discovery based on entertainment DNA match is coming.</p>
                <button onClick={() => setLocation('/me')} className="px-4 py-2 rounded-full text-[11px] font-bold" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.25)' }}>
                  Explore People
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ALL MEDIA TAB
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'media' && (
          <div className="pt-4 pb-4 space-y-5">

            {/* MEDIA TYPE FILTER */}
            <div className="flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
              {[
                { key: 'all', label: 'All', icon: null },
                { key: 'movie', label: 'Movies', icon: Film },
                { key: 'tv', label: 'TV Shows', icon: Tv },
                { key: 'book', label: 'Books', icon: BookOpen },
                { key: 'podcast', label: 'Podcasts', icon: Mic },
                { key: 'music', label: 'Music', icon: Music },
                { key: 'game', label: 'Games', icon: Gamepad2 },
              ].map(f => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.key}
                    onClick={() => setMediaFilter(f.key)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                    style={mediaFilter === f.key
                      ? { background: '#7c3aed', color: 'white' }
                      : { background: '#f3f0ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}
                  >
                    {Icon && <Icon size={11} />}
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* SECONDARY STATUS FILTER */}
            <div className="flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
              {['All', 'Currently Into', 'Finished', 'Favorites', 'Want To', 'Did Not Finish', 'Lists'].map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className="flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-medium transition-all"
                  style={statusFilter === f
                    ? { background: '#f3f0ff', color: '#7c3aed', border: '1px solid #7c3aed' }
                    : { background: 'transparent', color: '#9ca3af', border: '1px solid #e5e7eb' }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* RECENTLY ADDED */}
            <div className="px-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-gray-900">Recently Added</h3>
                <button className="text-[11px] font-medium text-purple-600 flex items-center gap-0.5" onClick={() => setLocation('/me')}>
                  Add Media <ChevronRight size={12} />
                </button>
              </div>
              {!mediaLoaded ? (
                <div className="flex items-center justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" /></div>
              ) : filteredItems.length === 0 ? (
                <div className="rounded-xl p-6 text-center" style={{ background: '#f8f5ff', border: '1px solid #e9d5ff' }}>
                  <p className="text-[12px] text-gray-500">No {mediaFilter === 'all' ? 'media' : mediaFilter} added yet</p>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                  {filteredItems.slice(0, 20).map(item => (
                    <div key={item.id} className="flex-shrink-0 w-24">
                      <div className="w-24 h-32 rounded-xl overflow-hidden mb-1.5" style={{ background: '#e9d5ff' }}>
                        {item.image_url
                          ? <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Film size={20} color="#9b7fe8" /></div>
                        }
                      </div>
                      <p className="text-[10px] font-medium text-gray-700 leading-tight line-clamp-2">{item.title}</p>
                      {item.media_type && (
                        <p className="text-[9px] text-purple-400 capitalize mt-0.5">{item.media_type}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* YOUR LISTS */}
            {mediaLoaded && (
              <div className="px-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-bold text-gray-900">Your Lists</h3>
                  <button className="text-[11px] font-medium text-purple-600 flex items-center gap-0.5" onClick={() => setLocation('/me')}>
                    View all <ChevronRight size={12} />
                  </button>
                </div>
                {userLists.length === 0 ? (
                  <div className="rounded-xl p-4 text-center" style={{ background: '#f8f5ff', border: '1px solid #e9d5ff' }}>
                    <p className="text-[12px] text-gray-500">Create lists to organize your entertainment universe</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {userLists.slice(0, 6).map(list => (
                      <div key={list.id} className="rounded-xl p-3 flex flex-col justify-between" style={{ background: 'linear-gradient(135deg, #f3f0ff, #ede9fe)', border: '1px solid #ddd6fe', minHeight: 80 }}>
                        {list.is_pinned && <span className="text-[8px] font-bold uppercase tracking-wide text-purple-400 mb-1">PINNED</span>}
                        <p className="text-[11px] font-bold text-gray-800 leading-tight">{list.title}</p>
                        {list.media_type && <p className="text-[9px] text-purple-400 capitalize mt-1">{list.media_type}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>

      <Navigation />
    </div>
  );
}
