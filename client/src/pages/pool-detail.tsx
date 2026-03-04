import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Copy, Check, Crown, X, Search, UserPlus, Send, CheckCircle2, Circle, MessageSquare, BarChart2, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

async function callFn(name: string, body: unknown, token: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

function timeAgo(dateStr: string) {
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }); } catch { return ''; }
}

function avatarColor(name: string) {
  const palette = [
    'bg-violet-500', 'bg-fuchsia-500', 'bg-blue-500',
    'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
  ];
  const code = (name || '?').charCodeAt(0);
  return palette[code % palette.length];
}

function AvatarCircle({ name, size = 'md', ring = false }: { name: string; size?: 'sm' | 'md' | 'lg'; ring?: boolean }) {
  const initial = (name || '?')[0].toUpperCase();
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs';
  const ringCls = ring ? 'ring-2 ring-white' : '';
  return (
    <div className={`${sz} ${ringCls} ${avatarColor(name)} rounded-full flex items-center justify-center font-bold text-white shrink-0`}>
      {initial}
    </div>
  );
}

/* ─── The Pick Card ─────────────────────────────────────────────────── */
function ThePickCard({ post, isHost, token, onRefresh }: { post: any; isHost: boolean; token: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localVoteCounts, setLocalVoteCounts] = useState<Record<string, number>>(post.vote_counts || {});
  const [localUserAnswer, setLocalUserAnswer] = useState<string | null>(post.user_answer?.answer || null);

  useEffect(() => {
    setLocalVoteCounts(post.vote_counts || {});
    setLocalUserAnswer(post.user_answer?.answer || null);
  }, [post.vote_counts, post.user_answer]);

  const isResolved = post.status === 'resolved';
  const options: string[] = post.options || [];

  const submitAnswer = async (answer: string) => {
    if (submitting || localUserAnswer) return;
    setSubmitting(true);
    setLocalUserAnswer(answer);
    setLocalVoteCounts(prev => ({ ...prev, [answer]: (prev[answer] || 0) + 1 }));
    const data = await callFn('submit-pool-answer', { prompt_id: post.id, answer }, token);
    setSubmitting(false);
    if (data.error) {
      setLocalUserAnswer(null);
      toast({ title: data.error, variant: 'destructive' });
    } else {
      onRefresh();
    }
  };

  const resolvePickPrompt = async (answer: string) => {
    const data = await callFn('resolve-pool-prompt', { prompt_id: post.id, correct_answer: answer }, token);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    setResolving(false);
    onRefresh();
    toast({ title: `Done! ${data.winners_count} correct` });
  };

  const totalVotes = Object.values(localVoteCounts).reduce((s, n) => s + n, 0);
  const hasVoted = !!localUserAnswer;

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-purple-100/60 mb-4">
      {/* Header strip */}
      <div className="px-4 py-2 flex items-center justify-between" style={{ background: 'linear-gradient(to right, #7c3aed, #2563eb)' }}>
        <div className="flex items-center gap-1.5">
          <BarChart2 size={13} className="text-white/80" />
          <span className="text-white text-[11px] font-semibold uppercase tracking-widest">The Pick</span>
        </div>
        {isResolved
          ? <span className="text-white/70 text-[10px] font-medium bg-white/15 px-2 py-0.5 rounded-full">Closed</span>
          : <span className="text-green-300 text-[10px] font-medium bg-white/10 px-2 py-0.5 rounded-full">Open</span>
        }
      </div>

      {/* Body */}
      <div className="bg-white p-4 space-y-3">
        <p className="text-gray-900 font-semibold text-base leading-snug">{post.prompt_text}</p>
        {isResolved && post.correct_answer && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2">
            <CheckCircle2 size={15} className="text-green-500 shrink-0" />
            <span>Answer: <span className="font-semibold">{post.correct_answer}</span></span>
          </div>
        )}

        {/* Options — member view */}
        {!isHost && (
          <div className="space-y-2">
            {options.map((opt) => {
              const count = localVoteCounts[opt] || 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const isSelected = localUserAnswer === opt;
              const showBars = hasVoted || isResolved;

              return (
                <button
                  key={opt}
                  onClick={() => submitAnswer(opt)}
                  disabled={hasVoted || isResolved || submitting}
                  className={`w-full text-left rounded-xl overflow-hidden border transition-colors ${
                    isSelected ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-gray-50'
                  } disabled:cursor-default`}
                >
                  <div className="relative px-3 py-2.5">
                    {showBars && (
                      <div
                        className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-500 ${isSelected ? 'bg-purple-100' : 'bg-gray-100'}`}
                        style={{ width: `${pct}%` }}
                      />
                    )}
                    <div className="relative flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-purple-500' : 'border-gray-300'}`}>
                          {isSelected && <span className="w-2 h-2 rounded-full bg-purple-500 block" />}
                        </span>
                        <span className={`text-sm ${isSelected ? 'text-purple-800 font-medium' : 'text-gray-700'}`}>{opt}</span>
                      </div>
                      {showBars && <span className={`text-xs font-medium ${isSelected ? 'text-purple-600' : 'text-gray-400'}`}>{pct}%</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Options — host resolve view */}
        {isHost && !isResolved && (
          resolving ? (
            <div className="space-y-2">
              <p className="text-gray-500 text-xs">Select the correct answer:</p>
              {options.map((opt) => (
                <button key={opt} onClick={() => resolvePickPrompt(opt)} className="w-full text-left text-sm px-3 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-800 hover:bg-green-100 font-medium">
                  {opt}
                </button>
              ))}
              <button onClick={() => setResolving(false)} className="text-gray-400 text-xs hover:text-gray-600">Cancel</button>
            </div>
          ) : (
            <div className="space-y-2">
              {options.map((opt) => {
                const count = localVoteCounts[opt] || 0;
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                return (
                  <div key={opt} className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{opt}</span>
                      <span className="text-gray-400 text-xs">{pct}% · {count}</span>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setResolving(true)} className="text-xs text-purple-500 hover:text-purple-700 transition-colors font-medium">
                Mark correct answer
              </button>
            </div>
          )
        )}

        {totalVotes > 0 && (
          <p className="text-gray-400 text-xs">{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Comment Card ──────────────────────────────────────────────────── */
function CommentCard({ post, isHost, token, onRefresh }: { post: any; isHost: boolean; token: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const creator = post.creator;
  const name = creator?.display_name || creator?.user_name || 'Member';

  const submitReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    await callFn('add-pool-prompt', { pool_id: post.pool_id, question: replyText.trim(), question_type: 'commentary' }, token);
    setReplyText(''); setShowReply(false); setSubmitting(false);
    onRefresh();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 space-y-2">
      <div className="flex items-start gap-2.5">
        <AvatarCircle name={name} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-gray-900 text-sm font-semibold">{name}</span>
            <span className="text-gray-400 text-[11px]">{timeAgo(post.created_at)}</span>
          </div>
          <p className="text-gray-700 text-sm leading-relaxed mt-0.5">{post.prompt_text}</p>
        </div>
      </div>
      <div className="pl-9">
        <button onClick={() => setShowReply(!showReply)} className="text-gray-400 text-xs hover:text-gray-600 flex items-center gap-1 transition-colors">
          <MessageSquare size={12} /> Reply
        </button>
        {showReply && (
          <div className="mt-2 flex gap-2">
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitReply(); }}
              placeholder="Write a reply..."
              autoFocus
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 outline-none text-gray-800 placeholder:text-gray-400"
            />
            <button onClick={submitReply} disabled={!replyText.trim() || submitting} className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity" style={{ background: 'linear-gradient(to right, #7c3aed, #2563eb)' }}>
              <Send size={13} className="text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Post Composer ─────────────────────────────────────────────────── */
function PostComposer({ poolId, token, isHost, currentUserName, onPosted }: {
  poolId: string; token: string; isHost: boolean; currentUserName: string; onPosted: () => void;
}) {
  const [mode, setMode] = useState<null | 'comment' | 'pick'>(null);
  const [text, setText] = useState('');
  const [questionType, setQuestionType] = useState<'pick' | 'call_it'>('pick');
  const [options, setOptions] = useState(['', '']);
  const { toast } = useToast();

  const canPost = text.trim() && (mode !== 'pick' || questionType === 'call_it' || options.filter(o => o.trim()).length >= 2);

  const submit = async () => {
    if (!canPost) return;
    const payload = mode === 'comment'
      ? { pool_id: poolId, question: text.trim(), question_type: 'commentary' }
      : { pool_id: poolId, question: text.trim(), question_type: questionType, options: questionType === 'pick' ? options.filter(o => o.trim()) : [] };
    const data = await callFn('add-pool-prompt', payload, token);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    setText(''); setOptions(['', '']); setMode(null); setQuestionType('pick');
    onPosted();
  };

  if (!mode) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-3">
        {/* Tap target row */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <AvatarCircle name={currentUserName} size="md" />
          <button
            onClick={() => setMode('comment')}
            className="flex-1 text-left text-sm text-gray-400 bg-gray-100 rounded-full px-4 py-2.5 hover:bg-gray-200 transition-colors"
          >
            Write something...
          </button>
        </div>
        {/* Action buttons */}
        <div className="flex gap-0 border-t border-gray-100 pt-2">
          <button
            onClick={() => setMode('comment')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            <MessageSquare size={15} className="text-blue-500" /> Comment
          </button>
          {isHost && (
            <button
              onClick={() => setMode('pick')}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              <BarChart2 size={15} className="text-purple-500" /> The Pick
            </button>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'comment') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AvatarCircle name={currentUserName} size="md" />
            <span className="text-gray-800 text-sm font-medium">{currentUserName}</span>
          </div>
          <button onClick={() => { setMode(null); setText(''); }}><X size={16} className="text-gray-400" /></button>
        </div>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="What's on your mind?" autoFocus rows={3}
          className="w-full text-sm text-gray-800 placeholder:text-gray-400 bg-transparent outline-none resize-none"
        />
        <button onClick={submit} disabled={!text.trim()} className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity" style={{ background: 'linear-gradient(to right, #7c3aed, #2563eb)' }}>
          Post
        </button>
      </div>
    );
  }

  // Pick mode (host only)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">New Pick</p>
        <button onClick={() => { setMode(null); setText(''); setOptions(['', '']); }}><X size={16} className="text-gray-400" /></button>
      </div>
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {(['pick', 'call_it'] as const).map(t => (
          <button key={t} onClick={() => setQuestionType(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${questionType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {t === 'pick' ? 'Pick' : 'Call It'}
          </button>
        ))}
      </div>
      <p className="text-gray-400 text-xs">
        {questionType === 'pick' ? 'Set the options. You mark the correct answer after it airs.' : "Members type a free answer. You mark correct ones after."}
      </p>
      <Input value={text} onChange={e => setText(e.target.value)}
        placeholder={questionType === 'pick' ? 'Who goes home tonight?' : 'How many roses given this episode?'}
        className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-xl h-11" autoFocus />
      {questionType === 'pick' && (
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input value={opt} onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                placeholder={`Option ${i + 1}`} className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-xl h-10 text-sm" />
              {options.length > 2 && <button onClick={() => setOptions(options.filter((_, j) => j !== i))}><X size={15} className="text-gray-400" /></button>}
            </div>
          ))}
          {options.length < 6 && (
            <button onClick={() => setOptions([...options, ''])} className="text-purple-600 text-sm flex items-center gap-1 hover:text-purple-700">
              <Plus size={13} /> Add option
            </button>
          )}
        </div>
      )}
      <button onClick={submit} disabled={!canPost} className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity" style={{ background: 'linear-gradient(to right, #7c3aed, #2563eb)' }}>
        Post Pick
      </button>
    </div>
  );
}

/* ─── About Section ─────────────────────────────────────────────────── */
function AboutSection({ pool, members, isLoading }: { pool: any; members: any[]; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-full bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  const hostName = (pool?.host as any)?.display_name || (pool?.host as any)?.user_name || 'the host';
  const fullDescription = pool?.description
    || `A private prediction room hosted by ${hostName}. Members vote on weekly picks and compete on the leaderboard.`;
  const shortDescription = fullDescription.length > 100 ? fullDescription.slice(0, 97).trim() + '…' : fullDescription;
  const hasMore = fullDescription.length > 100;

  return (
    <div>
      <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-1">About this Room</p>
      <p className="text-white/80 text-sm leading-relaxed">
        {expanded ? fullDescription : shortDescription}
        {hasMore && (
          <button onClick={() => setExpanded(!expanded)} className="text-purple-300 font-medium ml-1 hover:text-white">
            {expanded ? 'read less' : 'read more'}
          </button>
        )}
      </p>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function PoolDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'discussion' | 'leaderboard' | 'members'>('discussion');
  const [copied, setCopied] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pool-detail', params.id],
    queryFn: async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-pool-details?pool_id=${params.id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      return res.json();
    },
    enabled: !!session?.access_token && !!params.id
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['pool-detail', params.id] });

  const handleCopyLink = () => {
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    navigator.clipboard.writeText(`${appUrl}/room/join/${data?.pool?.invite_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Invite link copied!' });
  };

  useEffect(() => {
    if (!memberSearch.trim()) { setSearchResults([]); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      const q = memberSearch.toLowerCase().trim();
      const { data: users } = await supabase.from('users').select('id, display_name, user_name')
        .or(`user_name.ilike.%${q}%,display_name.ilike.%${q}%`).limit(6);
      setSearchResults(users || []);
      setIsSearching(false);
    }, 300);
  }, [memberSearch]);

  const handleAddMember = async (targetUserId: string) => {
    setAddingId(targetUserId);
    const result = await callFn('add-pool-member', { pool_id: params.id, target_user_id: targetUserId }, session?.access_token || '');
    setAddingId(null);
    if (result.error) { toast({ title: result.error, variant: 'destructive' }); return; }
    toast({ title: `${result.user?.display_name || result.user?.user_name || 'Member'} added!` });
    setMemberSearch(''); setSearchResults([]);
    refresh();
  };

  const pool = data?.pool;
  const posts: any[] = data?.posts || [];
  const members: any[] = data?.members || [];
  const isHost = data?.is_host || false;
  const token = session?.access_token || '';

  // Separate picks and comments
  const picks = posts.filter(p => p.prompt_type === 'pick' || p.prompt_type === 'call_it');
  const comments = posts.filter(p => p.prompt_type === 'commentary');

  // Featured pick = most recently created open pick, or most recent if all closed
  const featuredPick = picks.find(p => p.status !== 'resolved') || picks[picks.length - 1] || null;

  const myName = (data?.members?.find((m: any) => m.user_id === session?.user?.id)?.users as any)?.display_name
    || (data?.members?.find((m: any) => m.user_id === session?.user?.id)?.users as any)?.user_name
    || 'Me';

  const TABS = [
    { key: 'discussion', label: 'Discussion' },
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'members', label: 'Members' },
  ] as const;

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: '#f4f4f8' }}>

      {/* ── Purple gradient hero — top to tabs ── */}
      <div style={{ background: 'linear-gradient(160deg, #0a0a0f 0%, #12121f 45%, #2d1f4e 100%)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {/* Back + invite */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <button onClick={() => setLocation('/rooms')} className="text-white/60 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </button>
          <button onClick={handleCopyLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white/70 text-xs font-medium border border-white/20 hover:bg-white/10 transition-colors">
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Invite'}
          </button>
        </div>

        {/* Room name */}
        <div className="px-4 pb-4">
          <p className="text-white/40 text-[10px] font-medium uppercase tracking-widest mb-1">Room</p>
          <h1 className="text-white text-2xl font-semibold leading-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {isLoading ? '...' : pool?.name || 'Room'}
          </h1>

          {/* About — white-tinted card on gradient */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 mb-4">
            <AboutSection pool={pool} members={members} isLoading={isLoading} />
          </div>

          {/* Participant bubbles */}
          {!isLoading && members.length > 0 && (
            <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-5">
              {members.map((m: any) => {
                const name = (m.users as any)?.display_name || (m.users as any)?.user_name || '?';
                return (
                  <div key={m.user_id} className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="relative">
                      <div className={`w-11 h-11 rounded-full ${avatarColor(name)} flex items-center justify-center text-sm font-bold text-white ring-2 ring-white/30`}>
                        {name[0].toUpperCase()}
                      </div>
                      {m.role === 'host' && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                          <Crown size={8} className="text-yellow-900" />
                        </div>
                      )}
                    </div>
                    <span className="text-white/60 text-[10px] font-medium max-w-[44px] text-center truncate">
                      {name.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tabs at bottom of gradient */}
        <div className="flex px-4 border-b border-white/10">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
                tab === t.key ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-gray-200 animate-pulse" />)}
          </div>
        )}

        {/* ── DISCUSSION ── */}
        {!isLoading && tab === 'discussion' && (
          <div className="space-y-0">
            {/* The Pick */}
            {featuredPick && (
              <ThePickCard key={featuredPick.id} post={featuredPick} isHost={isHost} token={token} onRefresh={refresh} />
            )}

            {/* Past picks (host can see all) */}
            {isHost && picks.filter(p => p.id !== featuredPick?.id).length > 0 && (
              <div className="mb-4">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-widest mb-2">Previous Picks</p>
                <div className="space-y-2">
                  {picks.filter(p => p.id !== featuredPick?.id).reverse().map(p => (
                    <div key={p.id} className="bg-white rounded-xl border border-gray-100 px-3.5 py-2.5 flex items-center gap-2">
                      <BarChart2 size={13} className="text-purple-400 shrink-0" />
                      <p className="text-gray-600 text-sm flex-1 truncate">{p.prompt_text}</p>
                      <span className="text-gray-400 text-[10px] shrink-0">{p.status === 'resolved' ? 'Closed' : 'Open'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!featuredPick && !isHost && (
              <div className="text-center py-8 mb-4">
                <p className="text-gray-400 text-sm">No pick posted yet — check back soon.</p>
              </div>
            )}

            {/* Composer */}
            <PostComposer poolId={params.id} token={token} isHost={isHost} currentUserName={myName} onPosted={refresh} />

            {/* Comments */}
            <div className="space-y-3">
              {comments.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-gray-400 text-sm">No comments yet. Start the conversation.</p>
                </div>
              )}
              {[...comments].reverse().map(c => (
                <CommentCard key={c.id} post={c} isHost={isHost} token={token} onRefresh={refresh} />
              ))}
            </div>
          </div>
        )}

        {/* ── LEADERBOARD ── */}
        {!isLoading && tab === 'leaderboard' && (
          <div className="space-y-2">
            {members.length === 0 && <p className="text-gray-400 text-sm text-center py-12">No scores yet</p>}
            {[...members].sort((a, b) => (b.total_points || 0) - (a.total_points || 0)).map((m: any, i) => {
              const name = (m.users as any)?.display_name || (m.users as any)?.user_name || 'Member';
              return (
                <div key={m.user_id} className="flex items-center gap-3 bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
                  <span className={`text-sm font-bold w-6 text-center shrink-0 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-300'}`}>{i + 1}</span>
                  <AvatarCircle name={name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-medium truncate">{name}</p>
                    {m.role === 'host' && <p className="text-yellow-600 text-[11px] flex items-center gap-1"><Crown size={9} /> Host</p>}
                  </div>
                  <span className="text-purple-600 font-semibold text-sm">{m.total_points || 0} pts</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── MEMBERS ── */}
        {!isLoading && tab === 'members' && (
          <div className="space-y-3">
            {isHost && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-50">
                  <Search size={15} className="text-gray-400 shrink-0" />
                  <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Search by name or username..."
                    className="flex-1 text-sm text-gray-800 placeholder:text-gray-400 outline-none bg-transparent" />
                  {memberSearch && <button onClick={() => { setMemberSearch(''); setSearchResults([]); }}><X size={14} className="text-gray-400" /></button>}
                </div>
                {isSearching && <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>}
                {searchResults.length > 0 && (
                  <div>
                    {searchResults.map((u: any) => {
                      const alreadyIn = members.some(m => m.user_id === u.id);
                      return (
                        <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0">
                          <AvatarCircle name={u.display_name || u.user_name || '?'} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 text-sm font-medium truncate">{u.display_name || u.user_name}</p>
                            {u.display_name && <p className="text-gray-400 text-xs">@{u.user_name}</p>}
                          </div>
                          {alreadyIn
                            ? <span className="text-gray-400 text-xs">Added</span>
                            : <button onClick={() => handleAddMember(u.id)} disabled={addingId === u.id}
                                className="flex items-center gap-1 text-purple-600 text-xs font-medium hover:text-purple-700 disabled:opacity-50">
                                <UserPlus size={14} />{addingId === u.id ? 'Adding...' : 'Add'}
                              </button>
                          }
                        </div>
                      );
                    })}
                  </div>
                )}
                {memberSearch.trim() && !isSearching && searchResults.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">No users found</div>
                )}
              </div>
            )}

            {members.map((m: any) => {
              const name = (m.users as any)?.display_name || (m.users as any)?.user_name || 'Member';
              return (
                <div key={m.user_id} className="flex items-center gap-3 bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
                  <AvatarCircle name={name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-medium truncate">{name}</p>
                    {m.role === 'host' && <p className="text-yellow-600 text-[11px] flex items-center gap-1"><Crown size={9} /> Host</p>}
                  </div>
                  <span className="text-gray-400 text-sm">{m.total_points || 0} pts</span>
                </div>
              );
            })}

            <button onClick={handleCopyLink} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-300 text-gray-500 text-sm bg-white hover:bg-gray-50 transition-colors">
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy invite link'}
            </button>
          </div>
        )}
      </div>

      <Navigation hideTopBar />
    </div>
  );
}
