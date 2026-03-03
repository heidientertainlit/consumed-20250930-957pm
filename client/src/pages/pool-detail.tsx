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
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl p-6 space-y-4 pb-28" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />
        <div className="flex items-center justify-between">
          <h2 className="text-gray-900 font-semibold text-lg">New Round</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={16} className="text-gray-500" /></button>
        </div>
        <div>
          <label className="text-gray-500 text-xs uppercase tracking-widest mb-2 block">Round Title</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Episode 3, Week 2..." className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-2xl h-12" autoFocus />
        </div>
        <div>
          <label className="text-gray-500 text-xs uppercase tracking-widest mb-2 block">Lock Time (optional)</label>
          <Input type="datetime-local" value={lockTime} onChange={e => setLockTime(e.target.value)} className="bg-gray-50 border-gray-200 text-gray-900 [color-scheme:light] rounded-2xl h-12" />
          <p className="text-gray-400 text-xs mt-1.5">Members cannot answer after this time</p>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={!title.trim() || mutation.isPending} className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-2xl h-12 text-base font-semibold">
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
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto pb-28" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />
        <div className="flex items-center justify-between">
          <h2 className="text-gray-900 font-semibold text-lg">Add Question</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={16} className="text-gray-500" /></button>
        </div>
        <div>
          <label className="text-gray-500 text-xs uppercase tracking-widest mb-2 block">Question</label>
          <Input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Who gets eliminated this week?" className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-2xl h-12" autoFocus />
        </div>
        <div>
          <label className="text-gray-500 text-xs uppercase tracking-widest mb-2 block">Answer Options</label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input value={opt} onChange={e => { const next = [...options]; next[i] = e.target.value; setOptions(next); }} placeholder={`Option ${i + 1}`} className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-2xl h-11" />
                {options.length > 2 && (
                  <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                )}
              </div>
            ))}
          </div>
          {options.length < 4 && (
            <button onClick={() => setOptions([...options, ''])} className="mt-2.5 text-purple-600 text-sm hover:text-purple-700 flex items-center gap-1">
              <Plus size={14} /> Add option
            </button>
          )}
        </div>
        <Button onClick={() => mutation.mutate()} disabled={!question.trim() || options.filter(o => o.trim()).length < 2 || mutation.isPending} className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-2xl h-12 text-base font-semibold">
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
    <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
      <div className="flex items-start justify-between gap-2">
        <p className="text-gray-800 text-sm font-medium leading-snug">{prompt.prompt_text}</p>
        {isResolved && <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full shrink-0">Resolved</span>}
      </div>

      {isResolved && prompt.correct_answer && (
        <p className="text-xs text-green-600">Answer: {prompt.correct_answer}</p>
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
                className={`w-full text-left text-sm px-3 py-2 rounded-xl border transition-colors ${
                  selected
                    ? 'bg-purple-100 border-purple-400 text-purple-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {isResolved && userAnswer && (
        <div className={`text-xs px-2 py-1 rounded-lg ${isCorrect ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
          Your pick: {userAnswer} {isCorrect ? '— Correct!' : '— Incorrect'}
        </div>
      )}

      {isHost && !isResolved && (
        resolving ? (
          <div className="space-y-1.5 pt-1 border-t border-gray-100">
            <p className="text-gray-400 text-xs">Tap the correct answer:</p>
            {options.map((opt) => (
              <button key={opt} onClick={() => resolvePrompt(opt)} className="w-full text-left text-sm px-3 py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 hover:bg-green-100">
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-gray-900 font-semibold text-sm">{round.title}</h3>
            {isLocked && <Lock size={12} className="text-gray-300" />}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">{prompts.length} questions</span>
            {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-2">
            {prompts.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No questions yet</p>
            )}
            {prompts.map((prompt: any) => (
              <PromptCard key={prompt.id} prompt={prompt} isHost={isHost} token={token} onResolved={onRefresh} />
            ))}
            {isHost && !isLocked && (
              <button onClick={() => setShowAddPrompt(true)} className="w-full flex items-center justify-center gap-1.5 text-purple-500 text-sm py-2.5 hover:text-purple-600 border border-dashed border-purple-300 rounded-xl">
                <Plus size={14} /> Add question
              </button>
            )}
            {round.lock_time && (
              <p className="text-gray-400 text-xs text-center">Locks {new Date(round.lock_time).toLocaleString()}</p>
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
    <div className="min-h-screen bg-gray-50 pb-24">
      <div style={{ background: 'linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="px-4 pt-4 pb-8">
          <button onClick={() => setLocation('/pools')} className="text-white/70 hover:text-white transition-colors mb-3 block">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-semibold text-white mb-5" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {isLoading ? 'Loading...' : (pool?.name || 'Pool')}
          </h1>
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
      </div>

      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-1.5 mb-4">
          {(['rounds', 'leaderboard', 'members'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-0">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-gray-200 animate-pulse" />)}
          </div>
        )}

        {!isLoading && tab === 'rounds' && (
          <div className="space-y-3">
            {rounds.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm">{isHost ? 'Create the first round to get started.' : 'No rounds yet. The host will create one soon.'}</p>
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
            {members.length === 0 && <p className="text-gray-400 text-sm text-center py-12">No scores yet</p>}
            {[...members].sort((a, b) => (b.total_points || 0) - (a.total_points || 0)).map((m: any, i) => (
              <div key={m.user_id} className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
                <span className={`text-sm font-bold w-6 text-center ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-300'}`}>{i + 1}</span>
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

        {!isLoading && tab === 'members' && (
          <div className="space-y-2">
            {members.map((m: any) => (
              <div key={m.user_id} className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-semibold">
                  {((m.users as any)?.display_name || (m.users as any)?.user_name || '?')[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 text-sm font-medium truncate">{(m.users as any)?.display_name || (m.users as any)?.user_name || 'Member'}</p>
                  {m.role === 'host' && <p className="text-yellow-600 text-xs">Host</p>}
                </div>
                <span className="text-gray-400 text-sm">{m.total_points || 0} pts</span>
              </div>
            ))}
            <div className="pt-2">
              <Button onClick={handleCopyLink} variant="outline" className="w-full border-gray-200 text-gray-600 bg-white hover:bg-gray-50">
                <Copy size={14} className="mr-2" /> Copy invite link
              </Button>
            </div>
          </div>
        )}
      </div>

      {showAddRound && (
        <AddRoundSheet poolId={params.id} token={session?.access_token || ''} onClose={() => setShowAddRound(false)} onCreated={refresh} />
      )}

      <Navigation hideTopBar />
    </div>
  );
}
