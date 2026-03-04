import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Copy, Check, Crown, X, Search, UserPlus, Send, CheckCircle2, MessageSquare, BarChart2, Plus, Play, ChevronDown, ChevronUp, Globe, Lock, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

async function callFn(name: string, body: unknown, token: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error(`[callFn] ${name} returned non-JSON (${res.status}):`, text.slice(0, 300));
      return { error: `Server error (${res.status})` };
    }
  } catch (e: any) {
    console.error(`[callFn] ${name} fetch failed:`, e.message);
    return { error: e.message || 'Network error' };
  }
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

/* ─── Featured Pick Banner (Daily Call style) ───────────────────────── */
function FeaturedPickBanner({ post, isHost, token, onRefresh }: { post: any; isHost: boolean; token: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [callItText, setCallItText] = useState('');
  const [localVoteCounts, setLocalVoteCounts] = useState<Record<string, number>>(post.vote_counts || {});
  const [localUserAnswer, setLocalUserAnswer] = useState<string | null>(post.user_answer?.answer || null);

  useEffect(() => {
    setLocalVoteCounts(post.vote_counts || {});
    setLocalUserAnswer(post.user_answer?.answer || null);
  }, [post.vote_counts, post.user_answer]);

  const isResolved = post.status === 'resolved';
  const isCallIt = post.prompt_type === 'call_it' || (post.options || []).length === 0;
  const options: string[] = post.options || [];
  const allAnswers: any[] = post.all_answers || [];
  const totalVotes = Object.values(localVoteCounts).reduce((s, n) => s + n, 0);
  const hasVoted = !!localUserAnswer;
  const label = isCallIt ? 'Call It' : 'The Pick';

  const submitAnswer = async (answer: string) => {
    if (submitting || hasVoted || !answer.trim()) return;
    setSubmitting(true);
    setLocalUserAnswer(answer);
    if (!isCallIt) setLocalVoteCounts(prev => ({ ...prev, [answer]: (prev[answer] || 0) + 1 }));
    const data = await callFn('submit-pool-answer', { prompt_id: post.id, answer }, token);
    setSubmitting(false);
    if (data.error) { setLocalUserAnswer(null); toast({ title: data.error, variant: 'destructive' }); }
    else onRefresh();
  };

  const resolvePickPrompt = async (answer: string) => {
    const data = await callFn('resolve-pool-prompt', { prompt_id: post.id, correct_answer: answer }, token);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    setResolving(false); onRefresh();
    toast({ title: `Done! ${data.winners_count} correct` });
  };

  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'linear-gradient(135deg, #12102b 0%, #1e1654 55%, #2d1f6e 100%)' }}>
      {/* Collapsed header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <Play size={14} className="text-white fill-white ml-0.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white text-sm font-semibold" style={{ fontFamily: 'Poppins, sans-serif' }}>{label}</span>
            {!isResolved
              ? <span className="text-[10px] font-bold text-emerald-400 tracking-widest">LIVE</span>
              : <span className="text-[10px] font-medium text-white/40 tracking-wide">CLOSED</span>
            }
          </div>
          <p className="text-white/60 text-xs leading-snug truncate">{post.prompt_text}</p>
        </div>
        <div className="shrink-0 text-white/40">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3">
          <p className="text-white font-medium text-sm leading-snug">{post.prompt_text}</p>

          {isResolved && post.correct_answer && (
            <div className="flex items-center gap-2 text-xs text-emerald-300 bg-white/10 rounded-xl px-3 py-2">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              Answer: <span className="font-semibold">{post.correct_answer}</span>
            </div>
          )}

          {/* ── CALL IT: everyone gets the input; host additionally sees Mark correct ── */}
          {isCallIt && (
            <div className="space-y-2">
              {/* Text input — shown to anyone who hasn't submitted yet */}
              {!hasVoted && !isResolved && (
                <div className="flex gap-2">
                  <input
                    value={callItText}
                    onChange={e => setCallItText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitAnswer(callItText); }}
                    placeholder="Type your response or prediction..."
                    className="flex-1 text-sm bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white placeholder:text-white/40 outline-none"
                  />
                  <button
                    onClick={() => submitAnswer(callItText)}
                    disabled={!callItText.trim() || submitting}
                    className="px-3 py-2 rounded-xl text-white disabled:opacity-40"
                    style={{ background: 'linear-gradient(to right, #7c3aed, #2563eb)' }}
                  >
                    <Send size={14} />
                  </button>
                </div>
              )}

              {/* Confirmation after submitting */}
              {hasVoted && (
                <div className="bg-white/10 rounded-xl px-3 py-2 text-sm text-white/80">
                  Your call: <span className="font-semibold text-white">{localUserAnswer}</span>
                </div>
              )}

              {/* All submissions */}
              {allAnswers.length > 0 && (
                <div className="space-y-1.5 mt-1">
                  <p className="text-white/30 text-[11px] uppercase tracking-wide font-semibold">
                    {allAnswers.length} {allAnswers.length === 1 ? 'call' : 'calls'}
                  </p>
                  {allAnswers.map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-white/7 rounded-xl px-3 py-2">
                      <span className="text-sm text-white/70">{a.answer}</span>
                      {isHost && !isResolved && (
                        <button onClick={() => resolvePickPrompt(a.answer)} className="text-emerald-400 text-[11px] font-semibold hover:text-emerald-300 transition-colors ml-2 shrink-0">
                          Mark correct
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {allAnswers.length === 0 && hasVoted && (
                <p className="text-white/30 text-xs">You're the first — waiting for others.</p>
              )}
            </div>
          )}

          {/* ── PICK: member vote (options) ── */}
          {!isCallIt && !isHost && (
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
                    className="w-full text-left rounded-xl overflow-hidden disabled:cursor-default"
                    style={{ background: isSelected ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.08)' }}
                  >
                    <div className="relative px-3 py-2.5">
                      {showBars && (
                        <div className="absolute inset-y-0 left-0 rounded-xl transition-all duration-500"
                          style={{ width: `${pct}%`, background: isSelected ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)' }} />
                      )}
                      <div className="relative flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-purple-400' : 'border-white/30'}`}>
                            {isSelected && <span className="w-2 h-2 rounded-full bg-purple-400 block" />}
                          </span>
                          <span className={`text-sm ${isSelected ? 'text-white font-medium' : 'text-white/80'}`}>{opt}</span>
                        </div>
                        {showBars && <span className={`text-xs font-medium ${isSelected ? 'text-purple-300' : 'text-white/40'}`}>{pct}%</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
              {totalVotes > 0 && <p className="text-white/30 text-xs pl-1">{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</p>}
            </div>
          )}

          {/* ── PICK: host view (options) ── */}
          {!isCallIt && isHost && !isResolved && (
            resolving ? (
              <div className="space-y-2">
                <p className="text-white/50 text-xs">Select the correct answer:</p>
                {options.map((opt) => (
                  <button key={opt} onClick={() => resolvePickPrompt(opt)} className="w-full text-left text-sm px-3 py-2.5 rounded-xl font-medium" style={{ background: 'rgba(52,211,153,0.15)', color: '#6ee7b7' }}>
                    {opt}
                  </button>
                ))}
                <button onClick={() => setResolving(false)} className="text-white/30 text-xs hover:text-white/60">Cancel</button>
              </div>
            ) : (
              <div className="space-y-2">
                {options.map((opt) => {
                  const count = localVoteCounts[opt] || 0;
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  return (
                    <div key={opt} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/80">{opt}</span>
                        <span className="text-white/40 text-xs">{pct}% · {count}</span>
                      </div>
                    </div>
                  );
                })}
                {totalVotes > 0 && <p className="text-white/30 text-xs pl-1">{totalVotes} votes</p>}
                <button onClick={() => setResolving(true)} className="text-purple-400 text-xs hover:text-purple-300 transition-colors font-medium">
                  Mark correct answer
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Thread Card (top-level post + nested replies) ─────────────────── */
function ThreadCard({ post, replies, isMember, token, onRefresh, currentUserName, isHost, currentUserId }: {
  post: any; replies: any[]; isMember: boolean; token: string; onRefresh: () => void;
  currentUserName: string; isHost: boolean; currentUserId: string;
}) {
  const { toast } = useToast();
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const canDelete = (createdBy: string) => isHost || currentUserId === createdBy;

  const deletePost = async (promptId: string) => {
    setDeleting(promptId);
    const data = await callFn('manage-pool-prompt', { prompt_id: promptId, action: 'delete' }, token);
    setDeleting(null);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    onRefresh();
  };

  const creator = post.creator;
  const name = creator?.display_name || creator?.user_name || 'Member';

  const submitReply = async () => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    const data = await callFn('add-pool-prompt', {
      pool_id: post.pool_id,
      question: replyText.trim(),
      question_type: 'commentary',
      parent_id: post.id
    }, token);
    setSubmitting(false);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    setReplyText('');
    setShowReplyBox(false);
    setShowReplies(true);
    onRefresh();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* ── Root post ── */}
      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          <AvatarCircle name={name} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-900 text-sm font-semibold">{name}</span>
              <span className="text-gray-400 text-[11px]">{timeAgo(post.created_at)}</span>
              {canDelete(post.created_by) && (
                <button
                  onClick={() => deletePost(post.id)}
                  disabled={deleting === post.id}
                  className="ml-auto text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40 p-0.5"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <p className="text-gray-700 text-sm leading-relaxed mt-0.5">{post.prompt_text}</p>
          </div>
        </div>

        {/* Reply bar */}
        <div className="flex items-center gap-3 mt-2.5 pl-9">
          {isMember && (
            <button
              onClick={() => { setShowReplyBox(r => !r); }}
              className="text-gray-400 text-xs hover:text-purple-600 flex items-center gap-1 transition-colors font-medium"
            >
              <MessageSquare size={11} /> Reply
            </button>
          )}
          {replies.length > 0 && (
            <button
              onClick={() => setShowReplies(r => !r)}
              className="text-gray-400 text-xs hover:text-gray-600 transition-colors"
            >
              {showReplies ? 'Hide' : `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
            </button>
          )}
        </div>

        {/* Inline reply box */}
        {showReplyBox && (
          <div className="mt-2.5 pl-9 flex gap-2">
            <AvatarCircle name={currentUserName} size="sm" />
            <div className="flex-1 flex gap-2">
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitReply(); if (e.key === 'Escape') setShowReplyBox(false); }}
                placeholder="Write a reply..."
                autoFocus
                className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 outline-none text-gray-800 placeholder:text-gray-400"
              />
              <button
                onClick={submitReply}
                disabled={!replyText.trim() || submitting}
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40"
                style={{ background: 'linear-gradient(to right, #7c3aed, #2563eb)' }}
              >
                <Send size={13} className="text-white" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Replies ── */}
      {showReplies && replies.length > 0 && (
        <div className="border-t border-gray-50">
          {replies.map((reply, i) => {
            const rCreator = reply.creator;
            const rName = rCreator?.display_name || rCreator?.user_name || 'Member';
            return (
              <div
                key={reply.id}
                className={`flex items-start gap-2.5 px-3.5 py-3 ${i < replies.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                {/* Left accent line */}
                <div className="w-0.5 self-stretch rounded-full bg-gray-200 shrink-0 ml-3" />
                <AvatarCircle name={rName} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-gray-900 text-sm font-semibold">{rName}</span>
                    <span className="text-gray-400 text-[11px]">{timeAgo(reply.created_at)}</span>
                    {canDelete(reply.created_by) && (
                      <button
                        onClick={() => deletePost(reply.id)}
                        disabled={deleting === reply.id}
                        className="ml-auto text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed mt-0.5">{reply.prompt_text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Comment Composer (Discussion tab only) ────────────────────────── */
function PostComposer({ poolId, token, currentUserName, onPosted }: {
  poolId: string; token: string; currentUserName: string; onPosted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const { toast } = useToast();

  const submit = async () => {
    if (!text.trim()) return;
    const data = await callFn('add-pool-prompt', { pool_id: poolId, question: text.trim(), question_type: 'commentary' }, token);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    setText(''); setOpen(false);
    onPosted();
  };

  if (!open) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-3 flex items-center gap-2.5">
        <AvatarCircle name={currentUserName} size="md" />
        <button
          onClick={() => setOpen(true)}
          className="flex-1 text-left text-sm text-gray-400 bg-gray-100 rounded-full px-4 py-2.5 hover:bg-gray-200 transition-colors"
        >
          Write something...
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AvatarCircle name={currentUserName} size="md" />
          <span className="text-gray-800 text-sm font-medium">{currentUserName}</span>
        </div>
        <button onClick={() => { setOpen(false); setText(''); }}><X size={16} className="text-gray-400" /></button>
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

/* ─── Pick Composer (Picks tab, host only) ───────────────────────────── */
function PickComposer({ poolId, token, onPosted }: {
  poolId: string; token: string; onPosted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [questionType, setQuestionType] = useState<'pick' | 'call_it'>('pick');
  const [options, setOptions] = useState(['', '']);
  const { toast } = useToast();

  const canPost = text.trim() && (questionType === 'call_it' || options.filter(o => o.trim()).length >= 2);

  const submit = async () => {
    if (!canPost) return;
    const payload = {
      pool_id: poolId,
      question: text.trim(),
      question_type: questionType,
      options: questionType === 'pick' ? options.filter(o => o.trim()) : [],
    };
    const data = await callFn('add-pool-prompt', payload, token);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    setText(''); setOptions(['', '']); setQuestionType('pick'); setOpen(false);
    onPosted();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold mb-3 transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #12102b 0%, #1e1654 55%, #2d1f6e 100%)' }}
      >
        <Plus size={15} /> Create Pick
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">New Pick</p>
        <button onClick={() => { setOpen(false); setText(''); setOptions(['', '']); }}><X size={16} className="text-gray-400" /></button>
      </div>

      {/* Pick / Call It toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {(['pick', 'call_it'] as const).map(t => (
          <button key={t} onClick={() => setQuestionType(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${questionType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {t === 'pick' ? 'Pick' : 'Call It'}
          </button>
        ))}
      </div>
      <p className="text-gray-400 text-xs">
        {questionType === 'pick' ? 'Members vote on options. You mark the correct answer after.' : 'Open-ended — members type their own prediction.'}
      </p>

      <Input value={text} onChange={e => setText(e.target.value)}
        placeholder={questionType === 'pick' ? 'Who goes home tonight?' : 'What will happen this episode?'}
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
  const [tab, setTab] = useState<'discussion' | 'picks' | 'leaderboard' | 'members'>('discussion');
  const [managingId, setManagingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
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

  const handleToggleVisibility = async (newValue: boolean) => {
    setTogglingVisibility(true);
    const result = await callFn('toggle-room-visibility', { pool_id: params.id, is_public: newValue }, token);
    setTogglingVisibility(false);
    if (result.error) { toast({ title: result.error, variant: 'destructive' }); return; }
    refresh();
    toast({ title: newValue ? 'Room is now public' : 'Room is now private' });
  };

  const handleJoinRoom = async () => {
    setJoiningRoom(true);
    const result = await callFn('join-pool', { pool_id: params.id }, token);
    setJoiningRoom(false);
    if (result.error) { toast({ title: result.error, variant: 'destructive' }); return; }
    refresh();
    queryClient.invalidateQueries({ queryKey: ['user-pools'] });
    toast({ title: `Joined ${pool?.name || 'room'}!` });
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
  const isMember = data?.is_member ?? true;
  const isPublic = pool?.is_public ?? false;
  const token = session?.access_token || '';

  // Separate picks and comments
  const picks = posts.filter(p => p.prompt_type === 'pick' || p.prompt_type === 'call_it');
  const comments = posts.filter(p => p.prompt_type === 'commentary');

  // Featured pick = latest OPEN pick shown at top of Discussion (both poll-style and call-it)
  const featuredPick = picks.find(p => p.status !== 'resolved') || null;


  const myName = (data?.members?.find((m: any) => m.user_id === session?.user?.id)?.users as any)?.display_name
    || (data?.members?.find((m: any) => m.user_id === session?.user?.id)?.users as any)?.user_name
    || 'Me';

  const TABS = [
    { key: 'discussion', label: 'Discussion' },
    { key: 'picks', label: 'Picks' },
    { key: 'leaderboard', label: 'Scores' },
    { key: 'members', label: 'Members' },
  ] as const;

  const handleManagePrompt = async (promptId: string, action: 'close' | 'delete') => {
    if (managingId) return;
    if (action === 'delete' && !confirm('Delete this pick permanently?')) return;
    setManagingId(promptId);
    const data = await callFn('manage-pool-prompt', { prompt_id: promptId, action }, token);
    setManagingId(null);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    refresh();
    toast({ title: action === 'delete' ? 'Pick deleted' : 'Pick closed' });
  };

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: '#f4f4f8' }}>

      {/* ── Purple gradient hero — top to tabs ── */}
      <div style={{ background: 'linear-gradient(160deg, #0a0a0f 0%, #12121f 45%, #2d1f4e 100%)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {/* Back + invite */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <button onClick={() => setLocation('/rooms')} className="text-white/60 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </button>
          {isMember && (
            <button onClick={handleCopyLink} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white/70 text-xs font-medium border border-white/20 hover:bg-white/10 transition-colors">
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Invite'}
            </button>
          )}
        </div>

        {/* Room name */}
        <div className="px-4 pb-4">
          <p className="text-white/40 text-[10px] font-medium uppercase tracking-widest mb-1">Room</p>
          <h1 className="text-white text-2xl font-semibold leading-tight mb-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {isLoading ? '...' : pool?.name || 'Room'}
          </h1>

          {/* About — white-tinted card on gradient */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 mb-0">
            <AboutSection pool={pool} members={members} isLoading={isLoading} />
          </div>

          {/* Visibility toggle — host only */}
          {!isLoading && isHost && (
            <div className="flex items-center justify-between mt-3 px-1">
              <div className="flex items-center gap-1.5">
                {isPublic
                  ? <Globe size={13} className="text-emerald-300" />
                  : <Lock size={13} className="text-white/40" />
                }
                <span className="text-white/50 text-xs font-medium">
                  {isPublic ? 'Public — anyone can join' : 'Private — invite only'}
                </span>
              </div>
              <button
                onClick={() => handleToggleVisibility(!isPublic)}
                disabled={togglingVisibility}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-50 ${isPublic ? 'bg-emerald-500' : 'bg-white/20'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          {/* Non-member join banner — public rooms */}
          {!isLoading && !isMember && isPublic && (
            <div className="mt-3 px-1">
              <button
                onClick={handleJoinRoom}
                disabled={joiningRoom}
                className="w-full py-2.5 rounded-2xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: 'linear-gradient(to right, #7c3aed, #2563eb)' }}
              >
                {joiningRoom ? 'Joining...' : 'Join this Room'}
              </button>
            </div>
          )}
        </div>

        {/* Overlapping member bubbles — between About and tabs */}
        {!isLoading && members.length > 0 && (
          <div className="overflow-x-auto scrollbar-none px-4 pt-2 pb-2">
            <div className="flex" style={{ marginLeft: '0' }}>
              {members.map((m: any, i: number) => {
                const name = (m.users as any)?.display_name || (m.users as any)?.user_name || (m.users as any)?.email || 'U';
                const words = name.trim().split(/\s+/);
                const initials = words.length >= 2
                  ? (words[0][0] + words[1][0]).toUpperCase()
                  : (name[0] || 'U').toUpperCase();
                return (
                  <div
                    key={m.user_id}
                    className="relative shrink-0"
                    style={{ marginLeft: i === 0 ? 0 : '-10px', zIndex: members.length - i }}
                  >
                    <div className={`w-12 h-12 rounded-full ${avatarColor(name)} flex items-center justify-center text-xs font-bold text-white ring-2 ring-[#1a1035]`}>
                      {initials}
                    </div>
                    {m.role === 'host' && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center ring-1 ring-[#1a1035]">
                        <Crown size={7} className="text-yellow-900" />
                      </div>
                    )}
                  </div>
                );
              })}
              {members.length > 0 && (
                <div className="shrink-0 flex items-center pl-4">
                  <span className="text-white/50 text-xs font-medium">
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

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
          <div className="space-y-3">
            {/* Featured pick banner — any open pick (poll or call it) */}
            {featuredPick && (
              <FeaturedPickBanner key={featuredPick.id} post={featuredPick} isHost={isHost} token={token} onRefresh={refresh} />
            )}

            {/* Composer — members only */}
            {isMember && <PostComposer poolId={params.id} token={token} currentUserName={myName} onPosted={refresh} />}
            {!isMember && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-4 px-4 text-center">
                <p className="text-gray-400 text-sm">Join this room to participate</p>
              </div>
            )}

            {/* Threaded discussion */}
            <div className="space-y-3">
              {comments.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-gray-400 text-sm">No posts yet. Start the conversation.</p>
                </div>
              )}
              {/* Top-level threads only (no parent_id), newest first */}
              {[...comments]
                .filter(c => !c.parent_id)
                .reverse()
                .map(thread => (
                  <ThreadCard
                    key={thread.id}
                    post={thread}
                    replies={comments.filter(c => c.parent_id === thread.id)}
                    isMember={isMember}
                    token={token}
                    onRefresh={refresh}
                    currentUserName={myName}
                    isHost={isHost}
                    currentUserId={session?.user?.id || ''}
                  />
                ))
              }
            </div>
          </div>
        )}

        {/* ── PICKS ── */}
        {!isLoading && tab === 'picks' && (
          <div className="space-y-3">
            {/* Pick composer — host only */}
            {isHost && <PickComposer poolId={params.id} token={token} onPosted={refresh} />}

            {picks.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm">No picks yet.</p>
                {isHost && <p className="text-gray-300 text-xs mt-1">Create the first pick above.</p>}
              </div>
            )}
            {[...picks].reverse().map((p: any) => {
              const isOpen = p.status !== 'resolved';
              const opts: string[] = p.options || [];
              const allAnswers: any[] = p.all_answers || [];
              const voteCounts: Record<string, number> = {};
              allAnswers.forEach((a: any) => { voteCounts[a.answer] = (voteCounts[a.answer] || 0) + 1; });
              const totalVotes = Object.values(voteCounts).reduce((s, n) => s + n, 0);
              const isBusy = managingId === p.id;

              return (
                <div key={p.id} className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #12102b 0%, #1e1654 55%, #2d1f6e 100%)' }}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                    <div className="flex items-center gap-2">
                      <BarChart2 size={13} className="text-white/60" />
                      <span className="text-white text-xs font-semibold" style={{ fontFamily: 'Poppins, sans-serif' }}>The Pick</span>
                      {isOpen
                        ? <span className="text-[10px] font-bold text-emerald-400 tracking-widest">LIVE</span>
                        : <span className="text-[10px] font-medium text-white/35 tracking-wide">CLOSED</span>
                      }
                    </div>
                    {/* Host controls */}
                    {isHost && (
                      <div className="flex items-center gap-3">
                        {isOpen && (
                          <button
                            onClick={() => handleManagePrompt(p.id, 'close')}
                            disabled={isBusy}
                            className="text-white/50 text-[11px] font-medium hover:text-white/80 transition-colors disabled:opacity-40"
                          >
                            {isBusy ? '...' : 'Close'}
                          </button>
                        )}
                        <button
                          onClick={() => handleManagePrompt(p.id, 'delete')}
                          disabled={isBusy}
                          className="text-rose-400/60 text-[11px] font-medium hover:text-rose-300 transition-colors disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Question */}
                  <div className="px-4 pb-2">
                    <p className="text-white/90 text-sm font-medium leading-snug">{p.prompt_text}</p>
                  </div>

                  {/* Vote bars */}
                  {opts.length > 0 && (
                    <div className="px-4 pb-4 space-y-1.5">
                      {opts.map((opt: string) => {
                        const count = voteCounts[opt] || 0;
                        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        const isWinner = p.correct_answer && opt.toLowerCase() === p.correct_answer.toLowerCase();
                        return (
                          <div key={opt} className="rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                            <div className="relative px-3 py-2">
                              <div
                                className="absolute inset-y-0 left-0 rounded-lg transition-all duration-500"
                                style={{ width: `${pct}%`, background: isWinner ? 'rgba(52,211,153,0.25)' : 'rgba(139,92,246,0.2)' }}
                              />
                              <div className="relative flex items-center justify-between">
                                <span className={`text-xs ${isWinner ? 'text-emerald-300 font-semibold' : 'text-white/75'}`}>{opt}</span>
                                <span className={`text-[11px] font-medium ${isWinner ? 'text-emerald-400' : 'text-white/40'}`}>{pct}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {totalVotes > 0 && <p className="text-white/30 text-[10px] pl-1 pt-0.5">{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</p>}
                    </div>
                  )}
                </div>
              );
            })}
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

            {isMember && (
              <button onClick={handleCopyLink} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-300 text-gray-500 text-sm bg-white hover:bg-gray-50 transition-colors">
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy invite link'}
              </button>
            )}
          </div>
        )}
      </div>

      <Navigation hideTopBar />
    </div>
  );
}
