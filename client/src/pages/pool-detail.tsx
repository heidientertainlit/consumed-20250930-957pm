import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Copy, Check, Crown, Users, Lock, ChevronDown, ChevronRight, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

async function callFn(name: string, body: unknown, token: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

function AddRoundSheet({ poolId, token, onClose, onCreated }: { poolId: string; token: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [lockTime, setLockTime] = useState('');
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => callFn('create-pool-round', { pool_id: poolId, title, lock_time: lockTime || undefined }, token),
    onSuccess: (data) => {
      if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
      onCreated();
      onClose();
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white font-semibold text-lg">New Round</h2>
          <button onClick={onClose}><X size={20} className="text-white/50" /></button>
        </div>
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wide mb-1 block">Round Title</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Episode 3, Week 2..." className="bg-white/10 border-white/20 text-white placeholder:text-white/30" autoFocus />
        </div>
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wide mb-1 block">Lock Time (optional)</label>
          <Input type="datetime-local" value={lockTime} onChange={e => setLockTime(e.target.value)} className="bg-white/10 border-white/20 text-white [color-scheme:dark]" />
          <p className="text-white/30 text-xs mt-1">Members cannot answer after this time</p>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={!title.trim() || mutation.isPending} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
          {mutation.isPending ? 'Creating...' : 'Create Round'}
        </Button>
      </div>
    </div>
  );
}

function AddPromptSheet({ roundId, token, onClose, onCreated }: { roundId: string; token: string; onClose: () => void; onCreated: () => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => callFn('add-pool-prompt', { round_id: roundId, question, options: options.filter(o => o.trim()) }, token),
    onSuccess: (data) => {
      if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
      onCreated();
      onClose();
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-[#1a1a2e] rounded-t-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white font-semibold text-lg">Add Question</h2>
          <button onClick={onClose}><X size={20} className="text-white/50" /></button>
        </div>
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wide mb-1 block">Question</label>
          <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Who gets eliminated this week?" className="bg-white/10 border-white/20 text-white placeholder:text-white/30" autoFocus />
        </div>
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wide mb-1 block">Answer Options</label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input value={opt} onChange={e => { const next = [...options]; next[i] = e.target.value; setOptions(next); }} placeholder={`Option ${i + 1}`} className="bg-white/10 border-white/20 text-white placeholder:text-white/30" />
                {options.length > 2 && (
                  <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-white/40 hover:text-white/70"><X size={16} /></button>
                )}
              </div>
            ))}
          </div>
          {options.length < 4 && (
            <button onClick={() => setOptions([...options, ''])} className="mt-2 text-purple-400 text-sm hover:text-purple-300 flex items-center gap-1">
              <Plus size={14} /> Add option
            </button>
          )}
        </div>
        <Button onClick={() => mutation.mutate()} disabled={!question.trim() || options.filter(o => o.trim()).length < 2 || mutation.isPending} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
          {mutation.isPending ? 'Adding...' : 'Add Question'}
        </Button>
      </div>
    </div>
  );
}

function PromptCard({ prompt, isHost, token, onResolved }: { prompt: any; isHost: boolean; token: string; onResolved: () => void }) {
  const { toast } = useToast();
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submitAnswer = async (answer: string) => {
    setSubmitting(true);
    const data = await callFn('submit-pool-answer', { prompt_id: prompt.id, answer }, token);
    setSubmitting(false);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    onResolved();
  };

  const resolvePrompt = async (answer: string) => {
    const data = await callFn('resolve-pool-prompt', { prompt_id: prompt.id, correct_answer: answer }, token);
    if (data.error) { toast({ title: data.error, variant: 'destructive' }); return; }
    setResolving(false);
    onResolved();
    toast({ title: `Resolved! ${data.winners_count} correct` });
  };

  const isResolved = prompt.status === 'resolved';
  const userAnswer = prompt.user_answer?.answer;
  const isCorrect = prompt.user_answer?.is_correct;
  const options: string[] = prompt.options || [];

  return (
    <div className="bg-white/5 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-white/90 text-sm font-medium leading-snug">{prompt.prompt_text}</p>
        {isResolved && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full shrink-0">Resolved</span>}
      </div>

      {isResolved && prompt.correct_answer && (
        <p className="text-xs text-green-400">Answer: {prompt.correct_answer}</p>
      )}

      {!isResolved && !resolving && (
        <div className="space-y-1.5">
          {options.map((opt) => {
            const selected = userAnswer === opt;
            return (
              <button
                key={opt}
                onClick={() => !userAnswer && submitAnswer(opt)}
                disabled={submitting || !!userAnswer}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                  selected
                    ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {isResolved && userAnswer && (
        <div className={`text-xs px-2 py-1 rounded ${isCorrect ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          Your pick: {userAnswer} {isCorrect ? '— Correct!' : '— Incorrect'}
        </div>
      )}

      {isHost && !isResolved && (
        resolving ? (
          <div className="space-y-1.5 pt-1 border-t border-white/10">
            <p className="text-white/40 text-xs">Tap the correct answer:</p>
            {options.map((opt) => (
              <button key={opt} onClick={() => resolvePrompt(opt)} className="w-full text-left text-sm px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20">
                {opt}
              </button>
            ))}
            <button onClick={() => setResolving(false)} className="text-white/30 text-xs hover:text-white/50">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setResolving(true)} className="text-xs text-white/30 hover:text-purple-400 transition-colors">
            Mark answer
          </button>
        )
      )}
    </div>
  );
}

function RoundCard({ round, isHost, token, onRefresh }: { round: any; isHost: boolean; token: string; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [showAddPrompt, setShowAddPrompt] = useState(false);

  const prompts: any[] = round.prompts || [];
  const isLocked = round.status === 'locked' || round.status === 'resolved';

  return (
    <>
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold text-sm">{round.title}</h3>
            {isLocked && <Lock size={12} className="text-white/30" />}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-xs">{prompts.length} questions</span>
            {expanded ? <ChevronDown size={16} className="text-white/40" /> : <ChevronRight size={16} className="text-white/40" />}
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-2">
            {prompts.length === 0 && (
              <p className="text-white/30 text-sm text-center py-4">No questions yet</p>
            )}
            {prompts.map((prompt: any) => (
              <PromptCard key={prompt.id} prompt={prompt} isHost={isHost} token={token} onResolved={onRefresh} />
            ))}
            {isHost && !isLocked && (
              <button onClick={() => setShowAddPrompt(true)} className="w-full flex items-center justify-center gap-1.5 text-purple-400 text-sm py-2 hover:text-purple-300 border border-dashed border-purple-500/30 rounded-lg">
                <Plus size={14} /> Add question
              </button>
            )}
            {round.lock_time && (
              <p className="text-white/25 text-xs text-center">Locks {new Date(round.lock_time).toLocaleString()}</p>
            )}
          </div>
        )}
      </div>

      {showAddPrompt && (
        <AddPromptSheet roundId={round.id} token={token} onClose={() => setShowAddPrompt(false)} onCreated={onRefresh} />
      )}
    </>
  );
}

export default function PoolDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'rounds' | 'leaderboard' | 'members'>('rounds');
  const [showAddRound, setShowAddRound] = useState(false);
  const [copied, setCopied] = useState(false);

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
    const link = `${appUrl}/pool/join/${data?.pool?.invite_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Invite link copied!' });
  };

  const pool = data?.pool;
  const rounds: any[] = data?.rounds || [];
  const members: any[] = data?.members || [];
  const isHost = data?.is_host || false;

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-24">
      <div style={{ background: 'linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setLocation('/pools')} className="text-white/70 hover:text-white transition-colors">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-2xl font-semibold text-white truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {isLoading ? 'Loading...' : (pool?.name || 'Pool')}
            </h1>
          </div>

          <div className="flex gap-2">
            {isHost && (
              <Button onClick={() => setShowAddRound(true)} className="bg-purple-600 hover:bg-purple-700 text-white text-sm h-9">
                <Plus size={14} className="mr-1" /> New Round
              </Button>
            )}
            <Button onClick={handleCopyLink} variant="outline" className="border-white/20 text-white bg-transparent hover:bg-white/10 text-sm h-9">
              {copied ? <Check size={14} className="mr-1 text-green-400" /> : <Copy size={14} className="mr-1" />}
              {copied ? 'Copied!' : 'Invite'}
            </Button>
          </div>
        </div>

        <div className="flex px-4 gap-1 pb-1">
          {(['rounds', 'leaderboard', 'members'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        )}

        {!isLoading && tab === 'rounds' && (
          <div className="space-y-3">
            {rounds.length === 0 && (
              <div className="text-center py-12">
                <p className="text-white/40 text-sm">{isHost ? 'Create the first round to get started.' : 'No rounds yet. The host will create one soon.'}</p>
                {isHost && (
                  <Button onClick={() => setShowAddRound(true)} className="mt-4 bg-purple-600 hover:bg-purple-700 text-white">
                    <Plus size={14} className="mr-1" /> Create First Round
                  </Button>
                )}
              </div>
            )}
            {rounds.map(round => (
              <RoundCard key={round.id} round={round} isHost={isHost} token={session?.access_token || ''} onRefresh={refresh} />
            ))}
          </div>
        )}

        {!isLoading && tab === 'leaderboard' && (
          <div className="space-y-2">
            {members.length === 0 && <p className="text-white/40 text-sm text-center py-12">No scores yet</p>}
            {[...members].sort((a, b) => (b.total_points || 0) - (a.total_points || 0)).map((m: any, i) => (
              <div key={m.user_id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
                <span className={`text-sm font-bold w-6 text-center ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-white/40'}`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{(m.users as any)?.display_name || (m.users as any)?.user_name || 'Member'}</p>
                </div>
                <div className="flex items-center gap-1">
                  {m.role === 'host' && <Crown size={12} className="text-yellow-400" />}
                  <span className="text-purple-400 font-semibold text-sm">{m.total_points || 0} pts</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && tab === 'members' && (
          <div className="space-y-2">
            {members.map((m: any) => (
              <div key={m.user_id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center text-purple-300 text-xs font-semibold">
                  {((m.users as any)?.display_name || (m.users as any)?.user_name || '?')[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{(m.users as any)?.display_name || (m.users as any)?.user_name || 'Member'}</p>
                  {m.role === 'host' && <p className="text-yellow-400 text-xs">Host</p>}
                </div>
                <span className="text-white/40 text-sm">{m.total_points || 0} pts</span>
              </div>
            ))}
            <div className="pt-2">
              <Button onClick={handleCopyLink} variant="outline" className="w-full border-white/20 text-white/70 bg-transparent hover:bg-white/10">
                <Copy size={14} className="mr-2" /> Copy invite link
              </Button>
            </div>
          </div>
        )}
      </div>

      {showAddRound && (
        <AddRoundSheet poolId={params.id} token={session?.access_token || ''} onClose={() => setShowAddRound(false)} onCreated={refresh} />
      )}

      <Navigation />
    </div>
  );
}
