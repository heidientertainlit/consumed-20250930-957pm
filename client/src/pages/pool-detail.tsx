import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Users, Trophy, Clock, Copy, Check, Loader2, Trash2, Share2 } from 'lucide-react';
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
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast({ title: 'Invite code copied!' });
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
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-indigo-900 pb-24">
      <Navigation />

      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setLocation('/pools')} className="flex items-center gap-1 text-white/70 hover:text-white text-sm">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => copyInviteCode(pool.invite_code)}
              size="sm"
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              {copiedCode ? <Check size={16} /> : <Share2 size={16} />}
            </Button>
            {is_host && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-red-300 hover:text-red-200 hover:bg-red-500/20">
                    <Trash2 size={16} />
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

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">
            {pool.media_title || pool.name.split(' ')[0]}: <span className="font-normal">{pool.name.includes('Season') ? pool.name.split(' ').slice(-2).join(' ') : 'Season 1'}</span>
          </h1>
          <div className="flex items-center gap-2 text-white/60 text-sm mt-1">
            <Clock size={14} />
            <span>Next picks close in 2 days</span>
          </div>
        </div>

        {/* Make Your Pick Card */}
        <Card className="bg-[#f5f0e8] border-0 rounded-2xl p-6 mb-6 shadow-lg relative overflow-hidden">
          {/* Paper texture effect */}
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }} />
          
          <div className="relative">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Make Your Pick</h2>
            <p className="text-gray-600 mb-4">Who's getting eliminated next?</p>
            
            <Button
              onClick={() => setShowPickView(true)}
              className="w-full py-5 text-lg font-semibold bg-green-500 hover:bg-green-600 text-white rounded-xl"
            >
              {hasLocked ? 'Change Pick' : 'Pick Now'}
            </Button>

            {hasLocked && selectedContestant && (
              <p className="text-center text-gray-500 text-sm mt-3">
                Your pick: <span className="font-semibold text-gray-700">{contestants.find(c => c.id === selectedContestant)?.name}</span>
              </p>
            )}
          </div>
        </Card>

        {/* Your Status */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-white mb-2">
            You're in <span className="text-green-400">{userRank === 1 ? '1st' : userRank === 2 ? '2nd' : userRank === 3 ? '3rd' : `${userRank}th`}</span> place
          </h3>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <div className="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center text-xs text-white">
              {lastEliminated.charAt(0)}
            </div>
            <span>{lastEliminated} was eliminated</span>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-white/80 font-medium">Group leaderboard</h3>
          </div>
          
          <div className="divide-y divide-white/10">
            {members.length === 0 ? (
              <div className="px-4 py-8 text-center text-white/50">
                No members yet. Share the invite code!
              </div>
            ) : (
              members
                .sort((a, b) => b.total_points - a.total_points)
                .map((member, index) => {
                  const isCurrentUser = member.users.user_name === 'You'; // Would need real logic
                  const pointsChange = Math.floor(Math.random() * 20) + 5; // Mock

                  return (
                    <div
                      key={member.user_id}
                      className={`flex items-center justify-between px-4 py-3 ${isCurrentUser ? 'bg-white/5' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-400 text-yellow-900' :
                          index === 1 ? 'bg-gray-300 text-gray-700' :
                          index === 2 ? 'bg-orange-400 text-orange-900' :
                          'bg-white/20 text-white'
                        }`}>
                          {member.users.avatar_url ? (
                            <img src={member.users.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            (member.users.display_name || member.users.user_name).charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <span className="text-white font-medium">
                            {member.users.display_name || member.users.user_name}
                          </span>
                          {index === 0 && (
                            <span className="ml-2 text-yellow-400">
                              <Trophy size={14} className="inline" />
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-white font-semibold">{member.total_points} pts</span>
                        <span className="text-green-400 text-sm font-medium">+{pointsChange}</span>
                        <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-bold">
                          +{pointsChange}
                        </span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Invite Code */}
        <div className="mt-6 text-center">
          <button
            onClick={() => copyInviteCode(pool.invite_code)}
            className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm"
          >
            {copiedCode ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            <span>Invite Code: <span className="font-mono font-bold">{pool.invite_code}</span></span>
          </button>
        </div>
      </div>
    </div>
  );
}
