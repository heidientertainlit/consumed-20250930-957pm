import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Users, Trophy, Clock, Copy, Check, Loader2, Lock, Sparkles, Trash2, Crown, X as XIcon, Share2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import Navigation from '@/components/navigation';

interface Contestant {
  id: string;
  name: string;
  image_url: string;
  eliminated: boolean;
  eliminated_week?: number;
}

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
  shared_list: {
    id: number;
    title: string;
    item_count: number;
  } | null;
}

export default function PoolDetailPage() {
  const params = useParams<{ id: string }>();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedContestant, setSelectedContestant] = useState<string | null>(null);
  const [winnerPick, setWinnerPick] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [showFriendPicks, setShowFriendPicks] = useState(false);

  // Mock data for contestants - in production this would come from the pool
  const [contestants, setContestants] = useState<Contestant[]>([
    { id: '1', name: 'Alex', image_url: '', eliminated: false },
    { id: '2', name: 'Jordan', image_url: '', eliminated: false },
    { id: '3', name: 'Taylor', image_url: '', eliminated: false },
    { id: '4', name: 'Morgan', image_url: '', eliminated: false },
    { id: '5', name: 'Casey', image_url: '', eliminated: true, eliminated_week: 1 },
    { id: '6', name: 'Riley', image_url: '', eliminated: false },
    { id: '7', name: 'Quinn', image_url: '', eliminated: true, eliminated_week: 2 },
    { id: '8', name: 'Avery', image_url: '', eliminated: false },
  ]);

  const currentWeek = 3;
  const totalWeeks = 10;

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

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast({ title: 'Invite code copied!' });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);

  const handleContestantTap = (id: string) => {
    if (contestants.find(c => c.id === id)?.eliminated) return;
    
    if (selectedContestant === id) {
      setSelectedContestant(null);
    } else {
      setSelectedContestant(id);
    }
  };

  const handlePressStart = (id: string) => {
    if (contestants.find(c => c.id === id)?.eliminated) return;
    const timer = setTimeout(() => {
      setWinnerPick(winnerPick === id ? null : id);
      toast({ title: winnerPick === id ? 'Winner pick removed' : '👑 Winner pick set!' });
    }, 600);
    setPressTimer(timer);
  };

  const handlePressEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const handleLockIn = async () => {
    if (!selectedContestant) return;
    
    setIsLocking(true);
    
    // Dramatic delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setShowConfetti(true);
    toast({ 
      title: '🔒 LOCKED IN!',
      description: `You picked ${contestants.find(c => c.id === selectedContestant)?.name} going home`,
    });
    
    // Show friend picks after locking
    setTimeout(() => {
      setShowFriendPicks(true);
      setIsLocking(false);
    }, 1000);
    
    setTimeout(() => setShowConfetti(false), 2000);
  };

  const activeContestants = contestants.filter(c => !c.eliminated);
  const eliminatedContestants = contestants.filter(c => c.eliminated);

  // Mock friend picks data
  const friendPicks = [
    { name: 'Sarah', pick: 'Alex', avatar: '' },
    { name: 'Mike', pick: 'Alex', avatar: '' },
    { name: 'Emma', pick: 'Jordan', avatar: '' },
  ];

  const samePick = friendPicks.filter(f => f.pick === contestants.find(c => c.id === selectedContestant)?.name);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navigation />
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-purple-500" size={32} />
        </div>
      </div>
    );
  }

  if (error || !poolData) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navigation />
        <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center">
          <p className="text-gray-400 mb-4">{(error as Error)?.message || 'Pool not found'}</p>
          <Button onClick={() => setLocation('/pools')} variant="outline" className="border-gray-600 text-white">
            Back to Pools
          </Button>
        </div>
      </div>
    );
  }

  const { pool, members, is_host } = poolData;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 pb-32">
      <Navigation />

      {/* Confetti effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-20px`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: '1s',
              }}
            >
              <span className="text-2xl">{['🎉', '✨', '🔥', '⭐'][Math.floor(Math.random() * 4)]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setLocation('/pools')} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm">
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => copyInviteCode(pool.invite_code)}
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-white"
            >
              <Share2 size={16} className="mr-1" />
              Invite
            </Button>
            {is_host && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                    <Trash2 size={16} />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-gray-800 border-gray-700">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Delete this pool?</AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-400">
                      This will permanently delete the pool and all picks.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-gray-700 text-white border-gray-600">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deletePoolMutation.mutate()}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {deletePoolMutation.isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Design Preview Badge */}
        <div className="flex justify-center mb-4">
          <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs font-bold uppercase rounded-full">
            ✨ Design Preview
          </span>
        </div>

        {/* Pool Title Card */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">{pool.name}</h1>
          <p className="text-purple-400 text-sm">{pool.description || 'Season Picks'}</p>
        </div>

        {/* Week Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400">Week {currentWeek} of {totalWeeks}</span>
            <span className="text-purple-400 font-medium flex items-center gap-1">
              <Clock size={14} />
              Picks lock in 2h 30m
            </span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${(currentWeek / totalWeeks) * 100}%` }}
            />
          </div>
        </div>

        {/* Main Question */}
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="text-yellow-400" size={18} />
            <span className="text-yellow-400 text-xs font-bold uppercase tracking-wide">This Week's Pick</span>
          </div>
          <h2 className="text-xl font-bold text-white">Who gets eliminated?</h2>
          <p className="text-gray-400 text-sm mt-1">Tap to select • Long-press to pick winner</p>
        </div>

        {/* Contestant Grid */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {activeContestants.map((contestant) => (
            <button
              key={contestant.id}
              onClick={() => handleContestantTap(contestant.id)}
              onMouseDown={() => handlePressStart(contestant.id)}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={() => handlePressStart(contestant.id)}
              onTouchEnd={handlePressEnd}
              className={`relative aspect-square rounded-2xl overflow-hidden transition-all duration-200 ${
                selectedContestant === contestant.id 
                  ? 'ring-4 ring-red-500 scale-105 shadow-lg shadow-red-500/30' 
                  : winnerPick === contestant.id
                  ? 'ring-4 ring-yellow-400 scale-105 shadow-lg shadow-yellow-400/30'
                  : 'ring-2 ring-gray-700 hover:ring-purple-500'
              }`}
            >
              {/* Placeholder avatar with gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${
                selectedContestant === contestant.id 
                  ? 'from-red-600 to-red-800' 
                  : winnerPick === contestant.id
                  ? 'from-yellow-500 to-orange-600'
                  : 'from-purple-600 to-indigo-700'
              }`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white/80">{contestant.name.charAt(0)}</span>
                </div>
              </div>

              {/* Name label */}
              <div className="absolute bottom-0 inset-x-0 bg-black/60 py-1 px-1">
                <p className="text-white text-xs font-medium text-center truncate">{contestant.name}</p>
              </div>

              {/* Selection indicators */}
              {selectedContestant === contestant.id && (
                <div className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                  <XIcon size={14} className="text-white" />
                </div>
              )}
              {winnerPick === contestant.id && (
                <div className="absolute top-1 right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Crown size={14} className="text-gray-900" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Eliminated Row */}
        {eliminatedContestants.length > 0 && (
          <div className="mb-6">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-3">Eliminated</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {eliminatedContestants.map((contestant) => (
                <div 
                  key={contestant.id}
                  className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 opacity-50 grayscale"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-600 to-gray-800">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-white/50">{contestant.name.charAt(0)}</span>
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <XIcon className="text-red-400" size={24} />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5">
                    <p className="text-gray-400 text-[10px] text-center">Wk {contestant.eliminated_week}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lock In Button */}
        <div className="mb-6">
          <button
            onClick={handleLockIn}
            disabled={!selectedContestant || isLocking}
            className={`w-full py-4 rounded-2xl font-bold text-lg uppercase tracking-wide transition-all duration-300 ${
              selectedContestant && !isLocking
                ? 'bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 text-white shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/40 hover:scale-[1.02] active:scale-95'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLocking ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={20} />
                Locking...
              </span>
            ) : selectedContestant ? (
              <span className="flex items-center justify-center gap-2">
                <Lock size={20} />
                Lock It In
              </span>
            ) : (
              'Select who goes home'
            )}
          </button>
          {selectedContestant && (
            <p className="text-center text-gray-400 text-sm mt-2">
              Your pick: <span className="text-red-400 font-semibold">{contestants.find(c => c.id === selectedContestant)?.name}</span> going home
            </p>
          )}
        </div>

        {/* Friend Picks Reveal */}
        {showFriendPicks && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4 mb-6 animate-in slide-in-from-bottom-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Users size={18} className="text-purple-400" />
              Your Circle's Picks
            </h3>
            
            {samePick.length > 0 && (
              <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-3 mb-3">
                <p className="text-green-400 text-sm">
                  🔥 <span className="font-bold">{samePick.length} friends</span> made the same pick!
                </p>
              </div>
            )}

            <div className="space-y-2">
              {friendPicks.map((friend, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-900/50 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{friend.name.charAt(0)}</span>
                    </div>
                    <span className="text-white text-sm">{friend.name}</span>
                  </div>
                  <span className={`text-sm font-medium ${
                    friend.pick === contestants.find(c => c.id === selectedContestant)?.name 
                      ? 'text-green-400' 
                      : 'text-gray-400'
                  }`}>
                    {friend.pick}
                    {friend.pick === contestants.find(c => c.id === selectedContestant)?.name && ' ✓'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="w-full px-4 py-3 flex items-center justify-between text-white"
          >
            <span className="flex items-center gap-2 font-semibold">
              <Trophy size={18} className="text-yellow-400" />
              Leaderboard
            </span>
            <span className="text-gray-400 text-sm">{members.length} players</span>
          </button>
          
          {showLeaderboard && (
            <div className="px-4 pb-4 space-y-2">
              {members.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No members yet</p>
              ) : (
                members
                  .sort((a, b) => b.total_points - a.total_points)
                  .slice(0, 5)
                  .map((member, index) => (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between bg-gray-900/50 rounded-xl px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-400 text-gray-900' :
                          index === 1 ? 'bg-gray-300 text-gray-900' :
                          index === 2 ? 'bg-orange-400 text-gray-900' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center overflow-hidden">
                          {member.users.avatar_url ? (
                            <img src={member.users.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-sm font-bold">
                              {(member.users.display_name || member.users.user_name).charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="text-white text-sm font-medium">
                          {member.users.display_name || member.users.user_name}
                        </span>
                      </div>
                      <span className="text-purple-400 font-bold">{member.total_points} pts</span>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>

        {/* Invite Code Footer */}
        <div className="mt-6 text-center">
          <button
            onClick={() => copyInviteCode(pool.invite_code)}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-purple-400 transition-colors text-sm"
          >
            {copiedCode ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            <span className="font-mono">{pool.invite_code}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
