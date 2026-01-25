import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Users, Trophy, Clock, Copy, Check, Loader2, Trash2, Share2, ChevronRight, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import Navigation from '@/components/navigation';

interface Contestant {
  id: string;
  name: string;
  eliminated: boolean;
  eliminated_week?: number;
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
    pool_type: string | null;
    media_title: string | null;
    host: {
      id: string;
      user_name: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
  prompts: any[];
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
  const [selectedContestant, setSelectedContestant] = useState<string | null>(null);
  const [showPickView, setShowPickView] = useState(false);
  const [hasLocked, setHasLocked] = useState(false);

  // Mock contestants for demo
  const contestants: Contestant[] = [
    { id: '1', name: 'Alex', eliminated: false },
    { id: '2', name: 'Sam', eliminated: false },
    { id: '3', name: 'Jordan', eliminated: false },
    { id: '4', name: 'Chris', eliminated: false },
    { id: '5', name: 'Emma', eliminated: true, eliminated_week: 2 },
    { id: '6', name: 'Taylor', eliminated: false },
  ];

  const activeContestants = contestants.filter(c => !c.eliminated);

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
    const joinLink = `${window.location.origin}/pool/join/${code}`;
    navigator.clipboard.writeText(joinLink);
    setCopiedCode(true);
    toast({ title: 'Invite link copied!' });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSelectContestant = (id: string) => {
    setSelectedContestant(id);
  };

  const handleLockIn = () => {
    if (!selectedContestant) return;
    setHasLocked(true);
    setShowPickView(false);
    toast({ 
      title: 'Pick locked in!',
      description: `You picked ${contestants.find(c => c.id === selectedContestant)?.name}`,
    });
  };

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
          <Button onClick={() => setLocation('/pools')} variant="outline">
            Back to Pools
          </Button>
        </div>
      </div>
    );
  }

  const { pool, members, is_host } = poolData;

  // Mock user rank
  const userRank: number = 3;
  const lastEliminated = contestants.find(c => c.eliminated)?.name || 'No one yet';

  // Pick View - Full screen selection
  if (showPickView) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 pb-24">
        <div className="max-w-lg mx-auto px-4 pt-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => setShowPickView(false)} 
              className="flex items-center gap-1 text-white/70 hover:text-white text-sm"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          </div>

          {/* Question */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Who goes home this week?</h1>
            <p className="text-white/60 text-sm">Tap to select your pick</p>
          </div>

          {/* Contestant Buttons */}
          <div className="space-y-3 mb-8">
            {activeContestants.map((contestant, index) => {
              const gradients = [
                'from-purple-400 to-purple-600',
                'from-indigo-400 to-purple-500',
                'from-purple-500 to-pink-500',
                'from-pink-400 to-rose-500',
                'from-rose-400 to-orange-400',
                'from-orange-400 to-amber-400',
              ];
              const gradient = gradients[index % gradients.length];
              const isSelected = selectedContestant === contestant.id;

              return (
                <button
                  key={contestant.id}
                  onClick={() => handleSelectContestant(contestant.id)}
                  className={`w-full py-4 px-6 rounded-xl text-white font-semibold text-lg transition-all duration-200 bg-gradient-to-r ${gradient} ${
                    isSelected 
                      ? 'ring-4 ring-white shadow-lg scale-[1.02]' 
                      : 'hover:scale-[1.01] hover:shadow-md'
                  }`}
                >
                  {contestant.name}
                </button>
              );
            })}
          </div>

          {/* Lock In Button */}
          {selectedContestant && (
            <div className="text-center">
              <Button
                onClick={handleLockIn}
                className="w-full py-6 text-lg font-bold bg-green-500 hover:bg-green-600 text-white rounded-xl"
              >
                Lock In Pick
              </Button>
              <p className="text-white/50 text-sm mt-3">How sure are you? 🤔😎</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main Pool View
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />

      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setLocation('/pools')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => copyInviteCode(pool.invite_code)}
              size="sm"
              variant="ghost"
              className="text-gray-500 hover:bg-transparent hover:text-gray-500 active:text-purple-600"
              title="Invite Friends"
            >
              <Users size={18} />
            </Button>
            <Button
              onClick={() => copyInviteCode(pool.invite_code)}
              size="sm"
              variant="ghost"
              className="text-gray-500 hover:bg-transparent hover:text-gray-500 active:text-purple-600"
              title="Share"
            >
              {copiedCode ? <Check size={18} className="text-purple-600" /> : <Share2 size={18} />}
            </Button>
            {is_host && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-500">
                    <Trash2 size={18} />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this pool?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the pool and all picks.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
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

        {/* Pool Header with Poster */}
        <div className="flex items-start gap-4 mb-6">
          {/* Media Poster */}
          <img 
            src="https://image.tmdb.org/t/p/w200/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"
            alt={pool.name}
            className="w-20 h-28 rounded-xl shadow-lg object-cover flex-shrink-0"
          />
          
          {/* Pool Info */}
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-lg font-semibold text-gray-900 mb-1">
              {pool.name}
            </h1>
            <p className="text-gray-500 text-sm mb-3">
              {members.length} players · {userRank === 1 ? '1st' : userRank === 2 ? '2nd' : userRank === 3 ? '3rd' : `${userRank}th`} place
            </p>
            
            {hasLocked && selectedContestant && (
              <p className="text-gray-500 text-sm mt-1">
                Your pick: <span className="font-semibold text-purple-600">{contestants.find(c => c.id === selectedContestant)?.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Make Your Pick Button - Main CTA */}
        <Button
          onClick={() => setShowPickView(true)}
          className="w-full py-6 text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl shadow-lg mb-2"
        >
          {hasLocked ? (
            <>
              <Check size={20} className="mr-2" />
              Change Your Pick
            </>
          ) : (
            <>
              <Target size={20} className="mr-2" />
              Make Your Pick
            </>
          )}
        </Button>
        <p className="text-gray-400 text-xs text-center mb-6">
          <Clock size={12} className="inline mr-1" />
          Picks close in 2 days
        </p>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-purple-900 via-purple-950 to-slate-950 border border-purple-800/30 rounded-2xl p-5 text-center shadow-xl">
            <div className="text-3xl font-bold text-white mb-1 tracking-tight">
              {userRank === 1 ? '1st' : userRank === 2 ? '2nd' : userRank === 3 ? '3rd' : `${userRank}th`}
            </div>
            <p className="text-purple-300/70 text-sm font-medium">Your Rank</p>
          </Card>
          <Card className="bg-gradient-to-br from-purple-900 via-purple-950 to-slate-950 border border-purple-800/30 rounded-2xl p-5 text-center shadow-xl">
            <div className="text-3xl font-bold text-emerald-400 mb-1 tracking-tight">+37</div>
            <p className="text-purple-300/70 text-sm font-medium">Points</p>
          </Card>
        </div>

        {/* Last Result */}
        <Card className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-lg">🎭</span>
            </div>
            <div>
              <p className="text-gray-900 font-medium">Last Eliminated</p>
              <p className="text-gray-500 text-sm">{lastEliminated} went home</p>
            </div>
          </div>
        </Card>

        {/* Leaderboard */}
        <Card className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-gray-900 font-semibold flex items-center gap-2">
              <Trophy size={16} className="text-purple-500" />
              Leaderboard
            </h3>
            <span className="text-gray-400 text-sm">{members.length} players</span>
          </div>
          
          <div className="divide-y divide-gray-50">
            {members.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400">
                No members yet. Share the invite code!
              </div>
            ) : (
              members
                .sort((a, b) => b.total_points - a.total_points)
                .map((member, index) => {
                  const pointsChange = Math.floor(Math.random() * 20) + 5;

                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-200 text-gray-600' :
                          index === 2 ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {member.users.avatar_url ? (
                            <img src={member.users.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            index < 3 ? ['🥇', '🥈', '🥉'][index] : (member.users.display_name || member.users.user_name).charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="text-gray-900 font-medium">
                          {member.users.display_name || member.users.user_name}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 font-semibold">{member.total_points} pts</span>
                        <span className="text-green-500 text-sm font-medium bg-green-50 px-2 py-0.5 rounded-full">+{pointsChange}</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </Card>

        {/* Invite Code */}
        <div className="mt-6 text-center">
          <button
            onClick={() => copyInviteCode(pool.invite_code)}
            className="inline-flex items-center gap-2 bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors px-4 py-2 rounded-full text-sm font-medium"
          >
            {copiedCode ? <Check size={14} /> : <Copy size={14} />}
            <span>Invite Code: <span className="font-mono font-bold">{pool.invite_code}</span></span>
          </button>
        </div>
      </div>
    </div>
  );
}
