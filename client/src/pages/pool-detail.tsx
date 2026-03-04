import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Copy, Check, Crown, X, Search, UserPlus, Send, CheckCircle2, Circle, MessageSquare, HelpCircle, Plus } from "lucide-react";
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

function Avatar({ name, size = 8, color = 'purple' }: { name: string; size?: number; color?: string }) {
  const initial = (name || '?')[0].toUpperCase();
  const colors: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-600',
    fuchsia: 'bg-fuchsia-100 text-fuchsia-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
  };
  const colorList = Object.values(colors);
  const c = colorList[initial.charCodeAt(0) % colorList.length];
  return (
    <div className={`w-${size} h-${size} rounded-full ${c} flex items-center justify-center text-xs font-semibold shrink-0`}>
      {initial}
    </div>
  );
}

function PostComposer({ poolId, token, onPosted }: { poolId: string; token: string; onPosted: () => void }) {
  const [mode, setMode] = useState<null | 'question' | 'comment'>(null);
  const [question, setQuestion] = useState('');
  const [questionType, setQuestionType] = useState<'pick' | 'call_it'>('pick');
  const [options, setOptions] = useState(['', '']);
  const [comment, setComment] = useState('');
  const { toast } = useToast();

  const canSubmitQuestion = question.trim() && (questionType === 'call_it' || options.filter(o => o.trim()).length >= 2);

  const mutation = useMutation({
    mutationFn: (payload: any) => callFn('add-pool-prompt', { pool_id: poolId, ...payload }, token),
    onSuccess: (data) => {
      if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
      setMode(null);
      setQuestion(''); setOptions(['', '']); setComment(''); setQuestionType('pick');
      onPosted();
    }
  });

  const submitQuestion = () => {
    if (!canSubmitQuestion) return;
    mutation.mutate({ question, question_type: questionType, options: questionType === 'pick' ? options.filter(o => o.trim()) : [] });
  };

  const submitComment = () => {
    if (!comment.trim()) return;
    mutation.mutate({ question: comment, question_type: 'commentary' });
  };

  const close = () => {
    setMode(null); setQuestion(''); setOptions(['', '']); setComment(''); setQuestionType('pick');
  };

  if (!mode) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('question')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <HelpCircle size={15} className="text-purple-400" /> Ask a question
          </button>
          <button
            onClick={() => setMode('comment')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <MessageSquare size={15} className="text-blue-400" /> Post a comment
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'comment') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Post a comment</p>
          <button onClick={close}><X size={16} className="text-gray-400" /></button>
        </div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Say something to the room..."
          autoFocus
          rows={3}
          className="w-full text-sm text-gray-800 placeholder:text-gray-400 bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none resize-none"
        />
        <button
          onClick={submitComment}
          disabled={!comment.trim() || mutation.isPending}
          className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity"
          style={{ background: 'linear-gradient(to right, #7c3aed, #2563eb)' }}
        >
          {mutation.isPending ? 'Posting...' : 'Post'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Ask a question</p>
        <button onClick={close}><X size={16} className="text-gray-400" /></button>
      </div>

      <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => setQuestionType('pick')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${questionType === 'pick' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          Pick
        </button>
        <button
          onClick={() => setQuestionType('call_it')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${questionType === 'call_it' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          Call It
        </button>
      </div>
      <p className="text-gray-400 text-xs">
        {questionType === 'pick' ? 'Set the options. Members pick one. You mark the correct answer after.' : 'Members type any answer freely. You review and mark correct ones.'}
      </p>

      <Input
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder={questionType === 'pick' ? 'Who gets eliminated this week?' : 'How many roses were given?'}
        className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-xl h-11"
        autoFocus
      />

      {questionType === 'pick' && (
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={opt}
                onChange={e => { const next = [...options]; next[i] = e.target.value; setOptions(next); }}
                placeholder={`Option ${i + 1}`}
                className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-xl h-10"
              />
              {options.length > 2 && (
                <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button onClick={() => setOptions([...options, ''])} className="text-purple-600 text-sm flex items-center gap-1 hover:text-purple-700">
              <Plus size={13} /> Add option
            </button>
          )}
        </div>
      )}

      <button
        onClick={submitQuestion}
        disabled={!canSubmitQuestion || mutation.isPending}
        className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity"
        style={{ background: 'linear-gradient(to right, #7c3aed, #2563eb)' }}
      >
        {mutation.isPending ? 'Posting...' : 'Post Question'}
      </button>
    </div>
  );
}

function PostCard({ post, isHost, token, onRefresh }: { post: any; isHost: boolean; token: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [callItText, setCallItText] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [localAnswers, setLocalAnswers] = useState<any[]>(post.all_answers || []);

  useEffect(() => { setLocalAnswers(post.all_answers || []); }, [post.all_answers]);

  const isCallIt = post.prompt_type === 'call_it';
  const isCommentary = post.prompt_type === 'commentary';
  const isResolved = post.status === 'resolved';
  const userAnswer = post.user_answer?.answer;
  const isCorrect = post.user_answer?.is_correct;
  const options: string[] = post.options || [];
  const creator = post.creator;
  const creatorName = creator?.display_name || creator?.user_name || 'Host';

  const submitAnswer = async (answer: string) => {
    if (!answer.trim()) return;
    setSubmitting(true);
    const data = await callFn('submit-pool-answer', { prompt_id: post.id, answer: answer.trim() }, token);
    setSubmitting(false);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    setCallItText('');
    onRefresh();
  };

  const resolvePickPrompt = async (answer: string) => {
    const data = await callFn('resolve-pool-prompt', { prompt_id: post.id, correct_answer: answer }, token);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    setResolving(false);
    onRefresh();
    toast({ title: `Done! ${data.winners_count} correct` });
  };

  const closeCallItPrompt = async () => {
    const data = await callFn('resolve-pool-prompt', { prompt_id: post.id }, token);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    onRefresh();
    toast({ title: `Closed — ${data.winners_count} correct` });
  };

  const markAnswer = async (answerId: string, nowCorrect: boolean) => {
    setMarkingId(answerId);
    setLocalAnswers(prev => prev.map(a => a.id === answerId ? { ...a, is_correct: nowCorrect } : a));
    const data = await callFn('mark-pool-answer', { answer_id: answerId, is_correct: nowCorrect }, token);
    setMarkingId(null);
    if (data.error) {
      setLocalAnswers(prev => prev.map(a => a.id === answerId ? { ...a, is_correct: !nowCorrect } : a));
      toast({ title: data.error, variant: 'destructive' });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      {/* Post header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={creatorName} size={7} />
          <div>
            <p className="text-gray-900 text-sm font-medium leading-none">{creatorName}</p>
            <p className="text-gray-400 text-[11px] mt-0.5">{timeAgo(post.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!isCommentary && (
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${isCallIt ? 'bg-blue-100 text-blue-500' : 'bg-purple-100 text-purple-500'}`}>
              {isCallIt ? 'Call It' : 'Pick'}
            </span>
          )}
          {isResolved && <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded uppercase font-semibold tracking-wide">Closed</span>}
        </div>
      </div>

      {/* Post content */}
      <p className={`text-gray-800 leading-snug ${isCommentary ? 'text-sm' : 'text-sm font-medium'}`}>{post.prompt_text}</p>

      {/* ── PICK mode ── */}
      {!isCommentary && !isCallIt && (
        <>
          {isResolved && post.correct_answer && (
            <p className="text-xs text-green-600 font-medium">Answer: {post.correct_answer}</p>
          )}
          {!isResolved && !resolving && !isHost && (
            <div className="space-y-1.5">
              {userAnswer && post.vote_counts ? (
                (() => {
                  const totalVotes = Object.values(post.vote_counts as Record<string, number>).reduce((s: number, n: number) => s + n, 0);
                  return options.map((opt) => {
                    const count = (post.vote_counts as Record<string, number>)[opt] || 0;
                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const isSelected = userAnswer === opt;
                    return (
                      <div key={opt} className="space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-medium ${isSelected ? 'text-purple-700' : 'text-gray-600'}`}>{opt}{isSelected && ' — your pick'}</span>
                          <span className="text-gray-500">{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${isSelected ? 'bg-purple-500' : 'bg-gray-300'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400">{count} {count === 1 ? 'vote' : 'votes'}</p>
                      </div>
                    );
                  });
                })()
              ) : (
                options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => !userAnswer && submitAnswer(opt)}
                    disabled={submitting || !!userAnswer}
                    className={`w-full text-left text-sm px-3 py-2.5 rounded-xl border transition-colors flex items-center gap-2 ${
                      userAnswer === opt ? 'bg-purple-50 border-purple-300 text-purple-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-50'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${userAnswer === opt ? 'border-purple-500' : 'border-gray-300'}`}>
                      {userAnswer === opt && <span className="w-2 h-2 rounded-full bg-purple-500" />}
                    </span>
                    {opt}
                  </button>
                ))
              )}
            </div>
          )}
          {isResolved && userAnswer && (
            <div className={`text-xs px-3 py-2 rounded-xl ${isCorrect ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
              Your pick: {userAnswer} — {isCorrect ? 'Correct!' : 'Incorrect'}
            </div>
          )}
          {isHost && !isResolved && (
            resolving ? (
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <p className="text-gray-400 text-xs">Tap the correct answer:</p>
                {options.map((opt) => (
                  <button key={opt} onClick={() => resolvePickPrompt(opt)} className="w-full text-left text-sm px-3 py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 hover:bg-green-100">
                    {opt}
                  </button>
                ))}
                <button onClick={() => setResolving(false)} className="text-gray-400 text-xs hover:text-gray-600">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setResolving(true)} className="text-xs text-gray-400 hover:text-purple-500 transition-colors">
                Mark answer
              </button>
            )
          )}
        </>
      )}

      {/* ── CALL IT mode ── */}
      {!isCommentary && isCallIt && (
        <>
          {!isHost && !isResolved && !userAnswer && (
            <div className="flex gap-2">
              <Input
                value={callItText}
                onChange={e => setCallItText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitAnswer(callItText); }}
                placeholder="Type your answer..."
                className="bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 rounded-xl h-10 text-sm"
              />
              <button
                onClick={() => submitAnswer(callItText)}
                disabled={!callItText.trim() || submitting}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40"
                style={{ background: 'linear-gradient(to right, #7c3aed, #2563eb)' }}
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
          )}
          {!isHost && userAnswer && (
            <div className={`text-xs px-3 py-2 rounded-xl ${isResolved ? (isCorrect ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500') : 'bg-gray-100 text-gray-500'}`}>
              Your answer: <span className="font-medium">{userAnswer}</span>
              {isResolved && (isCorrect ? ' — Correct!' : ' — Incorrect')}
              {!isResolved && ' — Waiting for results'}
            </div>
          )}
          {isHost && (
            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              {localAnswers.length === 0 ? (
                <p className="text-gray-400 text-xs">No answers yet</p>
              ) : (
                localAnswers.map((ans: any) => (
                  <div key={ans.id} className="flex items-center gap-2">
                    <button
                      onClick={() => markAnswer(ans.id, !ans.is_correct)}
                      disabled={markingId === ans.id || isResolved}
                      className="shrink-0 transition-opacity disabled:opacity-40"
                    >
                      {ans.is_correct ? <CheckCircle2 size={18} className="text-green-500" /> : <Circle size={18} className="text-gray-300" />}
                    </button>
                    <span className="flex-1 text-gray-800 text-sm">{ans.answer}</span>
                    <span className="text-gray-400 text-xs">{(ans.users as any)?.display_name || (ans.users as any)?.user_name || ''}</span>
                  </div>
                ))
              )}
              {!isResolved && (
                <button onClick={closeCallItPrompt} className="mt-1 text-xs text-gray-400 hover:text-red-400 transition-colors">
                  Close question
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PoolDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'feed' | 'leaderboard' | 'members'>('feed');
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
    const link = `${appUrl}/room/join/${data?.pool?.invite_code}`;
    navigator.clipboard.writeText(link);
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
      const { data: users } = await supabase
        .from('users')
        .select('id, display_name, user_name')
        .or(`user_name.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(6);
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

  const TABS = [
    { key: 'feed', label: 'Feed' },
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'members', label: 'Members' },
  ] as const;

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: '#f9f9fb' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 pt-4 pb-6">
          <button onClick={() => setLocation('/rooms')} className="text-white/70 hover:text-white transition-colors mb-3 block">
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/40 uppercase tracking-widest mb-1">Room</p>
              <h1 className="text-2xl font-semibold text-white leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {isLoading ? '...' : (pool?.name || 'Room')}
              </h1>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-white/80 text-xs font-medium border border-white/20 hover:bg-white/10 transition-colors mt-6 shrink-0"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Invite'}
            </button>
          </div>

          {/* Avatar stack */}
          {members.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <div className="flex -space-x-2">
                {members.slice(0, 5).map((m: any) => {
                  const name = (m.users as any)?.display_name || (m.users as any)?.user_name || '?';
                  return (
                    <div key={m.user_id} className="w-7 h-7 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-[10px] font-bold text-white">
                      {name[0].toUpperCase()}
                    </div>
                  );
                })}
              </div>
              <p className="text-white/50 text-xs">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </p>
            </div>
          )}
        </div>

        {/* Underline tabs */}
        <div className="flex px-4 border-b border-white/10">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'text-white border-white'
                  : 'text-white/40 border-transparent hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-200 animate-pulse" />)}
          </div>
        )}

        {/* ── FEED ── */}
        {!isLoading && tab === 'feed' && (
          <div className="space-y-3">
            {isHost && <PostComposer poolId={params.id} token={token} onPosted={refresh} />}
            {posts.length === 0 && (
              <div className="text-center py-16">
                <p className="text-gray-400 text-sm">{isHost ? 'Post the first question to kick things off.' : 'Nothing posted yet — the host will post the first question soon.'}</p>
              </div>
            )}
            {[...posts].reverse().map((post: any) => (
              <PostCard key={post.id} post={post} isHost={isHost} token={token} onRefresh={refresh} />
            ))}
          </div>
        )}

        {/* ── LEADERBOARD ── */}
        {!isLoading && tab === 'leaderboard' && (
          <div className="space-y-2">
            {members.length === 0 && <p className="text-gray-400 text-sm text-center py-12">No scores yet</p>}
            {[...members].sort((a, b) => (b.total_points || 0) - (a.total_points || 0)).map((m: any, i) => (
              <div key={m.user_id} className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
                <span className={`text-sm font-bold w-6 text-center ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-300'}`}>{i + 1}</span>
                <Avatar name={(m.users as any)?.display_name || (m.users as any)?.user_name || '?'} size={8} />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 text-sm font-medium truncate">{(m.users as any)?.display_name || (m.users as any)?.user_name || 'Member'}</p>
                </div>
                <div className="flex items-center gap-1">
                  {m.role === 'host' && <Crown size={12} className="text-yellow-500" />}
                  <span className="text-purple-600 font-semibold text-sm">{m.total_points || 0} pts</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── MEMBERS ── */}
        {!isLoading && tab === 'members' && (
          <div className="space-y-3">
            {isHost && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-50">
                  <Search size={15} className="text-gray-400 shrink-0" />
                  <input
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Search by name or username..."
                    className="flex-1 text-sm text-gray-800 placeholder:text-gray-400 outline-none bg-transparent"
                  />
                  {memberSearch && (
                    <button onClick={() => { setMemberSearch(''); setSearchResults([]); }}><X size={14} className="text-gray-400" /></button>
                  )}
                </div>
                {isSearching && <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>}
                {searchResults.length > 0 && (
                  <div>
                    {searchResults.map((u: any) => {
                      const alreadyIn = members.some(m => m.user_id === u.id);
                      return (
                        <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0">
                          <Avatar name={u.display_name || u.user_name || '?'} size={8} />
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 text-sm font-medium truncate">{u.display_name || u.user_name}</p>
                            {u.display_name && <p className="text-gray-400 text-xs">@{u.user_name}</p>}
                          </div>
                          {alreadyIn ? (
                            <span className="text-gray-400 text-xs">Added</span>
                          ) : (
                            <button onClick={() => handleAddMember(u.id)} disabled={addingId === u.id} className="flex items-center gap-1 text-purple-600 text-xs font-medium hover:text-purple-700 disabled:opacity-50">
                              <UserPlus size={14} />{addingId === u.id ? 'Adding...' : 'Add'}
                            </button>
                          )}
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

            {members.map((m: any) => (
              <div key={m.user_id} className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
                <Avatar name={(m.users as any)?.display_name || (m.users as any)?.user_name || '?'} size={8} />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 text-sm font-medium truncate">{(m.users as any)?.display_name || (m.users as any)?.user_name || 'Member'}</p>
                  {m.role === 'host' && <p className="text-yellow-600 text-xs">Host</p>}
                </div>
                <span className="text-gray-400 text-sm">{m.total_points || 0} pts</span>
              </div>
            ))}

            <button onClick={handleCopyLink} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-gray-500 text-sm bg-white hover:bg-gray-50 transition-colors">
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
