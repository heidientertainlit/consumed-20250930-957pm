import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Users, Trophy, Clock, Copy, Check, Plus, Loader2, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import Navigation from '@/components/navigation';

interface Prompt {
  id: string;
  prompt_text: string;
  prompt_type: string;
  options: string[] | null;
  points_value: number;
  deadline: string | null;
  status: string;
  correct_answer: string | null;
  resolved_at: string | null;
  user_answer: {
    answer: string;
    is_correct: boolean | null;
    points_earned: number | null;
    submitted_at: string;
  } | null;
}

interface Member {
  user_id: string;
  role: string;
  total_points: number;
  joined_at: string;
  users: {
    id: string;
    user_name: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface PoolDetail {
  pool: {
    id: string;
    name: string;
    description: string | null;
    invite_code: string;
    status: string;
    category: string | null;
    deadline: string | null;
    is_public: boolean;
    created_at: string;
    host: {
      id: string;
      user_name: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
  prompts: Prompt[];
  members: Member[];
  is_host: boolean;
  is_member: boolean;
  user_role: string | null;
}

export default function PoolDetailPage() {
  const params = useParams<{ id: string }>();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [copiedCode, setCopiedCode] = useState(false);
  const [isAddPromptOpen, setIsAddPromptOpen] = useState(false);
  const [newPromptText, setNewPromptText] = useState('');
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resolveAnswers, setResolveAnswers] = useState<Record<string, string>>({});
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  const { data: poolData, isLoading, error } = useQuery<PoolDetail>({
    queryKey: ['pool-detail', params.id],
    queryFn: async () => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-pool-details`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pool_id: params.id }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch pool');
      }
      return response.json();
    },
    enabled: !!session?.access_token && !!params.id,
  });

  const addPromptMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-pool-prompt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pool_id: params.id,
            prompt_text: newPromptText,
            prompt_type: 'free_text',
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add prompt');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool-detail', params.id] });
      setIsAddPromptOpen(false);
      setNewPromptText('');
      toast({ title: 'Prompt added!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async ({ promptId, answer }: { promptId: string; answer: string }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-pool-answer`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt_id: promptId, answer }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit answer');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pool-detail', params.id] });
      setAnswers(prev => ({ ...prev, [variables.promptId]: '' }));
      toast({ title: 'Answer submitted!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resolvePromptMutation = useMutation({
    mutationFn: async ({ promptId, correctAnswer }: { promptId: string; correctAnswer: string }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-pool-prompt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt_id: promptId, correct_answer: correctAnswer }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resolve prompt');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pool-detail', params.id] });
      setResolveAnswers(prev => ({ ...prev, [variables.promptId]: '' }));
      toast({ 
        title: 'Prompt resolved!', 
        description: `${data.winners_count} winner(s) awarded ${data.points_awarded} points` 
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const togglePrompt = (promptId: string) => {
    setExpandedPrompts(prev => {
      const next = new Set(prev);
      if (next.has(promptId)) {
        next.delete(promptId);
      } else {
        next.add(promptId);
      }
      return next;
    });
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e]">
        <Navigation />
        <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center">
          <p className="text-gray-400">Sign in to view this pool</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e]">
        <Navigation />
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-purple-500" size={32} />
        </div>
      </div>
    );
  }

  if (error || !poolData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e]">
        <Navigation />
        <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center">
          <p className="text-gray-400 mb-4">{(error as Error)?.message || 'Pool not found'}</p>
          <Button onClick={() => setLocation('/pools')} variant="outline">
            Back to Pools
          </Button>
        </div>
      </div>
    );
  }

  const { pool, prompts, members, is_host } = poolData;
  const openPrompts = prompts.filter(p => p.status === 'open');
  const resolvedPrompts = prompts.filter(p => p.status === 'resolved');

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e] pb-24">
      <Navigation />

      <div className="max-w-2xl mx-auto px-4 pt-4">
        <button onClick={() => setLocation('/pools')} className="flex items-center gap-1 text-gray-400 hover:text-white mb-4">
          <ArrowLeft size={18} />
          <span>Back to Pools</span>
        </button>

        <div className="bg-[#1a1a2e] rounded-xl p-4 border border-gray-700/50 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-white">{pool.name}</h1>
              {pool.description && <p className="text-sm text-gray-400 mt-1">{pool.description}</p>}
            </div>
            <span className={`px-2 py-1 text-xs rounded ${
              pool.status === 'open' ? 'bg-green-500/20 text-green-400' :
              pool.status === 'locked' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {pool.status.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
            <span className="flex items-center gap-1">
              <Users size={14} />
              {members.length} members
            </span>
            <span>{prompts.length} prompts</span>
            {pool.host && (
              <span>Host: {pool.host.display_name || pool.host.user_name}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#0a0a0f] rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-gray-400 text-sm">Invite Code:</span>
              <span className="font-mono text-white font-bold">{pool.invite_code}</span>
            </div>
            <Button
              onClick={() => copyInviteCode(pool.invite_code)}
              size="sm"
              variant="outline"
              className="border-purple-500 text-purple-400"
            >
              {copiedCode ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
        </div>

        {is_host && pool.status === 'open' && (
          <Dialog open={isAddPromptOpen} onOpenChange={setIsAddPromptOpen}>
            <DialogTrigger asChild>
              <Button className="w-full mb-4 bg-purple-600 hover:bg-purple-700">
                <Plus size={16} className="mr-2" />
                Add Prompt
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1a1a2e] border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-white">Add a Prompt</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Textarea
                  placeholder="What's your prediction or question?"
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  className="bg-[#0a0a0f] border-gray-600 text-white resize-none"
                  rows={3}
                />
                <Button
                  onClick={() => addPromptMutation.mutate()}
                  disabled={!newPromptText.trim() || addPromptMutation.isPending}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {addPromptMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                  Add Prompt
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {openPrompts.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Clock size={18} className="text-yellow-400" />
              Open Prompts
            </h2>
            <div className="space-y-3">
              {openPrompts.map((prompt) => (
                <div key={prompt.id} className="bg-[#1a1a2e] rounded-xl border border-gray-700/50 overflow-hidden">
                  <button
                    onClick={() => togglePrompt(prompt.id)}
                    className="w-full p-4 flex items-start justify-between text-left"
                  >
                    <div className="flex-1">
                      <p className="text-white font-medium">{prompt.prompt_text}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Trophy size={12} className="text-amber-400" />
                          {prompt.points_value} pts
                        </span>
                        {prompt.user_answer && (
                          <span className="text-green-400">You answered</span>
                        )}
                      </div>
                    </div>
                    {expandedPrompts.has(prompt.id) ? (
                      <ChevronUp size={20} className="text-gray-500" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-500" />
                    )}
                  </button>

                  {expandedPrompts.has(prompt.id) && (
                    <div className="px-4 pb-4 border-t border-gray-700/50 pt-3">
                      {prompt.user_answer ? (
                        <div className="bg-[#0a0a0f] rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Your answer:</p>
                          <p className="text-white">{prompt.user_answer.answer}</p>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Your answer..."
                            value={answers[prompt.id] || ''}
                            onChange={(e) => setAnswers(prev => ({ ...prev, [prompt.id]: e.target.value }))}
                            className="bg-[#0a0a0f] border-gray-600 text-white flex-1"
                          />
                          <Button
                            onClick={() => submitAnswerMutation.mutate({ promptId: prompt.id, answer: answers[prompt.id] || '' })}
                            disabled={!answers[prompt.id]?.trim() || submitAnswerMutation.isPending}
                            size="icon"
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Send size={16} />
                          </Button>
                        </div>
                      )}

                      {is_host && (
                        <div className="mt-4 pt-3 border-t border-gray-700/50">
                          <p className="text-xs text-gray-500 mb-2">Resolve this prompt (host only):</p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Correct answer..."
                              value={resolveAnswers[prompt.id] || ''}
                              onChange={(e) => setResolveAnswers(prev => ({ ...prev, [prompt.id]: e.target.value }))}
                              className="bg-[#0a0a0f] border-gray-600 text-white flex-1"
                            />
                            <Button
                              onClick={() => resolvePromptMutation.mutate({ promptId: prompt.id, correctAnswer: resolveAnswers[prompt.id] || '' })}
                              disabled={!resolveAnswers[prompt.id]?.trim() || resolvePromptMutation.isPending}
                              size="sm"
                              variant="outline"
                              className="border-amber-500 text-amber-400"
                            >
                              Resolve
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {resolvedPrompts.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Check size={18} className="text-green-400" />
              Resolved ({resolvedPrompts.length})
            </h2>
            <div className="space-y-3">
              {resolvedPrompts.map((prompt) => (
                <div key={prompt.id} className="bg-[#1a1a2e] rounded-xl border border-gray-700/50 p-4">
                  <p className="text-white font-medium mb-2">{prompt.prompt_text}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Correct answer:</p>
                      <p className="text-green-400 font-medium">{prompt.correct_answer}</p>
                    </div>
                    {prompt.user_answer && (
                      <div className={`text-right px-3 py-1 rounded-lg ${
                        prompt.user_answer.is_correct 
                          ? 'bg-green-500/20' 
                          : 'bg-red-500/20'
                      }`}>
                        <p className="text-xs text-gray-400">You said:</p>
                        <p className={prompt.user_answer.is_correct ? 'text-green-400' : 'text-red-400'}>
                          {prompt.user_answer.answer}
                        </p>
                        {prompt.user_answer.is_correct && (
                          <p className="text-xs text-green-400">+{prompt.user_answer.points_earned} pts</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <button 
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="w-full flex items-center justify-between text-lg font-semibold text-white mb-3"
          >
            <span className="flex items-center gap-2">
              <Trophy size={18} className="text-amber-400" />
              Leaderboard
            </span>
            {showLeaderboard ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          
          {showLeaderboard && (
            <div className="bg-[#1a1a2e] rounded-xl border border-gray-700/50 overflow-hidden">
              {members.length === 0 ? (
                <div className="p-4 text-center text-gray-400">No members yet</div>
              ) : (
                members.map((member, index) => (
                  <div 
                    key={member.user_id}
                    className={`flex items-center gap-3 p-3 ${
                      index !== members.length - 1 ? 'border-b border-gray-700/50' : ''
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-amber-500 text-black' :
                      index === 1 ? 'bg-gray-300 text-black' :
                      index === 2 ? 'bg-amber-700 text-white' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    {member.users.avatar_url ? (
                      <img 
                        src={member.users.avatar_url} 
                        alt="" 
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-purple-500/30 flex items-center justify-center">
                        <span className="text-purple-300 text-sm font-medium">
                          {(member.users.display_name || member.users.user_name || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {member.users.display_name || member.users.user_name}
                      </p>
                      {member.role === 'host' && (
                        <span className="text-[10px] text-amber-400">HOST</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-amber-400 font-bold">{member.total_points}</span>
                      <span className="text-gray-500 text-xs ml-1">pts</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {prompts.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-2">No prompts yet</p>
            {is_host && (
              <p className="text-sm text-gray-500">Add a prompt to get started!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
