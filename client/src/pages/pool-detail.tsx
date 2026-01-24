import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Users, Trophy, Clock, Copy, Check, Plus, Loader2, ChevronDown, ChevronUp, Send, BookOpen, Library, X, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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

interface SharedList {
  id: number;
  title: string;
  item_count: number;
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
    list_id: number | null;
    pool_type: string | null;
    media_id: string | null;
    media_title: string | null;
    media_image: string | null;
    media_type: string | null;
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
  shared_list: SharedList | null;
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
    const [questionOptions, setQuestionOptions] = useState<string[]>(['', '']);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resolveAnswers, setResolveAnswers] = useState<Record<string, string>>({});
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Array<{question: string; type: string; options: string[]}>>([]);

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
      const filledOptions = questionOptions.filter(o => o.trim() !== '');
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
            prompt_type: 'prediction',
            options: filledOptions.length >= 2 ? filledOptions : null,
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
      setNewPromptText('');
      setQuestionOptions(['', '']);
      toast({ title: 'Question added!', description: 'Add another or close the dialog.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deletePoolMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/pools/delete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pool_id: params.id }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete pool');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-pools'] });
      toast({ title: 'Pool deleted' });
      setLocation('/pools');
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
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center">
          <p className="text-gray-500">Sign in to view this pool</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-purple-600" size={32} />
        </div>
      </div>
    );
  }

  if (error || !poolData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center">
          <p className="text-gray-500 mb-4">{(error as Error)?.message || 'Pool not found'}</p>
          <Button onClick={() => setLocation('/pools')} variant="outline" className="border-gray-300">
            Back to Pools
          </Button>
        </div>
      </div>
    );
  }

  const { pool, prompts, members, is_host, shared_list } = poolData;
  const openPrompts = prompts.filter(p => p.status === 'open');
  const resolvedPrompts = prompts.filter(p => p.status === 'resolved');

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />

      <div className="max-w-2xl mx-auto px-4 pt-4">
        <button onClick={() => setLocation('/pools')} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 mb-4 text-sm">
          <ArrowLeft size={16} />
          <span>Back to Pools</span>
        </button>

        <Card className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-900 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{pool.name}</h1>
                {pool.description && <p className="text-sm text-gray-500">{pool.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs rounded font-medium ${
                pool.status === 'open' ? 'bg-green-100 text-green-700' :
                pool.status === 'locked' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {pool.status.toUpperCase()}
              </span>
              {is_host && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 h-auto">
                      <Trash2 size={16} />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this pool?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the pool, all questions, and all member answers. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deletePoolMutation.mutate()}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        {deletePoolMutation.isPending ? 'Deleting...' : 'Delete Pool'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
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
            <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 flex items-center justify-between border border-gray-200">
              <span className="text-gray-500 text-sm">Invite Code:</span>
              <span className="font-mono text-gray-900 font-bold">{pool.invite_code}</span>
            </div>
            <Button
              onClick={() => copyInviteCode(pool.invite_code)}
              size="sm"
              variant="outline"
              className="border-gray-300"
            >
              {copiedCode ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-gray-500" />}
            </Button>
          </div>
        </Card>

        {shared_list && (
          <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-4 shadow-sm mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                  <Library className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{shared_list.title}</h3>
                  <p className="text-xs text-gray-500">{shared_list.item_count} items added</p>
                </div>
              </div>
              <Button
                onClick={() => setLocation(`/list/${shared_list.id}`)}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                View List
              </Button>
            </div>
          </Card>
        )}

        {is_host && pool.status === 'open' && (
          <>
          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            <Dialog open={isAddPromptOpen} onOpenChange={setIsAddPromptOpen}>
              <DialogTrigger asChild>
                <Button className="flex-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white">
                  <Plus size={16} className="mr-2" />
                  Add Question
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-white border-gray-200 max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-gray-900">Add a Question</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {/* Template Ideas */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Quick ideas</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Who gets eliminated?',
                      'Who wins?',
                      'Who makes the finale?',
                      'Best performance tonight?',
                      'Biggest twist prediction?',
                      'Fan favorite?',
                    ].map((template) => (
                      <button
                        key={template}
                        type="button"
                        onClick={() => setNewPromptText(template)}
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium rounded-full border border-purple-200 transition-colors"
                      >
                        {template}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Text */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Your question</label>
                  <Textarea
                    placeholder={pool.pool_type === 'eliminations' ? 'Who gets eliminated this week?' : 'Who wins this matchup?'}
                    value={newPromptText}
                    onChange={(e) => setNewPromptText(e.target.value)}
                    className="bg-gray-50 border-gray-300 text-gray-900 resize-none placeholder:text-gray-400"
                    rows={2}
                  />
                </div>

                {/* Answer Options */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Answer options</label>
                  <div className="space-y-2">
                    {questionOptions.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder={`Option ${index + 1}`}
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...questionOptions];
                            newOptions[index] = e.target.value;
                            setQuestionOptions(newOptions);
                          }}
                          className="bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400"
                        />
                        {questionOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuestionOptions(questionOptions.filter((_, i) => i !== index));
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {questionOptions.length < 6 && (
                    <button
                      type="button"
                      onClick={() => setQuestionOptions([...questionOptions, ''])}
                      className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                    >
                      <Plus size={14} />
                      Add option
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => addPromptMutation.mutate()}
                    disabled={!newPromptText.trim() || questionOptions.filter(o => o.trim()).length < 2 || addPromptMutation.isPending}
                    className="flex-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                  >
                    {addPromptMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Plus size={16} className="mr-2" />}
                    Add Question
                  </Button>
                  <Button
                    onClick={() => setIsAddPromptOpen(false)}
                    variant="outline"
                    className="rounded-full border-gray-300"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* AI Generate Button */}
          <Button
            onClick={async () => {
              setIsGenerating(true);
              try {
                const response = await fetch(
                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pool-questions`,
                  {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${session?.access_token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      pool_id: pool.id,
                      media_title: pool.media_title,
                      media_type: pool.media_type,
                      pool_type: pool.pool_type,
                    }),
                  }
                );
                if (response.ok) {
                  const data = await response.json();
                  if (data.questions?.length > 0) {
                    setGeneratedQuestions(data.questions);
                  } else {
                    toast({ title: 'No questions generated', variant: 'destructive' });
                  }
                } else {
                  toast({ title: 'Failed to generate questions', variant: 'destructive' });
                }
              } catch (e) {
                console.error(e);
                toast({ title: 'Error generating questions', variant: 'destructive' });
              } finally {
                setIsGenerating(false);
              }
            }}
            disabled={isGenerating}
            variant="outline"
            className="flex-1 rounded-full border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            {isGenerating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Sparkles size={16} className="mr-2" />}
            {isGenerating ? 'Generating...' : pool.media_title ? 'AI Ideas' : 'AI Ideas (Generic)'}
          </Button>
          </div>

          {/* Generated Questions */}
          {generatedQuestions.length > 0 && (
            <Card className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-purple-900 flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-600" />
                  AI-Generated Questions
                </h3>
                <button onClick={() => setGeneratedQuestions([])} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-2">
                {generatedQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-white rounded-lg border border-purple-100">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{q.question}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {q.type} • {q.options.slice(0, 3).join(', ')}{q.options.length > 3 ? '...' : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={async () => {
                        const response = await fetch(
                          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-pool-prompt`,
                          {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${session?.access_token}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              pool_id: pool.id,
                              prompt_text: q.question,
                              prompt_type: q.type,
                              options: q.options,
                            }),
                          }
                        );
                        if (response.ok) {
                          queryClient.invalidateQueries({ queryKey: ['pool-detail', pool.id] });
                          setGeneratedQuestions(generatedQuestions.filter((_, idx) => idx !== i));
                          toast({ title: 'Question added!' });
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3"
                    >
                      <Plus size={12} className="mr-1" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
          </>
        )}

        {openPrompts.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              Open Prompts
            </h2>
            <div className="space-y-3">
              {openPrompts.map((prompt) => (
                <Card key={prompt.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => togglePrompt(prompt.id)}
                    className="w-full p-4 flex items-start justify-between text-left"
                  >
                    <div className="flex-1">
                      <p className="text-gray-900 font-medium">{prompt.prompt_text}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Trophy size={12} className="text-amber-500" />
                          {prompt.points_value} pts
                        </span>
                        {prompt.user_answer && (
                          <span className="text-green-600 font-medium">You answered</span>
                        )}
                      </div>
                    </div>
                    {expandedPrompts.has(prompt.id) ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </button>

                  {expandedPrompts.has(prompt.id) && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                      {prompt.user_answer ? (
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Your answer:</p>
                          <p className="text-gray-900 font-medium">{prompt.user_answer.answer}</p>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Your answer..."
                            value={answers[prompt.id] || ''}
                            onChange={(e) => setAnswers(prev => ({ ...prev, [prompt.id]: e.target.value }))}
                            className="bg-gray-50 border-gray-300 text-gray-900 flex-1 placeholder:text-gray-400"
                          />
                          <Button
                            onClick={() => submitAnswerMutation.mutate({ promptId: prompt.id, answer: answers[prompt.id] || '' })}
                            disabled={!answers[prompt.id]?.trim() || submitAnswerMutation.isPending}
                            size="icon"
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Send size={16} className="text-white" />
                          </Button>
                        </div>
                      )}

                      {is_host && (
                        <div className="mt-4 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-2">Resolve this prompt (host only):</p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Correct answer..."
                              value={resolveAnswers[prompt.id] || ''}
                              onChange={(e) => setResolveAnswers(prev => ({ ...prev, [prompt.id]: e.target.value }))}
                              className="bg-gray-50 border-gray-300 text-gray-900 flex-1 placeholder:text-gray-400"
                            />
                            <Button
                              onClick={() => resolvePromptMutation.mutate({ promptId: prompt.id, correctAnswer: resolveAnswers[prompt.id] || '' })}
                              disabled={!resolveAnswers[prompt.id]?.trim() || resolvePromptMutation.isPending}
                              size="sm"
                              variant="outline"
                              className="border-amber-500 text-amber-600 hover:bg-amber-50"
                            >
                              Resolve
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {resolvedPrompts.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Check size={16} className="text-green-600" />
              Resolved ({resolvedPrompts.length})
            </h2>
            <div className="space-y-3">
              {resolvedPrompts.map((prompt) => (
                <Card key={prompt.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
                  <p className="text-gray-900 font-medium mb-2">{prompt.prompt_text}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Correct answer:</p>
                      <p className="text-green-600 font-medium">{prompt.correct_answer}</p>
                    </div>
                    {prompt.user_answer && (
                      <div className={`text-right px-3 py-2 rounded-xl ${
                        prompt.user_answer.is_correct 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-red-50 border border-red-200'
                      }`}>
                        <p className="text-xs text-gray-500">You said:</p>
                        <p className={prompt.user_answer.is_correct ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {prompt.user_answer.answer}
                        </p>
                        {prompt.user_answer.is_correct && (
                          <p className="text-xs text-green-600">+{prompt.user_answer.points_earned} pts</p>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-4">
          <button 
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="w-full flex items-center justify-between p-4"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Trophy size={16} className="text-amber-500" />
              Leaderboard
            </span>
            {showLeaderboard ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
          </button>
          
          {showLeaderboard && (
            <div className="border-t border-gray-100">
              {members.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No members yet</div>
              ) : (
                members.map((member, index) => (
                  <div 
                    key={member.user_id}
                    className={`flex items-center gap-3 p-3 ${
                      index !== members.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-amber-400 text-amber-900' :
                      index === 1 ? 'bg-gray-300 text-gray-700' :
                      index === 2 ? 'bg-amber-600 text-white' :
                      'bg-gray-100 text-gray-600'
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
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="text-purple-600 text-sm font-medium">
                          {(member.users.display_name || member.users.user_name || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-medium truncate">
                        {member.users.display_name || member.users.user_name}
                      </p>
                      {member.role === 'host' && (
                        <span className="text-[10px] text-amber-600 font-medium">HOST</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-amber-600 font-bold">{member.total_points}</span>
                      <span className="text-gray-400 text-xs ml-1">pts</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>

        {prompts.length === 0 && (
          <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <BookOpen className="text-gray-400" size={24} />
            </div>
            <p className="text-gray-500 mb-1">No prompts yet</p>
            {is_host && (
              <p className="text-sm text-gray-400">Add a prompt to get started!</p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
