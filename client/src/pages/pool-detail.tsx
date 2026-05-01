import { useState, useEffect, useRef } from "react";
import { APP_BASE } from "@/lib/share";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Copy, Check, Crown, X, Search, UserPlus, Send, CheckCircle2, MessageSquare, MessageCircle, User, BarChart2, Plus, Play, ChevronDown, ChevronUp, Globe, Lock, Trash2, ChevronRight, Star, Flame, Pencil, HelpCircle, Tv, Vote, Dna, Zap, Brain, Film, Music, BookOpen, ArrowUp, ArrowDown, Tag, AlignLeft, Hash, Swords, TrendingUp, HelpCircle as QuestionIcon, ListOrdered, ThumbsUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { QuickActionSheet } from "@/components/quick-action-sheet";

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

/* ─── Featured Poll Carousel (Reelz / partner rooms) ────────────────── */
function FeaturedPollCarousel({ polls, token, onVoted }: {
    polls: any[];
    token: string;
    onVoted: () => void;
  }) {
    const { toast } = useToast();
    const [expanded, setExpanded] = useState(false);
    const [index, setIndex] = useState(0);
    const [localVotes, setLocalVotes] = useState<Record<string, string>>(
      Object.fromEntries(polls.filter(p => p.user_vote).map(p => [p.id, p.user_vote]))
    );
    const [localCounts, setLocalCounts] = useState<Record<string, Record<string, number>>>(
      Object.fromEntries(polls.map(p => [p.id, p.vote_counts || {}]))
    );
    const [submitting, setSubmitting] = useState<string | null>(null);

    const safeIndex = Math.min(index, Math.max(0, polls.length - 1));
    const poll = polls[safeIndex];
    if (!poll) return null;

    const options: string[] = poll.options || [];
    const myVote = localVotes[poll.id] || null;
    const counts = localCounts[poll.id] || {};
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    const hasVoted = !!myVote;
    const votedCount = polls.filter(p => localVotes[p.id]).length;

    const handleVote = async (option: string) => {
      if (hasVoted || submitting || !token) return;
      setSubmitting(poll.id);
      setLocalVotes(prev => ({ ...prev, [poll.id]: option }));
      setLocalCounts(prev => ({
        ...prev,
        [poll.id]: { ...(prev[poll.id] || {}), [option]: ((prev[poll.id] || {})[option] || 0) + 1 }
      }));

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/predictions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ pool_id: poll.id, prediction: option })
        });
        const data = await res.json();
        if (data.error) {
          setLocalVotes(prev => { const n = { ...prev }; delete n[poll.id]; return n; });
          setLocalCounts(prev => ({
            ...prev,
            [poll.id]: { ...(prev[poll.id] || {}), [option]: Math.max(0, ((prev[poll.id] || {})[option] || 1) - 1) }
          }));
          toast({ title: data.error, variant: 'destructive' });
        } else {
          onVoted();
        }
      } catch {
        toast({ title: 'Network error', variant: 'destructive' });
      }
      setSubmitting(null);
    };

    const ptsPerAnswer = poll.points_reward || 2;
    const progressSegments = 4;
    const filledSegments = Math.min(progressSegments, Math.ceil((votedCount / Math.max(polls.length, 1)) * progressSegments));

    return (
      <div className="mb-3">
        {/* Featured challenge banner */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full rounded-2xl overflow-hidden text-left shadow-lg"
          style={{ background: 'linear-gradient(135deg, #1a1040 0%, #2d1f6e 50%, #4c2898 100%)' }}
        >
          <div className="px-4 pt-4 pb-3">
            {/* Top row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-white/60 tracking-widest uppercase">Play the Room</span>
              </div>
              <span className="text-[11px] text-white/50">{polls.length} polls this week</span>
            </div>

            {/* Play icon + titles */}
            <div className="flex items-start gap-3 mb-3">
              <div className="w-11 h-11 rounded-full bg-purple-500/40 border border-white/20 flex items-center justify-center shrink-0">
                <Play size={17} className="text-white fill-white ml-0.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-[15px] leading-snug">This week's challenge</p>
                <p className="text-white/60 text-sm leading-snug mt-0.5 truncate">{poll.title}</p>
              </div>
              <ChevronDown
                size={16}
                className={`text-white/40 shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </div>

            {/* Progress bar */}
            <div className="flex gap-1 mb-3">
              {Array.from({ length: progressSegments }).map((_, i) => (
                <div
                  key={i}
                  className={`h-[3px] flex-1 rounded-full transition-colors ${i < filledSegments ? 'bg-purple-400' : 'bg-white/20'}`}
                />
              ))}
            </div>

            {/* Bottom: pts + votes */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-400/20 rounded-full px-3 py-1">
                +{ptsPerAnswer} pts per answer
              </span>
              {votedCount > 0 && (
                <span className="text-[11px] text-white/50">{votedCount}/{polls.length} answered</span>
              )}
            </div>
          </div>
        </button>

        {/* Expanded full card */}
        {expanded && (
          <div className="mt-2">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              {/* Card header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <span className="text-xs text-gray-500 font-medium">
                  {poll.category || 'TV'} · {safeIndex + 1} of {polls.length}
                </span>
                {polls.length > 1 && (
                  <div className="flex items-center gap-1">
                    {safeIndex > 0 && (
                      <button onClick={() => setIndex(i => i - 1)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                        <ChevronLeft className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                    {safeIndex < polls.length - 1 && (
                      <button onClick={() => setIndex(i => i + 1)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Show tag */}
              {poll.show_tag && (
                <div className="px-4 pb-2">
                  <span className="inline-block text-xs font-medium text-blue-600 bg-blue-50 rounded-md px-2 py-1">
                    {poll.show_tag}
                  </span>
                </div>
              )}

              {/* Question */}
              <p className="px-4 pb-3 text-[15px] font-medium text-gray-900 leading-snug">{poll.title}</p>

              {/* Options */}
              <div className="px-4 pb-2 space-y-2">
                {options.map(opt => {
                  const count = counts[opt] || 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const isSelected = myVote === opt;

                  if (hasVoted) {
                    return (
                      <div key={opt} className="relative rounded-full overflow-hidden" style={{ background: '#f1f3f5', height: 40 }}>
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: isSelected ? 'rgba(109,40,217,0.15)' : 'rgba(0,0,0,0.05)' }}
                        />
                        <div className="relative flex items-center justify-between h-full px-4">
                          <span className={`text-sm font-medium ${isSelected ? 'text-violet-700' : 'text-gray-700'}`}>{opt}</span>
                          <span className={`text-xs font-semibold ${isSelected ? 'text-violet-600' : 'text-gray-400'}`}>{pct}%</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={opt}
                      onClick={() => handleVote(opt)}
                      disabled={!!submitting}
                      className="w-full text-left text-sm text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-full px-4 py-2.5 transition-colors disabled:opacity-60"
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 pt-1 pb-3">
                {hasVoted && total > 0
                  ? <span className="text-xs text-gray-400">{total} {total === 1 ? 'vote' : 'votes'}</span>
                  : <span className="text-xs text-gray-400">Tap an option to vote</span>
                }
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                  +{poll.points_reward || 2} pts
                </span>
              </div>
            </div>

            {/* Progress dots */}
            {polls.length > 1 && (
              <div className="flex items-center gap-1.5 px-0.5 pt-2">
                {polls.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className="h-1 rounded-full transition-all duration-200 flex-1"
                    style={{ background: i === safeIndex ? '#00c896' : 'rgba(0,0,0,0.12)' }}
                  />
                ))}
              </div>
            )}

            {/* Collapse */}
            <button
              onClick={() => setExpanded(false)}
              className="w-full text-center text-xs text-gray-400 pt-2 pb-1 hover:text-gray-600 transition-colors"
            >
              Hide polls
            </button>
          </div>
        )}
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
    || `${hostName}'s room for group predictions, picks, and more.`;
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
/* ─── Room Post Card ─────────────────────────────────────────────────── */
function RoomPostCard({ post, currentUserId, onDelete }: {
  post: any;
  currentUserId: string;
  onDelete: (id: string) => void;
}) {
  const { session } = useAuth();
  const { toast } = useToast();
  const displayName = (post.users as any)?.display_name || (post.users as any)?.user_name || 'Someone';
  const initial = displayName[0]?.toUpperCase() || '?';
  const isOwn = post.user_id === currentUserId;
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';
  const isRateReview = post.post_type === 'rate_review' || post.post_type === 'rating';

  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentCount, setCommentCount] = useState<number>(post.comment_count ?? 0);

  const fetchComments = async () => {
    setLoadingComments(true);
    const { data, error } = await supabase
      .from('social_post_comments')
      .select('id, content, created_at, user_id, users:user_id (id, user_name, display_name)')
      .eq('social_post_id', post.id)
      .order('created_at', { ascending: true })
      .limit(50);
    if (!error && data) {
      setComments(data);
      setCommentCount(data.length);
    }
    setCommentsLoaded(true);
    setLoadingComments(false);
  };

  const toggleComments = () => {
    if (!commentsExpanded && !commentsLoaded) fetchComments();
    setCommentsExpanded(v => !v);
  };

  const submitComment = async () => {
    if (!newComment.trim() || !session?.access_token) return;
    setSubmittingComment(true);
    try {
      const { error } = await supabase.functions.invoke('social-feed-comments', {
        method: 'POST',
        body: { post_id: post.id, content: newComment.trim() }
      });
      if (error) throw error;
      setNewComment('');
      fetchComments();
    } catch {
      toast({ title: 'Failed to add comment', variant: 'destructive' });
    }
    setSubmittingComment(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Media banner if present */}
      {post.image_url && (
        <div className="flex items-center gap-3 px-4 pt-3 pb-2 bg-gray-50 border-b border-gray-100">
          <img src={post.image_url} alt={post.media_title || ''} className="w-10 h-10 rounded-lg object-cover shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{post.media_title}</p>
            {post.media_type && <p className="text-xs text-gray-400 capitalize">{post.media_type}</p>}
          </div>
        </div>
      )}

      <div className="px-4 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initial}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{displayName}</p>
              <p className="text-[11px] text-gray-400">{timeAgo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {post.visibility === 'private' && (
              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Room only</span>
            )}
            {isOwn && (
              <button
                onClick={() => onDelete(post.id)}
                className="p-1 rounded-full hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} className="text-gray-300 hover:text-red-400" />
              </button>
            )}
          </div>
        </div>

        {/* Star rating if rate-review */}
        {isRateReview && post.rating > 0 && (
          <div className="flex items-center gap-0.5 mb-1.5">
            {[1, 2, 3, 4, 5].map(s => (
              <Star
                key={s}
                size={13}
                className={s <= Math.round(post.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-100'}
              />
            ))}
          </div>
        )}

        {/* Content */}
        {post.content && (
          <p className="text-sm text-gray-800 leading-relaxed">{post.content}</p>
        )}

        {/* Post type badge */}
        {isRateReview && (
          <div className="mt-2">
            <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 rounded-full px-2 py-0.5">Review</span>
          </div>
        )}
      </div>

      {/* Action bar — matches feed card style */}
      <div className="flex items-center gap-4 px-4 pt-3 pb-3 border-t border-gray-50">
        <button
          onClick={toggleComments}
          className={`flex items-center gap-1.5 text-sm ${commentsExpanded ? 'text-purple-500' : 'text-gray-400 hover:text-purple-400'} transition-colors`}
        >
          <MessageCircle size={15} />
          <span className="text-xs">{commentCount}</span>
        </button>
      </div>

      {/* Comments section — matches feed card style */}
      {commentsExpanded && (
        <div className="border-t border-gray-100 px-4 pb-4 bg-gray-50/50">
          {loadingComments ? (
            <p className="text-xs text-gray-400 text-center py-3">Loading...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">No comments yet. Be the first!</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pt-3 mb-2">
              {comments.map((c: any) => {
                const cName = (c.users as any)?.display_name || (c.users as any)?.user_name || 'Someone';
                return (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <User size={12} className="text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-gray-800 mr-1">{cName}</span>
                      <span className="text-xs text-gray-600">{c.content}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {session?.user && (
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitComment(); }}
                placeholder="Add a comment..."
                className="flex-1 text-xs px-3 py-2 rounded-full border border-gray-200 focus:outline-none focus:border-purple-400 bg-white"
              />
              <button
                onClick={submitComment}
                disabled={!newComment.trim() || submittingComment}
                className="p-2 rounded-full bg-purple-600 text-white disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Play Tab: Media type pill helper ───────────────────────────────── */
function RoomMediaTypePill({ mediaType }: { mediaType: string | null }) {
  if (!mediaType) return null;
  const type = mediaType.toLowerCase();
  let label = '';
  let Icon = Tv;
  if (type === 'book') { label = 'Book'; Icon = BookOpen; }
  else if (type === 'movie') { label = 'Movie'; Icon = Film; }
  else if (type === 'music') { label = 'Music'; Icon = Music; }
  else if (type === 'tv') { label = 'TV'; Icon = Tv; }
  else return null;
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/20">
      <Icon size={10} className="text-white/70" />
      <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function MediaTypePill({ poll }: { poll: any }) {
  const src = (poll.media_external_source || '').toLowerCase();
  const cat = (poll.category || '').toLowerCase();

  let label = 'TV';
  let Icon = Tv;

  if (src === 'spotify' || cat.includes('music')) { label = 'Music'; Icon = Music; }
  else if (src === 'googlebooks' || cat.includes('book')) { label = 'Book'; Icon = BookOpen; }
  else if (cat.includes('movie') || src === 'tmdb_movie') { label = 'Movie'; Icon = Film; }
  else if (cat.includes('podcast')) { label = 'Podcast'; Icon = Tv; }
  else if (cat.includes('gaming') || cat.includes('game')) { label = 'Game'; Icon = Tv; }
  else if (src === 'tmdb' || src === 'tv' || cat.includes('tv') || cat.includes('pop culture') || cat.includes('pop_culture')) { label = 'TV'; Icon = Tv; }

  return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
      <Icon size={10} className="text-gray-500" />
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
    </div>
  );
}

/* ─── Streak milestones (same messages as trivia carousel) ──────────── */
const POOL_STREAK_MILESTONES = [
  { at: 3,  message: "Hat trick.",                                    sub: "Three in a row. You're on one." },
  { at: 5,  message: "Your entertainment instincts are no joke.",     sub: "Five correct. Keep that energy." },
  { at: 7,  message: "You are giving main character energy.",         sub: "All these right answers. We see you." },
  { at: 10, message: "At this point you need your own trivia show.",  sub: "Ten in a row is not normal behavior." },
  { at: 15, message: "Okay, actually iconic.",                        sub: "15 straight? That's a personality trait." },
  { at: 20, message: "Are you even human?",                           sub: "Twenty correct. Truly unhinged (in the best way)." },
];

/* ─── Play Tab: Trivia card ──────────────────────────────────────────── */
function PlayTriviaCard({ poll, token, onVoted }: { poll: any; token: string; onVoted: (isCorrect: boolean) => void }) {
  const { toast } = useToast();
  const [myVote, setMyVote] = useState<string | null>(poll.user_vote || null);
  const [counts, setCounts] = useState<Record<string, number>>(poll.vote_counts || {});
  const [submitting, setSubmitting] = useState(false);

  const options: string[] = poll.options || [];
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const correctAnswer = poll.correct_answer || '';
  const hasVoted = !!myVote;
  const isCorrect = hasVoted && myVote?.toLowerCase() === correctAnswer.toLowerCase();

  const handleVote = async (option: string) => {
    if (hasVoted || submitting || !token) return;
    setSubmitting(true);
    setMyVote(option);
    setCounts(prev => ({ ...prev, [option]: (prev[option] || 0) + 1 }));
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/predictions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool_id: poll.id, prediction: option }),
      });
      const data = await res.json();
      if (data.error) {
        setMyVote(null);
        setCounts(prev => ({ ...prev, [option]: Math.max(0, (prev[option] || 1) - 1) }));
        toast({ title: data.error, variant: 'destructive' });
      } else {
        const answeredCorrectly = !!correctAnswer && option.toLowerCase() === correctAnswer.toLowerCase();
        onVoted(answeredCorrectly);
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm">
      {/* Card header: show tag left, media type pill right */}
      <div className="flex items-center justify-between px-4 pt-3 pb-0">
        <div className="flex items-center gap-1.5">
          {poll.show_tag && (
            <>
              <Tv size={11} className="text-purple-400" />
              <span className="text-[10px] font-semibold text-purple-500 uppercase tracking-wider">{poll.show_tag}</span>
            </>
          )}
        </div>
        <MediaTypePill poll={poll} />
      </div>
      {/* Question */}
      <div className="px-4 pt-2.5 pb-3">
        <p className="text-gray-900 text-sm font-semibold leading-snug">{poll.title}</p>
      </div>
      {/* Options */}
      <div className="px-4 pb-4 space-y-2">
        {options.map((opt) => {
          const pct = total > 0 && hasVoted ? Math.round(((counts[opt] || 0) / total) * 100) : 0;
          const isThisCorrect = opt.toLowerCase() === correctAnswer.toLowerCase();
          const isMyPick = opt === myVote;
          let bg = 'bg-gray-50 border border-gray-200';
          if (hasVoted && isThisCorrect) bg = 'bg-emerald-50 border border-emerald-200';
          else if (hasVoted && isMyPick && !isThisCorrect) bg = 'bg-red-50 border border-red-200';
          return (
            <button
              key={opt}
              onClick={() => handleVote(opt)}
              disabled={hasVoted || submitting}
              className={`w-full rounded-xl text-left overflow-hidden relative transition-all ${bg} ${!hasVoted ? 'hover:bg-purple-50 hover:border-purple-200 active:scale-[0.99]' : ''}`}
            >
              {hasVoted && (
                <div
                  className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-700 ${isThisCorrect ? 'bg-emerald-100' : isMyPick ? 'bg-red-100' : 'bg-gray-100'}`}
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative px-3 py-2.5 flex items-center justify-between">
                <span className={`text-sm font-medium ${hasVoted && isThisCorrect ? 'text-emerald-700' : hasVoted && isMyPick ? 'text-red-600' : 'text-gray-700'}`}>{opt}</span>
                {hasVoted && (
                  <div className="flex items-center gap-2">
                    {isThisCorrect && <CheckCircle2 size={13} className="text-emerald-500" />}
                    <span className={`text-[11px] font-semibold ${isThisCorrect ? 'text-emerald-600' : 'text-gray-400'}`}>{pct}%</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {hasVoted && (
          <p className={`text-xs font-medium pt-0.5 ${isCorrect ? 'text-emerald-600' : 'text-gray-400'}`}>
            {isCorrect ? 'Correct! +' + (poll.points_reward || 10) + ' pts' : 'Nice try — the answer is ' + correctAnswer}
          </p>
        )}
        {!hasVoted && <p className="text-[11px] text-gray-300 pt-0.5">+{poll.points_reward || 10} pts for correct answer</p>}
      </div>
    </div>
  );
}

/* ─── Play Tab: Generic poll card (Cast Your Vote / DNA) ────────────── */
function PlayPollCard({ poll, token, onVoted, accentColor = 'purple' }: { poll: any; token: string; onVoted: () => void; accentColor?: string }) {
  const { toast } = useToast();
  const [myVote, setMyVote] = useState<string | null>(poll.user_vote || null);
  const [counts, setCounts] = useState<Record<string, number>>(poll.vote_counts || {});
  const [submitting, setSubmitting] = useState(false);

  const options: string[] = poll.options || [];
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const hasVoted = !!myVote;

  const handleVote = async (option: string) => {
    if (hasVoted || submitting || !token) return;
    setSubmitting(true);
    setMyVote(option);
    setCounts(prev => ({ ...prev, [option]: (prev[option] || 0) + 1 }));
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/predictions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool_id: poll.id, prediction: option }),
      });
      const data = await res.json();
      if (data.error) {
        setMyVote(null);
        setCounts(prev => ({ ...prev, [option]: Math.max(0, (prev[option] || 1) - 1) }));
        toast({ title: data.error, variant: 'destructive' });
      } else {
        onVoted();
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm">
      <div className="flex items-start justify-between px-4 pt-3.5 pb-0">
        <p className="text-gray-900 text-sm font-semibold leading-snug flex-1 pr-3">{poll.title}</p>
        <MediaTypePill poll={poll} />
      </div>
      <div className="px-4 pb-0 pt-1" />
      <div className="px-4 pb-4 space-y-2">
        {options.map((opt) => {
          const pct = total > 0 && hasVoted ? Math.round(((counts[opt] || 0) / total) * 100) : 0;
          const isMyPick = opt === myVote;
          return (
            <button
              key={opt}
              onClick={() => handleVote(opt)}
              disabled={hasVoted || submitting}
              className={`w-full rounded-xl text-left overflow-hidden relative border transition-all ${isMyPick && hasVoted ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-gray-50'} ${!hasVoted ? 'hover:bg-purple-50 hover:border-purple-200' : ''}`}
            >
              {hasVoted && (
                <div
                  className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-700 ${isMyPick ? 'bg-purple-100' : 'bg-gray-100'}`}
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative px-3 py-2.5 flex items-center justify-between">
                <span className={`text-sm font-medium ${isMyPick && hasVoted ? 'text-purple-700' : 'text-gray-700'}`}>{opt}</span>
                {hasVoted && <span className="text-[11px] font-semibold text-gray-400">{pct}%</span>}
              </div>
            </button>
          );
        })}
        {hasVoted && <p className="text-[11px] text-gray-400 pt-0.5">{total} {total === 1 ? 'vote' : 'votes'}</p>}
        {!hasVoted && <p className="text-[11px] text-gray-300 pt-0.5">+{poll.points_reward || 5} pts for voting</p>}
      </div>
    </div>
  );
}

/* ─── Play Tab: Section header ───────────────────────────────────────── */
function PlaySectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-[12px] font-bold text-gray-700 uppercase tracking-wider">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[11px] text-gray-400 font-medium">{count}</span>
      )}
    </div>
  );
}

/* ─── Play Tab: Coming soon placeholder ─────────────────────────────── */
function PlayComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-5 px-4 text-center mb-4">
      <p className="text-gray-400 text-sm font-medium">{label} coming soon</p>
      <p className="text-gray-300 text-xs mt-0.5">More games dropping regularly</p>
    </div>
  );
}

/* ─── Pools Tab ──────────────────────────────────────────────────────── */
function PoolsTab({ posts, pool, token, onRefresh }: { posts: any[]; pool: any; token: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [cardIndex, setCardIndex] = useState(0);

  const quizPrompts = posts.filter(p => p.prompt_type === 'pick' && (p.options || []).length > 0);
  const answeredCount = quizPrompts.filter(p => !!p.user_answer || !!localAnswers[p.id]).length;
  const totalPoints = quizPrompts.reduce((sum, p) => sum + (p.user_answer?.points_earned || 0), 0);

  const currentPrompt = quizPrompts[cardIndex] || null;

  // Clamp index when data changes
  useEffect(() => {
    if (cardIndex >= quizPrompts.length && quizPrompts.length > 0) {
      setCardIndex(quizPrompts.length - 1);
    }
  }, [quizPrompts.length]);

  const handleAnswer = async (promptId: string, answer: string) => {
    if (submitting) return;
    setSubmitting(promptId);
    setLocalAnswers(prev => ({ ...prev, [promptId]: answer }));
    const result = await callFn('submit-pool-answer', { prompt_id: promptId, answer }, token);
    setSubmitting(null);
    if (result.error) {
      setLocalAnswers(prev => { const n = { ...prev }; delete n[promptId]; return n; });
      toast({ title: result.error, variant: 'destructive' });
    } else {
      onRefresh();
      // Auto-advance to next unanswered question
      const nextUnanswered = quizPrompts.findIndex((p, i) => i > cardIndex && !p.user_answer && !localAnswers[p.id] && p.id !== promptId);
      if (nextUnanswered !== -1) setTimeout(() => setCardIndex(nextUnanswered), 400);
    }
  };

  function formatDeadline(deadline: string | null | undefined) {
    if (!deadline) return null;
    try {
      const d = new Date(deadline);
      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      if (diffMs < 0) return 'Round closed';
      const diffH = Math.floor(diffMs / 3600000);
      if (diffH < 1) return 'Closes in < 1 hr';
      if (diffH < 24) return `Closes in ${diffH}h`;
      const diffD = Math.floor(diffH / 24);
      return `Closes in ${diffD}d`;
    } catch { return null; }
  }

  const deadlineLabel = formatDeadline(pool?.deadline);

  if (quizPrompts.length === 0) {
    return (
      <div className="px-4 pt-6 pb-4">
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
          <Brain size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">No questions yet</p>
          <p className="text-gray-300 text-xs mt-1">Check back soon for the next round</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>
      {/* ── Round header ── */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-purple-500 leading-none mb-0.5">Current Round</p>
          <p className="text-gray-500 text-xs">{answeredCount} of {quizPrompts.length} answered</p>
        </div>
        <div className="flex items-center gap-2">
          {deadlineLabel && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100">
              <Flame size={10} className="text-orange-400" />
              <span className="text-gray-500 text-xs font-medium">{deadlineLabel}</span>
            </div>
          )}
          {totalPoints > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100">
              <Star size={10} className="text-amber-400 fill-amber-400" />
              <span className="text-amber-600 text-xs font-bold">{totalPoints} pts</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="px-4 mb-3">
        <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-purple-500 transition-all duration-500"
            style={{ width: quizPrompts.length > 0 ? `${(answeredCount / quizPrompts.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* ── Carousel card ── */}
      {currentPrompt && (
        <CarouselCard
          prompt={currentPrompt}
          index={cardIndex}
          total={quizPrompts.length}
          localAnswer={localAnswers[currentPrompt.id] || null}
          submitting={submitting === currentPrompt.id}
          onAnswer={(answer) => handleAnswer(currentPrompt.id, answer)}
          onPrev={() => setCardIndex(i => Math.max(0, i - 1))}
          onNext={() => setCardIndex(i => Math.min(quizPrompts.length - 1, i + 1))}
        />
      )}

      {/* ── Dot indicators ── */}
      <div className="flex justify-center gap-1.5 py-3">
        {quizPrompts.map((p, i) => {
          const isAnswered = !!p.user_answer || !!localAnswers[p.id];
          const isActive = i === cardIndex;
          return (
            <button
              key={p.id}
              onClick={() => setCardIndex(i)}
              className={`rounded-full transition-all ${
                isActive
                  ? 'w-4 h-2 bg-purple-500'
                  : isAnswered
                    ? 'w-2 h-2 bg-purple-200'
                    : 'w-2 h-2 bg-gray-200'
              }`}
            />
          );
        })}
      </div>

      {/* ── All done banner ── */}
      {answeredCount === quizPrompts.length && quizPrompts.length > 0 && (
        <div className="mx-4 mb-4 rounded-2xl bg-purple-50 border border-purple-100 py-4 text-center">
          <CheckCircle2 size={20} className="text-purple-400 mx-auto mb-1.5" />
          <p className="text-purple-700 text-sm font-semibold">Round complete!</p>
          <p className="text-purple-400 text-xs mt-0.5">Check back when the next round drops</p>
        </div>
      )}
    </div>
  );
}

/* ─── Carousel Card ──────────────────────────────────────────────────── */
function CarouselCard({
  prompt, index, total, localAnswer, submitting, onAnswer, onPrev, onNext
}: {
  prompt: any;
  index: number;
  total: number;
  localAnswer: string | null;
  submitting: boolean;
  onAnswer: (answer: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const opts: string[] = prompt.options || [];
  const myAnswer = prompt.user_answer?.answer || localAnswer || null;
  const hasAnswered = !!myAnswer;
  const isResolved = prompt.status === 'resolved';
  const isCorrect = prompt.user_answer?.is_correct;
  const ptsEarned = prompt.user_answer?.points_earned || 0;
  const voteCounts: Record<string, number> = prompt.vote_counts || {};
  const totalVotes = Object.values(voteCounts).reduce((s, n) => s + (n as number), 0);
  const allAnswers: any[] = prompt.all_answers || [];
  const isFirst = index === 0;
  const isLast = index === total - 1;

  // Build player avatars from all_answers (distinct users, first 5)
  const playerNames: string[] = [];
  const seenIds = new Set<string>();
  for (const a of allAnswers) {
    const name = a.users?.display_name || a.users?.user_name;
    if (name && !seenIds.has(a.user_id)) {
      seenIds.add(a.user_id);
      playerNames.push(name);
      if (playerNames.length >= 5) break;
    }
  }
  const playerCount = seenIds.size || totalVotes;

  return (
    <div className="px-4 pb-1">
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '0.5px solid #e5e7eb' }}>

        {/* Card header: question number + pts */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Q{index + 1} / {total}
          </span>
          <span className="text-xs font-semibold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">
            {prompt.points_value || 2} pts
          </span>
        </div>

        {/* Question text */}
        <div className="px-4 pb-4">
          <p className="text-gray-900 text-[15px] font-semibold leading-snug">{prompt.prompt_text}</p>
        </div>

        {/* Answer options or results */}
        <div className="px-4 pb-4 space-y-2">
          {!hasAnswered ? (
            opts.map((opt) => (
              <button
                key={opt}
                disabled={submitting}
                onClick={() => onAnswer(opt)}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border"
                style={{ borderColor: '#e5e7eb', color: '#374151', background: '#fafafa' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#f3f0ff';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c3aed';
                  (e.currentTarget as HTMLButtonElement).style.color = '#7c3aed';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#fafafa';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
                  (e.currentTarget as HTMLButtonElement).style.color = '#374151';
                }}
              >
                {submitting ? <span className="opacity-40">{opt}</span> : opt}
              </button>
            ))
          ) : (
            /* Vote results bars */
            opts.map((opt) => {
              const count = voteCounts[opt] || 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const isMine = opt === myAnswer;
              const isCorrectOpt = isResolved && prompt.correct_answer === opt;
              return (
                <div key={opt} className="relative">
                  <div
                    className={`relative rounded-xl px-4 py-2.5 overflow-hidden ${
                      isCorrectOpt ? 'border border-green-300' : isMine ? 'border border-purple-300' : 'border border-gray-100'
                    }`}
                  >
                    {/* Fill bar */}
                    <div
                      className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-700 ${
                        isCorrectOpt ? 'bg-green-50' : isMine ? 'bg-purple-50' : 'bg-gray-50'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {isMine && !isResolved && <CheckCircle2 size={12} className="text-purple-400 shrink-0" />}
                        {isCorrectOpt && <CheckCircle2 size={12} className="text-green-500 shrink-0" />}
                        {isResolved && isMine && !isCorrectOpt && <X size={12} className="text-red-400 shrink-0" />}
                        <span className={`text-sm font-medium ${
                          isCorrectOpt ? 'text-green-700' : isMine ? 'text-purple-700' : 'text-gray-600'
                        }`}>{opt}</span>
                      </div>
                      <span className={`text-xs font-bold tabular-nums ${
                        isCorrectOpt ? 'text-green-500' : isMine ? 'text-purple-500' : 'text-gray-400'
                      }`}>{pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Card footer: social proof + pts earned */}
        <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            {/* Avatar cluster */}
            {playerNames.length > 0 && (
              <div className="flex -space-x-1.5">
                {playerNames.slice(0, 4).map((name) => (
                  <div
                    key={name}
                    className={`w-5 h-5 rounded-full border border-white flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${avatarColor(name)}`}
                  >
                    {name[0].toUpperCase()}
                  </div>
                ))}
              </div>
            )}
            <span className="text-gray-400 text-xs">
              {playerCount > 0
                ? `${playerCount} player${playerCount !== 1 ? 's' : ''} answered`
                : 'Be the first to answer'}
            </span>
          </div>
          {hasAnswered && ptsEarned > 0 && (
            <span className="text-xs font-bold text-amber-500">+{ptsEarned} pts</span>
          )}
        </div>
      </div>

      {/* Prev / Next nav */}
      <div className="flex items-center justify-between mt-3">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
            isFirst ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <button
          onClick={onNext}
          disabled={isLast}
          className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
            isLast ? 'text-gray-200 cursor-not-allowed' : 'text-purple-500 hover:bg-purple-50'
          }`}
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ─── Play Tab: Main component ───────────────────────────────────────── */
function PlayTab({ featuredPolls, picks, token, isHost, poolId, onRefresh, managingId, onManagePick }: {
  featuredPolls: any[];
  picks: any[];
  token: string;
  isHost: boolean;
  poolId: string;
  onRefresh: () => void;
  managingId: string | null;
  onManagePick: (id: string, action: 'close' | 'delete') => void;
}) {
  const isPartnerRoom = featuredPolls.length > 0;
  const [filter, setFilter] = useState<'all' | 'trivia' | 'vote' | 'dna'>('all');
  const [showSearch, setShowSearch] = useState('');
  const [correctStreak, setCorrectStreak] = useState(0);
  const [streakBanner, setStreakBanner] = useState<{ message: string; sub: string; streak: number } | null>(null);

  const handleTriviaAnswered = (isCorrect: boolean) => {
    onRefresh();
    if (isCorrect) {
      setCorrectStreak(prev => {
        const newStreak = prev + 1;
        const milestone = POOL_STREAK_MILESTONES.find(m => m.at === newStreak);
        if (milestone) {
          setStreakBanner({ message: milestone.message, sub: milestone.sub, streak: newStreak });
          setTimeout(() => setStreakBanner(null), 3200);
        }
        return newStreak;
      });
    } else {
      setCorrectStreak(0);
    }
  };

  if (!isPartnerRoom) {
    // Regular room: show host-created picks
    return (
      <div className="space-y-3">
        {isHost && <PickComposer poolId={poolId} token={token} onPosted={onRefresh} />}
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
          const vc: Record<string, number> = {};
          allAnswers.forEach((a: any) => { vc[a.answer] = (vc[a.answer] || 0) + 1; });
          const totalVotes = Object.values(vc).reduce((s, n) => s + n, 0);
          const isBusy = managingId === p.id;
          return (
            <div key={p.id} className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #12102b 0%, #1e1654 55%, #2d1f6e 100%)' }}>
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <div className="flex items-center gap-2">
                  <BarChart2 size={13} className="text-white/60" />
                  <span className="text-white text-xs font-semibold">The Pick</span>
                  {isOpen ? <span className="text-[10px] font-bold text-emerald-400 tracking-widest">LIVE</span>
                    : <span className="text-[10px] font-medium text-white/35 tracking-wide">CLOSED</span>}
                </div>
                {isHost && (
                  <div className="flex items-center gap-3">
                    {isOpen && <button onClick={() => onManagePick(p.id, 'close')} disabled={isBusy} className="text-white/50 text-[11px] font-medium hover:text-white/80 transition-colors disabled:opacity-40">{isBusy ? '...' : 'Close'}</button>}
                    <button onClick={() => onManagePick(p.id, 'delete')} disabled={isBusy} className="text-rose-400/60 text-[11px] font-medium hover:text-rose-300 transition-colors disabled:opacity-40">Delete</button>
                  </div>
                )}
              </div>
              <div className="px-4 pb-2">
                <p className="text-white/90 text-sm font-medium leading-snug">{p.prompt_text}</p>
              </div>
              {opts.length > 0 && (
                <div className="px-4 pb-4 space-y-1.5">
                  {opts.map((opt: string) => {
                    const count = vc[opt] || 0;
                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    return (
                      <div key={opt} className="rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div className="relative px-3 py-2">
                          <div className="absolute inset-y-0 left-0 rounded-lg transition-all duration-500" style={{ width: `${pct}%`, background: 'rgba(139,92,246,0.2)' }} />
                          <div className="relative flex items-center justify-between">
                            <span className="text-xs text-white/75">{opt}</span>
                            <span className="text-[11px] font-medium text-white/40">{pct}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Partner room: categorized game sections
  const triviaPolls = featuredPolls.filter(p => p.type === 'trivia' || (p.category || '').includes('trivia'));
  const headToHeadPolls = featuredPolls.filter(p => p.category === 'head_to_head');
  const dnaPolls = featuredPolls.filter(p => p.category === 'entertainment_dna');

  // Group trivia by show_tag, applying search filter
  const triviaByShow: Record<string, any[]> = {};
  for (const poll of triviaPolls) {
    const show = poll.show_tag || 'General';
    if (showSearch && !show.toLowerCase().includes(showSearch.toLowerCase())) continue;
    if (!triviaByShow[show]) triviaByShow[show] = [];
    triviaByShow[show].push(poll);
  }
  const showGroups = Object.entries(triviaByShow);

  const FILTER_PILLS = [
    { key: 'all', label: 'All' },
    { key: 'trivia', label: 'Trivia' },
    { key: 'vote', label: 'Cast Your Vote' },
    { key: 'dna', label: 'Entertainment DNA' },
  ] as const;

  const showTrivia = filter === 'all' || filter === 'trivia';
  const showVote = filter === 'all' || filter === 'vote';
  const showDna = filter === 'all' || filter === 'dna';

  return (
    <>
      {/* Streak banner — slides in from top when a milestone is hit */}
      {streakBanner && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm pointer-events-none">
          <div className="bg-gradient-to-r from-purple-700 via-purple-600 to-fuchsia-600 text-white rounded-2xl px-5 py-4 shadow-2xl border border-purple-500/40 animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="text-2xl shrink-0">
                {streakBanner.streak >= 15 ? '🔥' : streakBanner.streak >= 10 ? '⚡' : streakBanner.streak >= 7 ? '💜' : streakBanner.streak >= 5 ? '🎯' : '✨'}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm leading-tight">{streakBanner.message}</p>
                <p className="text-purple-200 text-xs mt-0.5 leading-tight">{streakBanner.sub}</p>
              </div>
              <div className="ml-auto shrink-0 bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums">
                {streakBanner.streak}🔥
              </div>
            </div>
          </div>
        </div>
      )}
    <div className="pb-4">

      {/* ── Filter pills ── */}
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
        {FILTER_PILLS.map(pill => (
          <button
            key={pill.key}
            onClick={() => { setFilter(pill.key); if (pill.key !== 'trivia' && pill.key !== 'all') setShowSearch(''); }}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filter === pill.key
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300 hover:text-purple-600'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* ── Show search (visible when Trivia or All is selected) ── */}
      {(filter === 'all' || filter === 'trivia') && triviaPolls.length > 0 && (
        <div className="relative mb-4">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={showSearch}
            onChange={e => setShowSearch(e.target.value)}
            placeholder="Search by show..."
            className="w-full pl-8 pr-4 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-200"
          />
          {showSearch && (
            <button onClick={() => setShowSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* ── Trivia Section ── */}
      {showTrivia && (
        <div className="mb-2">
          <PlaySectionHeader
            icon={<Brain size={14} className="text-purple-600" />}
            label="Trivia"
            count={triviaPolls.length}
          />

          {showGroups.length === 0 && !showSearch && <PlayComingSoon label="Trivia" />}
          {showGroups.length === 0 && showSearch && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-5 px-4 text-center mb-4">
              <p className="text-gray-400 text-sm">No shows matching "{showSearch}"</p>
            </div>
          )}

          {showGroups.map(([show, questions]) => (
            <div key={show} className="mb-4">
              {(showGroups.length > 1 || showSearch) && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Tv size={11} className="text-gray-400" />
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{show}</span>
                  <span className="text-[10px] text-gray-300">· {questions.length} {questions.length === 1 ? 'question' : 'questions'}</span>
                </div>
              )}
              <div className="space-y-2.5">
                {questions.map(poll => (
                  <PlayTriviaCard key={poll.id} poll={poll} token={token} onVoted={handleTriviaAnswered} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Cast Your Vote Section ── */}
      {showVote && (
        <div className="mb-2">
          {showTrivia && headToHeadPolls.length + dnaPolls.length > 0 && <div className="pt-1 pb-3 border-t border-gray-100" />}
          <PlaySectionHeader
            icon={<Vote size={14} className="text-purple-600" />}
            label="Cast Your Vote"
            count={headToHeadPolls.length}
          />
          {headToHeadPolls.length === 0 && <PlayComingSoon label="Head-to-head polls" />}
          <div className="space-y-2.5">
            {headToHeadPolls.map(poll => (
              <PlayPollCard key={poll.id} poll={poll} token={token} onVoted={onRefresh} />
            ))}
          </div>
        </div>
      )}

      {/* ── Entertainment DNA Section ── */}
      {showDna && (
        <div className="mb-2">
          {(showTrivia || showVote) && dnaPolls.length >= 0 && <div className="pt-1 pb-3 border-t border-gray-100" />}
          <PlaySectionHeader
            icon={<Zap size={14} className="text-purple-600" />}
            label="Entertainment DNA"
            count={dnaPolls.length}
          />
          {dnaPolls.length === 0 && <PlayComingSoon label="How-you-watch polls" />}
          <div className="space-y-2.5">
            {dnaPolls.map(poll => (
              <PlayPollCard key={poll.id} poll={poll} token={token} onVoted={onRefresh} />
            ))}
          </div>
        </div>
      )}

    </div>
    </>
  );
}

/* ─── Live Tab ───────────────────────────────────────────────────────── */
function LiveTab({ featuredPolls, poolId, currentUserId }: { featuredPolls: any[], poolId: string, currentUserId: string | null }) {
  const [phase, setPhase] = useState<'predict' | 'lockin' | 'reveal'>('predict');
  const [countdown, setCountdown] = useState(10);
  const [voted, setVoted] = useState<string | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [reactText, setReactText] = useState('');
  const [submittingReact, setSubmittingReact] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const { data: quickReacts, refetch: refetchReacts } = useQuery({
    queryKey: ['live-quick-reacts', poolId],
    queryFn: async () => {
      const { data } = await supabase
        .from('social_posts')
        .select('id, content, post_type, created_at, user_id, users:user_id(id, display_name, user_name)')
        .eq('room_id', poolId)
        .order('created_at', { ascending: false })
        .limit(40);
      return data || [];
    },
    enabled: !!poolId,
    refetchInterval: 8000,
  });

  const { data: commentsByPost } = useQuery({
    queryKey: ['live-react-comments', poolId],
    queryFn: async () => {
      const postIds = (quickReacts || []).map((p: any) => p.id);
      if (!postIds.length) return {};
      const { data } = await supabase
        .from('social_post_comments')
        .select('id, post_id, content, created_at, user_id, users:user_id(id, display_name, user_name)')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });
      const map: Record<string, any[]> = {};
      (data || []).forEach((c: any) => {
        if (!map[c.post_id]) map[c.post_id] = [];
        map[c.post_id].push(c);
      });
      return map;
    },
    enabled: !!(quickReacts && quickReacts.length > 0),
  });

  const submitReact = async (content: string) => {
    if (!content.trim() || !currentUserId || !poolId) return;
    setSubmittingReact(true);
    await supabase.from('social_posts').insert({
      user_id: currentUserId,
      room_id: poolId,
      post_type: 'thought',
      content: content.trim(),
      visibility: 'public',
    });
    setReactText('');
    setSubmittingReact(false);
    refetchReacts();
  };

  const submitReply = async (postId: string) => {
    if (!replyText.trim() || !currentUserId) return;
    setSubmittingReply(true);
    await supabase.from('social_post_comments').insert({
      post_id: postId,
      user_id: currentUserId,
      content: replyText.trim(),
    });
    setReplyText('');
    setReplyingTo(null);
    setSubmittingReply(false);
    refetchReacts();
  };

  const EMOJIS = ['🔥', '😮', '😂', '👏', '❤️'];

  const poll = featuredPolls[0] || null;
  const rawOptions: string[] = poll?.options || ['Arrest', 'Warning', 'Let go', 'Search'];
  const options = rawOptions.slice(0, Math.min(rawOptions.length, 4));
  const question = poll?.title || 'What happens next?';

  useEffect(() => {
    if (phase !== 'lockin') return;
    if (countdown <= 0) { setPhase('reveal'); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  const handleVote = (opt: string) => {
    if (voted || phase !== 'predict') return;
    setVoted(opt);
    setPhase('lockin');
    setCountdown(10);
  };

  const reset = () => { setPhase('predict'); setCountdown(10); setVoted(null); };

  const fakePercents: Record<string, number> = {};
  let remaining = 100;
  options.forEach((o, i) => {
    if (i === options.length - 1) { fakePercents[o] = remaining; return; }
    const base = i === 0 ? 52 : i === 1 ? 28 : 14;
    const p = Math.min(base, remaining - (options.length - i - 1));
    fakePercents[o] = p;
    remaining -= p;
  });

  const votedPercent = voted ? (fakePercents[voted] ?? 0) : 0;
  const isContrarian = votedPercent < 20;
  const pointsEarned = voted ? (isContrarian ? 7 : 2) : 0;

  return (
    <div className="space-y-4 pb-8">
      {/* How it works explainer — collapsed by default */}
      <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm">
        <button
          className="w-full px-4 py-3 flex items-center justify-between"
          onClick={() => setHowItWorksOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">How It Works</p>
            <div className="flex gap-1.5">
              <span className="bg-gray-100 rounded-full px-2 py-0.5 text-gray-600 text-[10px] font-bold">+2 voting</span>
              <span className="bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 text-emerald-600 text-[10px] font-bold">+5 contrarian</span>
            </div>
          </div>
          {howItWorksOpen ? <ChevronUp size={14} className="text-gray-300" /> : <ChevronDown size={14} className="text-gray-300" />}
        </button>
        {howItWorksOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
            <div className="pt-3" />
            {/* Step 1 */}
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-white text-[10px] font-bold">1</span>
              </div>
              <div>
                <p className="text-gray-900 text-sm font-semibold mb-0.5">Predict</p>
                <p className="text-gray-400 text-[13px] leading-snug">A question drops in real time. Vote before the window closes.</p>
              </div>
            </div>
            {/* Step 2 */}
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-white text-[10px] font-bold">2</span>
              </div>
              <div>
                <p className="text-gray-900 text-sm font-semibold mb-0.5">Lock In</p>
                <p className="text-gray-400 text-[13px] leading-snug">After 10 seconds voting closes. No changing your answer.</p>
              </div>
            </div>
            {/* Step 3 */}
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-white text-[10px] font-bold">3</span>
              </div>
              <div>
                <p className="text-gray-900 text-sm font-semibold mb-0.5">Reveal</p>
                <p className="text-gray-400 text-[13px] leading-snug">See what everyone thought — not who was right. Points go to voters, with a bonus for picking the unexpected option.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live prediction card */}
      <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm">
        <div className="px-4 pt-4 pb-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 bg-emerald-500 rounded-full px-2.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] font-bold text-white tracking-widest uppercase">Live Now</span>
            </div>
            {phase === 'lockin' && (
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs">Locks in</span>
                <span className="text-gray-900 font-bold text-sm w-5 text-center">{countdown}</span>
              </div>
            )}
            {phase === 'reveal' && (
              <button onClick={reset} className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
                Play again
              </button>
            )}
          </div>

          {/* Question */}
          <p className="text-gray-900 font-bold text-[15px] leading-snug mb-4">{question}</p>

          {/* Options */}
          <div className="space-y-2.5">
            {options.map((opt) => {
              const pct = fakePercents[opt] ?? 0;
              const isVoted = voted === opt;
              const showBar = phase === 'reveal';

              return (
                <button
                  key={opt}
                  onClick={() => handleVote(opt)}
                  disabled={phase !== 'predict'}
                  className="w-full text-left relative overflow-hidden rounded-full transition-all"
                  style={{
                    background: showBar
                      ? isVoted ? 'linear-gradient(135deg, #4c1d95 0%, #3b0764 100%)' : '#f3f4f6'
                      : 'linear-gradient(135deg, #4c1d95 0%, #3b0764 100%)',
                    border: showBar && !isVoted ? '1px solid #e5e7eb' : '1px solid transparent',
                  }}
                >
                  {/* Progress fill on reveal for non-voted */}
                  {showBar && !isVoted && (
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: 'rgba(109,40,217,0.12)' }}
                    />
                  )}
                  <div className="relative flex items-center justify-between px-5 py-3">
                    <span className={`text-sm font-semibold ${showBar && !isVoted ? 'text-gray-700' : 'text-white'}`}>{opt}</span>
                    {showBar && (
                      <span className={`text-sm font-bold ${isVoted ? 'text-white' : 'text-gray-500'}`}>{pct}%</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Lock in state */}
          {phase === 'lockin' && (
            <div className="mt-3 text-center">
              <p className="text-gray-500 text-[13px]">Voting closes in <span className="text-gray-900 font-bold">{countdown}s</span> — locked in as <span className="text-purple-600 font-semibold">{voted}</span></p>
            </div>
          )}

          {/* Reveal state */}
          {phase === 'reveal' && voted && (
            <div className={`mt-4 rounded-xl px-4 py-3 ${isContrarian ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-50 border border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-semibold ${isContrarian ? 'text-emerald-700' : 'text-gray-900'}`}>
                    {isContrarian ? 'Contrarian pick!' : 'Points earned'}
                  </p>
                  <p className="text-gray-400 text-[12px] mt-0.5">
                    {isContrarian
                      ? `Only ${votedPercent}% picked ${voted} — bold call.`
                      : `${votedPercent}% of voters agreed with you.`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${isContrarian ? 'text-emerald-600' : 'text-gray-900'}`}>+{pointsEarned}</p>
                  <p className="text-gray-400 text-[11px]">pts</p>
                </div>
              </div>
            </div>
          )}

          {phase === 'predict' && (
            <p className="text-gray-400 text-[11px] text-center mt-3">Tap an option to vote</p>
          )}
        </div>
      </div>

      {/* ── Quick React Feed ── */}
      <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm">
        <div className="px-4 pt-3 pb-2 border-b border-gray-100">
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Live Feed</p>
        </div>

        {/* Emoji quick-react row */}
        <div className="flex gap-2 px-4 pt-3 pb-2">
          {EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => submitReact(emoji)}
              disabled={!currentUserId}
              className="flex-1 py-1.5 rounded-xl text-lg bg-gray-50 hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-40"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Text comment input */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <input
            value={reactText}
            onChange={e => setReactText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitReact(reactText)}
            placeholder={currentUserId ? "Say something..." : "Sign in to comment"}
            disabled={!currentUserId || submittingReact}
            className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none border border-gray-200 focus:border-purple-300 disabled:opacity-40"
          />
          <button
            onClick={() => submitReact(reactText)}
            disabled={!reactText.trim() || !currentUserId || submittingReact}
            className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center disabled:opacity-30 hover:bg-purple-500 transition-colors"
          >
            <Send size={13} className="text-white" />
          </button>
        </div>

        {/* Feed items */}
        <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {(!quickReacts || quickReacts.length === 0) && (
            <p className="text-gray-400 text-[12px] text-center py-4">Be first to react</p>
          )}
          {(quickReacts || []).map((post: any) => {
            const name = post.users?.display_name || post.users?.user_name || 'Someone';
            const initial = name[0]?.toUpperCase();
            const isEmoji = EMOJIS.includes(post.content?.trim());
            const replies = (commentsByPost || {})[post.id] || [];
            const timeAgo = post.created_at
              ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
              : '';
            return (
              <div key={post.id} className="px-4 py-2.5">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-[10px] font-bold shrink-0 mt-0.5">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 mb-0.5">
                      <span className="text-gray-900 text-[12px] font-semibold">{name}</span>
                      <span className="text-gray-400 text-[10px]">{timeAgo}</span>
                    </div>
                    <p className={`text-gray-700 ${isEmoji ? 'text-xl leading-tight' : 'text-[13px] leading-snug'}`}>
                      {post.content}
                    </p>
                    {currentUserId && (
                      <button
                        onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}
                        className="text-gray-400 text-[10px] mt-1 hover:text-purple-500 transition-colors"
                      >
                        Reply
                      </button>
                    )}
                    {replies.length > 0 && (
                      <div className="mt-1.5 space-y-1.5 pl-3 border-l-2 border-gray-100">
                        {replies.map((reply: any) => (
                          <div key={reply.id} className="flex items-start gap-1.5">
                            <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-[8px] font-bold shrink-0 mt-0.5">
                              {(reply.users?.display_name || reply.users?.user_name || '?')[0]?.toUpperCase()}
                            </div>
                            <div>
                              <span className="text-gray-600 text-[10px] font-semibold">{reply.users?.display_name || reply.users?.user_name || 'Someone'} </span>
                              <span className="text-gray-500 text-[11px]">{reply.content}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {replyingTo === post.id && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <input
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && submitReply(post.id)}
                          placeholder="Reply..."
                          autoFocus
                          className="flex-1 bg-gray-50 rounded-lg px-2 py-1 text-[12px] text-gray-900 placeholder-gray-400 outline-none border border-gray-200"
                        />
                        <button
                          onClick={() => submitReply(post.id)}
                          disabled={!replyText.trim() || submittingReply}
                          className="w-6 h-6 rounded-lg bg-purple-600 flex items-center justify-center disabled:opacity-30"
                        >
                          <Send size={10} className="text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PoolDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const currentUserId = session?.user?.id ?? null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'room' | 'play' | 'live' | 'stats'>('room');
  const [feedPickIndex, setFeedPickIndex] = useState(0);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editSeriesTag, setEditSeriesTag] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Takes state
  const [isTakeComposerOpen, setIsTakeComposerOpen] = useState(false);
  const [newTakeTitle, setNewTakeTitle] = useState('');
  const [newTakeBody, setNewTakeBody] = useState('');
  const [newTakeTag, setNewTakeTag] = useState<'debate' | 'ranking' | 'hot_take' | 'question' | 'discussion'>('discussion');
  const [submittingTake, setSubmittingTake] = useState(false);
  const [activeTake, setActiveTake] = useState<any | null>(null);
  const [takeReplyText, setTakeReplyText] = useState('');
  const [replyingToReplyId, setReplyingToReplyId] = useState<string | null>(null);
  const [submittingTakeReply, setSubmittingTakeReply] = useState(false);
  const [newTakeSpoiler, setNewTakeSpoiler] = useState(false);
  const [reviewsExpanded, setReviewsExpanded] = useState(false);

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

  const { data: roomPostsData, refetch: refetchRoomPosts } = useQuery({
    queryKey: ['room-posts', params.id],
    queryFn: async () => {
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select('*, users:user_id(id, display_name, user_name)')
        .eq('room_id', params.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return posts || [];
    },
    enabled: !!params.id && !!session?.access_token
  });

  const seriesTag: string | null = data?.pool?.series_tag ?? null;

  const { data: seriesPostsData } = useQuery({
    queryKey: ['room-series-posts', params.id, seriesTag],
    queryFn: async () => {
      if (!seriesTag) return [];
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select('*, users:user_id(id, display_name, user_name)')
        .ilike('media_title', `%${seriesTag}%`)
        .is('room_id', null)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return posts || [];
    },
    enabled: !!params.id && !!session?.access_token && !!seriesTag
  });

  // Merge room-direct posts + series posts, deduplicate by id, sort newest first
  const roomPosts: any[] = (() => {
    const direct = roomPostsData || [];
    const series = seriesPostsData || [];
    const seen = new Set(direct.map((p: any) => p.id));
    const merged = [...direct, ...series.filter((p: any) => !seen.has(p.id))];
    return merged.sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  })();

  // ── Reviews: filter seriesPostsData to only substantive rate-review posts ──
  const roomReviews: any[] = (seriesPostsData || []).filter((p: any) =>
    p.content && p.content.trim().length > 0 && p.rating
  );

  // ── Room Takes (Reddit-style threads) ──
  const { data: takesData, refetch: refetchTakes } = useQuery({
    queryKey: ['room-takes', params.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_takes')
        .select('*, users:user_id(id, display_name, user_name)')
        .eq('room_id', params.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!params.id && !!session?.access_token,
  });
  const takes: any[] = takesData || [];

  const { data: activeThreadRepliesData, refetch: refetchReplies } = useQuery({
    queryKey: ['take-replies', activeTake?.id],
    queryFn: async () => {
      if (!activeTake?.id) return [];
      const { data, error } = await supabase
        .from('room_take_replies')
        .select('*, users:user_id(id, display_name, user_name)')
        .eq('take_id', activeTake.id)
        .order('upvotes', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeTake?.id,
  });
  const activeThreadReplies: any[] = activeThreadRepliesData || [];

  const { data: myTakeVotes, refetch: refetchMyVotes } = useQuery({
    queryKey: ['my-take-votes', currentUserId, params.id],
    queryFn: async () => {
      if (!currentUserId) return [];
      const { data } = await supabase
        .from('room_take_votes')
        .select('*')
        .eq('user_id', currentUserId);
      return data || [];
    },
    enabled: !!currentUserId,
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${APP_BASE}/room/join/${data?.pool?.invite_code}`);
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

  const handleSaveSettings = async () => {
    if (editSeriesTag === null) return;
    setSavingSettings(true);
    const result = await callFn('update-pool', { pool_id: params.id, series_tag: editSeriesTag.trim() || null }, token);
    setSavingSettings(false);
    if (result.error) { toast({ title: result.error, variant: 'destructive' }); return; }
    refresh();
    setEditSeriesTag(null);
    toast({ title: 'Room settings saved!' });
  };

  // ── Takes handlers ────────────────────────────────────────────────────────
  const handleSubmitTake = async () => {
    if (!newTakeTitle.trim() || !currentUserId) return;
    setSubmittingTake(true);
    await supabase.from('room_takes').insert({
      room_id: params.id,
      user_id: currentUserId,
      title: newTakeTitle.trim(),
      body: newTakeBody.trim() || null,
      tag: newTakeTag,
      has_spoiler: newTakeSpoiler,
    });
    setNewTakeTitle('');
    setNewTakeBody('');
    setNewTakeTag('discussion');
    setNewTakeSpoiler(false);
    setIsTakeComposerOpen(false);
    setSubmittingTake(false);
    refetchTakes();
  };

  const handleSubmitTakeReply = async () => {
    if (!takeReplyText.trim() || !currentUserId || !activeTake?.id) return;
    setSubmittingTakeReply(true);
    await supabase.from('room_take_replies').insert({
      take_id: activeTake.id,
      parent_reply_id: replyingToReplyId || null,
      user_id: currentUserId,
      content: takeReplyText.trim(),
    });
    // Increment reply_count on the take
    await supabase.from('room_takes')
      .update({ reply_count: (activeTake.reply_count || 0) + 1 })
      .eq('id', activeTake.id);
    setTakeReplyText('');
    setReplyingToReplyId(null);
    setSubmittingTakeReply(false);
    refetchReplies();
    refetchTakes();
  };

  const handleVoteTake = async (takeId: string, direction: 1 | -1) => {
    if (!currentUserId) return;
    const existing = (myTakeVotes || []).find((v: any) => v.take_id === takeId && !v.reply_id);
    const take = takes.find((t: any) => t.id === takeId);
    if (existing) {
      if (existing.vote === direction) {
        // Toggle off
        await supabase.from('room_take_votes').delete().eq('id', existing.id);
        await supabase.from('room_takes').update({ upvotes: Math.max(0, (take?.upvotes || 0) - 1) }).eq('id', takeId);
      } else {
        // Flip direction
        await supabase.from('room_take_votes').update({ vote: direction }).eq('id', existing.id);
        await supabase.from('room_takes').update({ upvotes: (take?.upvotes || 0) + (direction === 1 ? 2 : -2) }).eq('id', takeId);
      }
    } else {
      await supabase.from('room_take_votes').insert({ take_id: takeId, user_id: currentUserId, vote: direction });
      await supabase.from('room_takes').update({ upvotes: (take?.upvotes || 0) + direction }).eq('id', takeId);
    }
    refetchTakes();
    refetchMyVotes();
  };

  const handleVoteReply = async (replyId: string, direction: 1 | -1) => {
    if (!currentUserId) return;
    const existing = (myTakeVotes || []).find((v: any) => v.reply_id === replyId);
    const reply = activeThreadReplies.find((r: any) => r.id === replyId);
    const field = direction === 1 ? 'upvotes' : 'downvotes';
    if (existing) {
      if (existing.vote === direction) {
        await supabase.from('room_take_votes').delete().eq('id', existing.id);
        await supabase.from('room_take_replies').update({ [field]: Math.max(0, (reply?.[field] || 0) - 1) }).eq('id', replyId);
      } else {
        await supabase.from('room_take_votes').update({ vote: direction }).eq('id', existing.id);
        const prevField = direction === 1 ? 'downvotes' : 'upvotes';
        await supabase.from('room_take_replies').update({
          [field]: (reply?.[field] || 0) + 1,
          [prevField]: Math.max(0, (reply?.[prevField] || 0) - 1),
        }).eq('id', replyId);
      }
    } else {
      await supabase.from('room_take_votes').insert({ reply_id: replyId, user_id: currentUserId, vote: direction });
      await supabase.from('room_take_replies').update({ [field]: (reply?.[field] || 0) + 1 }).eq('id', replyId);
    }
    refetchReplies();
    refetchMyVotes();
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
    console.log('[add-pool-member] result:', JSON.stringify(result._notif || result._notif_error || 'no notif data'));
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

  const myName = (data?.members?.find((m: any) => m.user_id === session?.user?.id)?.users as any)?.display_name
    || (data?.members?.find((m: any) => m.user_id === session?.user?.id)?.users as any)?.user_name
    || 'Me';

  const openPicks = picks.filter(p => p.status !== 'resolved');
  const safePickIndex = Math.min(feedPickIndex, Math.max(0, openPicks.length - 1));
  const currentFeedPick = openPicks[safePickIndex] || null;
  const featuredPolls: any[] = data?.featured_polls || [];

  const isPartnerRoom = !!pool?.partner_name;
  const TABS = [
    { key: 'room', label: 'Room' },
    { key: 'play', label: 'Play' },
    { key: 'live', label: 'Live' },
    { key: 'stats', label: 'Stats' },
  ] as const;

  const handleManagePrompt = async (promptId: string, action: 'close' | 'delete') => {
    if (managingId) return;
    if (action === 'delete' && !confirm('Delete this pick permanently?')) return;
    setManagingId(promptId);
    const data = await callFn('manage-pool-prompt', { prompt_id: promptId, action }, token);
    setManagingId(null);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    refresh();
  };

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: '#f4f4f8' }}>
      {/* ── Unified gradient: nav bar + hero as one surface ── */}
      <div style={{ background: 'linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)' }}>
      <Navigation />

      {/* ── Purple gradient hero — top to tabs ── */}
      <div>
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

        {/* Room name + meta */}
        <div className="px-4 pb-3">
          <p className="text-white/40 text-[10px] font-medium uppercase tracking-widest mb-1">Room</p>
          <h1 className="text-white text-[22px] font-medium leading-tight mb-1.5 flex items-center gap-2 flex-wrap" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {isLoading ? '...' : pool?.name || 'Room'}
            {!isLoading && pool?.partner_name && (
              <span title="Official Partner Room" className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full shrink-0" style={{ marginTop: '1px', background: '#4f7ef7' }}>
                <Check size={12} className="text-white" strokeWidth={3} />
              </span>
            )}
          </h1>
          {!isLoading && pool?.media_type && (
            <div className="flex items-center gap-2 mb-2">
              <RoomMediaTypePill mediaType={pool.media_type} />
              {pool.series_volumes && (
                <span className="text-white/40 text-[11px]">{pool.series_volumes} volumes</span>
              )}
            </div>
          )}
          {/* Member count + visibility */}
          {!isLoading && (
            <div className="flex items-center gap-2">
              <span className="text-white/55 text-xs">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
              <span className="text-white/30 text-xs">·</span>
              <span className={`text-xs font-medium ${isPublic ? 'text-emerald-400' : 'text-white/40'}`}>
                {isPublic ? 'Public' : 'Private'}
              </span>
            </div>
          )}

          {/* Non-member join banner — public rooms */}
          {!isLoading && !isMember && isPublic && (
            <div className="mt-3">
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

        {/* Tabs at bottom of gradient */}
        <div className="flex px-4 border-b border-white/10">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
                tab === t.key ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'
              }`}
            >
              {t.key === 'live' ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="capitalize">Live</span>
                </span>
              ) : (
                t.label
              )}
            </button>
          ))}
        </div>
      </div>
      </div>{/* end unified gradient wrapper */}

      {/* ── Content ── */}
      <div className="px-4 pt-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-gray-200 animate-pulse" />)}
          </div>
        )}

        {/* ── LIVE — Coming Soon ── */}
        {!isLoading && tab === 'live' && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse block" />
            </div>
            <p className="text-gray-800 font-semibold text-base">Live is coming soon</p>
            <p className="text-gray-400 text-sm text-center max-w-xs leading-relaxed">Real-time watch parties, live reactions, and synchronized viewing experiences — all in one place.</p>
          </div>
        )}

        {/* ── ROOM — Fan room feed ── */}
        {!isLoading && tab === 'room' && (() => {
          const TAG_CONFIG: Record<string, { label: string; colorClass: string }> = {
            debate:     { label: 'Debate',      colorClass: 'text-rose-600 bg-rose-50' },
            ranking:    { label: 'Ranking',     colorClass: 'text-blue-600 bg-blue-50' },
            hot_take:   { label: 'Hot Take',    colorClass: 'text-orange-600 bg-orange-50' },
            question:   { label: 'Question',    colorClass: 'text-green-600 bg-green-50' },
            discussion: { label: 'Discussion',  colorClass: 'text-purple-600 bg-purple-50' },
          };

          // Happening Now: live predictions + high-velocity takes
          const livePolls = (featuredPolls || []).filter((p: any) => p.type === 'predict' || p.type === 'vote');
          const hotTakes = takes.filter((t: any) => (t.reply_count || 0) >= 1).slice(0, 3);
          const showHappeningNow = livePolls.length > 0 || hotTakes.length > 0;

          return (
            <div className="space-y-4">
              {/* ── Happening Now ── */}
              {showHappeningNow && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Happening Now</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                    {livePolls.slice(0, 2).map((poll: any) => (
                      <div key={poll.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                          <Vote size={12} className="text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 line-clamp-1">{poll.title}</p>
                          <p className="text-[10px] text-gray-400">{poll.total_participants || 0} votes</p>
                        </div>
                        <span className="text-[10px] text-purple-500 font-semibold shrink-0">Live</span>
                      </div>
                    ))}
                    {hotTakes.map((take: any) => {
                      const author = take.users?.display_name || take.users?.user_name || 'Fan';
                      return (
                        <button key={take.id} className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => setActiveTake(take)}>
                          <div className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                            <TrendingUp size={12} className="text-orange-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 line-clamp-1">{take.title}</p>
                            <p className="text-[10px] text-gray-400">{take.reply_count} replies · {author}</p>
                          </div>
                          <ChevronRight size={13} className="text-gray-300 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Featured Takes ── */}
              {takes.length > 0 && (() => {
                const featured = takes.slice(0, 3);
                const TAG_COLORS: Record<string, string> = {
                  debate: '#ef4444', hot_take: '#f97316', ranking: '#3b82f6',
                  question: '#10b981', discussion: '#8b5cf6',
                };
                return (
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #ede9fe', background: '#faf5ff' }}>
                    <div className="flex items-center gap-1.5 px-4 pt-3 pb-2">
                      <span className="text-xs">🔥</span>
                      <p className="text-[11px] font-bold text-purple-700 uppercase tracking-widest">Featured Takes</p>
                    </div>
                    <div className="divide-y divide-purple-100">
                      {featured.map((take: any, i: number) => {
                        const author = take.users?.display_name || take.users?.user_name || 'Fan';
                        const tag = take.tag || 'discussion';
                        const dotColor = TAG_COLORS[tag] || '#8b5cf6';
                        const preview = take.title.length > 72
                          ? take.title.slice(0, 72) + '…'
                          : take.title;
                        return (
                          <button
                            key={take.id}
                            onClick={() => setActiveTake(take)}
                            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-purple-50 transition-colors"
                          >
                            <div className="mt-0.5 w-2 h-2 rounded-full shrink-0" style={{ background: dotColor, marginTop: 5 }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-gray-700 leading-snug">{preview}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{author} · {take.reply_count || 0} replies</p>
                            </div>
                            <ChevronRight size={13} className="text-purple-300 shrink-0 mt-1" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ── Drop a Take composer prompt ── */}
              {isMember ? (
                <button
                  onClick={() => setIsTakeComposerOpen(true)}
                  className="w-full text-left"
                >
                  <div
                    className="w-full rounded-2xl px-4 py-3.5 flex items-center gap-3"
                    style={{ background: '#fff', border: '1.5px solid #e5e7eb', boxShadow: '0 1px 4px 0 rgba(0,0,0,0.05)' }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-purple-100">
                      <MessageSquare size={15} className="text-purple-500" />
                    </div>
                    <p className="flex-1 text-[13px] text-gray-400 leading-snug">
                      Something on your mind? Drop a take to start a thread
                    </p>
                    <span className="shrink-0 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
                      Take
                    </span>
                  </div>
                </button>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-4 px-4 text-center">
                  <p className="text-gray-400 text-sm">Join this room to drop takes</p>
                </div>
              )}

              {/* ── Takes list ── */}
              <div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Takes</p>
                  {takes.length > 0 && <span className="text-[11px] text-gray-400">{takes.length}</span>}
                </div>
                {takes.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-100">
                    <MessageSquare size={28} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm font-medium">No takes yet</p>
                    <p className="text-gray-400 text-xs mt-1">Start a debate, ranking, or hot take</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {takes.map((take: any) => {
                      const author = take.users?.display_name || take.users?.user_name || 'Fan';
                      const tagCfg = TAG_CONFIG[take.tag] || TAG_CONFIG.discussion;
                      const myVote = (myTakeVotes || []).find((v: any) => v.take_id === take.id && !v.reply_id);
                      const isHot = (take.reply_count || 0) >= 3;
                      return (
                        <div
                          key={take.id}
                          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                        >
                          {isHot && (
                            <div className="px-4 pt-2.5 pb-0 flex items-center gap-1.5">
                              <Flame size={11} className="text-orange-400" />
                              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Hot</span>
                            </div>
                          )}
                          <button
                            className="w-full px-4 pt-3 pb-2 text-left"
                            onClick={() => setActiveTake(take)}
                          >
                            <div className="flex items-start gap-2 mb-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${tagCfg.colorClass}`}>{tagCfg.label}</span>
                              <p className="text-gray-900 text-sm font-semibold leading-snug">{take.title}</p>
                            </div>
                            {take.body && (
                              <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 mb-2">{take.body}</p>
                            )}
                          </button>
                          <div className="flex items-center gap-3 px-4 pb-3">
                            <AvatarCircle name={author} size="sm" />
                            <span className="text-gray-500 text-xs">{author}</span>
                            <span className="text-gray-300 text-xs">·</span>
                            <span className="text-gray-400 text-xs">{timeAgo(take.created_at)}</span>
                            <div className="ml-auto flex items-center gap-3">
                              <button
                                onClick={() => setActiveTake(take)}
                                className="flex items-center gap-1 text-gray-400 hover:text-purple-600 transition-colors"
                              >
                                <MessageCircle size={13} />
                                <span className="text-[11px]">{take.reply_count || 0}</span>
                              </button>
                              <button
                                onClick={() => handleVoteTake(take.id, 1)}
                                className={`flex items-center gap-1 transition-colors ${myVote?.vote === 1 ? 'text-purple-600' : 'text-gray-400 hover:text-purple-500'}`}
                              >
                                <ArrowUp size={13} />
                                <span className="text-[11px]">{take.upvotes || 0}</span>
                              </button>
                              {(session?.user?.id === take.user_id || isHost) && (
                                <button
                                  onClick={async () => {
                                    await supabase.from('room_takes').delete().eq('id', take.id);
                                    refetchTakes();
                                  }}
                                  className="text-gray-300 hover:text-rose-400 transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Ratings & Reviews ── */}
              {roomReviews.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-1 mb-2">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Ratings & Reviews</p>
                    {roomReviews.length > 3 && (
                      <button onClick={() => setReviewsExpanded(v => !v)} className="text-[11px] text-purple-500">
                        {reviewsExpanded ? 'Show less' : `See all ${roomReviews.length}`}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {(reviewsExpanded ? roomReviews : roomReviews.slice(0, 3)).map((post: any) => {
                      const author = post.users?.display_name || post.users?.user_name || 'Fan';
                      return (
                        <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <AvatarCircle name={author} size="sm" />
                            <span className="text-xs font-semibold text-gray-900">{author}</span>
                            {post.rating && (
                              <div className="flex items-center gap-0.5 ml-auto">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} size={10} className={i < Math.round(post.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                                ))}
                                <span className="text-[10px] text-gray-500 ml-1">{post.rating}/5</span>
                              </div>
                            )}
                          </div>
                          <p className="text-gray-700 text-xs leading-relaxed line-clamp-3">{post.content}</p>
                          <p className="text-gray-400 text-[10px] mt-1.5">{timeAgo(post.created_at)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── PLAY ── */}
        {!isLoading && tab === 'play' && (
          <PlayTab
            featuredPolls={featuredPolls}
            picks={picks}
            token={token}
            isHost={isHost}
            poolId={params.id}
            onRefresh={refresh}
            managingId={managingId}
            onManagePick={handleManagePrompt}
          />
        )}

        {/* ── STATS — Coming Soon ── */}
        {!isLoading && tab === 'stats' && (
          <div className="space-y-4">
            {/* Stats placeholder */}
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mb-1">
                <BarChart2 size={22} className="text-purple-400" />
              </div>
              <p className="text-gray-800 font-semibold text-base">Stats coming soon</p>
              <p className="text-gray-400 text-sm text-center max-w-xs leading-relaxed">Fan rankings, engagement streaks, top contributors, and room heat maps — all on their way.</p>
            </div>

            {/* Host Settings */}
            {isHost && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Room Settings</p>
                <div className="space-y-3">
                  {/* Visibility */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Visibility</p>
                      <p className="text-xs text-gray-400">{isPublic ? 'Anyone can discover this room' : 'Only invited members can join'}</p>
                    </div>
                    <button
                      onClick={() => handleToggleVisibility(!isPublic)}
                      disabled={togglingVisibility}
                      className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-purple-600' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Series Tag */}
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-0.5">Show / Series tag</p>
                    <p className="text-xs text-gray-400 mb-2">Polls and trivia tagged with this show auto-appear in the Play tab.</p>
                    {editSeriesTag !== null ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editSeriesTag}
                          onChange={e => setEditSeriesTag(e.target.value)}
                          placeholder="e.g. Friends"
                          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-400"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveSettings}
                          disabled={savingSettings}
                          className="px-3 py-2 rounded-xl text-sm font-semibold text-white bg-purple-600 disabled:opacity-50"
                        >
                          {savingSettings ? '…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditSeriesTag(null)}
                          className="px-3 py-2 rounded-xl text-sm text-gray-400 border border-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditSeriesTag(pool?.series_tag || '')}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-dashed border-gray-200 text-sm text-left"
                      >
                        <span className="flex-1 text-gray-700">{pool?.series_tag || <span className="text-gray-400">Not set</span>}</span>
                        <span className="text-purple-500 text-xs font-medium">Edit</span>
                      </button>
                    )}
                  </div>

                  {/* Invite Link */}
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-2">Invite link</p>
                    <button
                      onClick={handleCopyLink}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-left"
                    >
                      <span className="flex-1 text-gray-400 truncate text-xs font-mono">{`/room/join/${pool?.invite_code}`}</span>
                      <span className="text-purple-500 text-xs font-medium shrink-0">{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>


      {/* ── Take Composer Sheet ── */}
      {isTakeComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setIsTakeComposerOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-white rounded-t-3xl shadow-2xl p-5 pb-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <p className="text-base font-bold text-gray-900 mb-4">Drop a Take</p>

            {/* Tag selector */}
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Type</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {([
                { key: 'debate',     label: 'Debate',      color: 'rose' },
                { key: 'ranking',    label: 'Ranking',     color: 'blue' },
                { key: 'hot_take',   label: 'Hot Take',    color: 'orange' },
                { key: 'question',   label: 'Question',    color: 'green' },
                { key: 'discussion', label: 'Discussion',  color: 'purple' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setNewTakeTag(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    newTakeTag === key
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Title */}
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Your take *</p>
            <textarea
              value={newTakeTitle}
              onChange={e => setNewTakeTitle(e.target.value)}
              placeholder={
                newTakeTag === 'debate'    ? 'e.g. Ross was NOT on a break'      :
                newTakeTag === 'ranking'   ? 'e.g. Rank every season from best to worst' :
                newTakeTag === 'hot_take'  ? 'e.g. Season 8 is actually the best'  :
                newTakeTag === 'question'  ? 'e.g. Best cold open ever?'           :
                'e.g. What did everyone think of the finale?'
              }
              rows={2}
              maxLength={200}
              className="w-full px-3 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 resize-none mb-3"
            />

            {/* Optional body */}
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">More context <span className="text-gray-300 font-normal normal-case">(optional)</span></p>
            <textarea
              value={newTakeBody}
              onChange={e => setNewTakeBody(e.target.value)}
              placeholder="Add more detail, context, or your full argument…"
              rows={3}
              className="w-full px-3 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 resize-none mb-4"
            />

            {/* Spoiler toggle */}
            <button
              type="button"
              onClick={() => setNewTakeSpoiler(v => !v)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border mb-4 transition-colors ${
                newTakeSpoiler
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">⚠️</span>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${newTakeSpoiler ? 'text-amber-700' : 'text-gray-700'}`}>Contains spoilers</p>
                  <p className="text-xs text-gray-400">Readers will see a warning first</p>
                </div>
              </div>
              <div className={`w-10 h-5.5 rounded-full relative transition-colors ${newTakeSpoiler ? 'bg-amber-400' : 'bg-gray-200'}`} style={{ width: 40, height: 22 }}>
                <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${newTakeSpoiler ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} style={{ width: 18, height: 18, top: 2 }} />
              </div>
            </button>

            <button
              onClick={handleSubmitTake}
              disabled={!newTakeTitle.trim() || submittingTake}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-purple-600 disabled:opacity-40 transition-opacity"
            >
              {submittingTake ? 'Posting…' : 'Post Take'}
            </button>
          </div>
        </div>
      )}

      {/* ── Take Thread Sheet ── */}
      {activeTake && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => { setActiveTake(null); setTakeReplyText(''); setReplyingToReplyId(null); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-0 shrink-0" />

            {/* Thread header */}
            <div className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
              {(() => {
                const TAG_CONFIG: Record<string, { label: string; colorClass: string }> = {
                  debate:     { label: 'Debate',      colorClass: 'text-rose-600 bg-rose-50' },
                  ranking:    { label: 'Ranking',     colorClass: 'text-blue-600 bg-blue-50' },
                  hot_take:   { label: 'Hot Take',    colorClass: 'text-orange-600 bg-orange-50' },
                  question:   { label: 'Question',    colorClass: 'text-green-600 bg-green-50' },
                  discussion: { label: 'Discussion',  colorClass: 'text-purple-600 bg-purple-50' },
                };
                const tagCfg = TAG_CONFIG[activeTake.tag] || TAG_CONFIG.discussion;
                const author = activeTake.users?.display_name || activeTake.users?.user_name || 'Fan';
                return (
                  <>
                    <div className="flex items-start gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${tagCfg.colorClass}`}>{tagCfg.label}</span>
                      <p className="text-gray-900 text-base font-bold leading-snug">{activeTake.title}</p>
                    </div>
                    {activeTake.body && <p className="text-gray-600 text-sm leading-relaxed mb-2">{activeTake.body}</p>}
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <AvatarCircle name={author} size="sm" />
                      <span className="font-medium text-gray-600">{author}</span>
                      <span>·</span>
                      <span>{timeAgo(activeTake.created_at)}</span>
                      <button
                        onClick={() => handleVoteTake(activeTake.id, 1)}
                        className={`ml-auto flex items-center gap-1 ${(myTakeVotes || []).find((v: any) => v.take_id === activeTake.id && !v.reply_id)?.vote === 1 ? 'text-purple-600' : 'text-gray-400'}`}
                      >
                        <ArrowUp size={13} /><span>{activeTake.upvotes || 0}</span>
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Replies list */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {activeThreadReplies.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle size={24} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No replies yet — jump in!</p>
                </div>
              )}
              {activeThreadReplies.map((reply: any) => {
                const author = reply.users?.display_name || reply.users?.user_name || 'Fan';
                const myVote = (myTakeVotes || []).find((v: any) => v.reply_id === reply.id);
                const isNested = !!reply.parent_reply_id;
                const parentReply = isNested ? activeThreadReplies.find((r: any) => r.id === reply.parent_reply_id) : null;
                const parentAuthor = parentReply?.users?.display_name || parentReply?.users?.user_name;
                return (
                  <div key={reply.id} className={`${isNested ? 'ml-6 border-l-2 border-purple-100 pl-3' : ''}`}>
                    {isNested && parentAuthor && (
                      <p className="text-[10px] text-gray-400 mb-0.5">↩ replying to {parentAuthor}</p>
                    )}
                    <div className="flex items-start gap-2">
                      <AvatarCircle name={author} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-semibold text-gray-800">{author}</span>
                          <span className="text-[10px] text-gray-400">{timeAgo(reply.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{reply.content}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <button
                            onClick={() => handleVoteReply(reply.id, 1)}
                            className={`flex items-center gap-0.5 text-xs transition-colors ${myVote?.vote === 1 ? 'text-purple-600' : 'text-gray-400 hover:text-purple-500'}`}
                          >
                            <ArrowUp size={12} />{reply.upvotes || 0}
                          </button>
                          <button
                            onClick={() => handleVoteReply(reply.id, -1)}
                            className={`flex items-center gap-0.5 text-xs transition-colors ${myVote?.vote === -1 ? 'text-rose-500' : 'text-gray-400 hover:text-rose-400'}`}
                          >
                            <ArrowDown size={12} />{reply.downvotes || 0}
                          </button>
                          {isMember && (
                            <button
                              onClick={() => setReplyingToReplyId(reply.id)}
                              className="text-xs text-gray-400 hover:text-purple-500"
                            >
                              Reply
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reply input */}
            {isMember && (
              <div className="px-4 py-3 border-t border-gray-100 shrink-0 bg-white">
                {replyingToReplyId && (
                  <div className="flex items-center gap-1 mb-1.5">
                    <span className="text-[10px] text-gray-400">Replying to a comment</span>
                    <button onClick={() => setReplyingToReplyId(null)} className="text-[10px] text-purple-500 ml-1">Cancel</button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={takeReplyText}
                    onChange={e => setTakeReplyText(e.target.value)}
                    placeholder="Jump in…"
                    rows={1}
                    className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 resize-none"
                  />
                  <button
                    onClick={handleSubmitTakeReply}
                    disabled={!takeReplyText.trim() || submittingTakeReply}
                    className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center disabled:opacity-40 shrink-0"
                  >
                    <Send size={15} className="text-white" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <QuickActionSheet
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        roomId={params.id}
        onPosted={() => {
          setIsComposerOpen(false);
          refetchRoomPosts();
        }}
      />
    </div>
  );
}
