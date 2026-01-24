import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users, Check, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import Navigation from '@/components/navigation';

export default function PoolJoinPage() {
  const params = useParams<{ code: string }>();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [autoJoining, setAutoJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinedPool, setJoinedPool] = useState<{ id: string; name: string } | null>(null);

  const joinPoolMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/join-pool`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invite_code: code }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join pool');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-pools'] });
      setJoinedPool({ id: data.pool.id, name: data.pool.name });
      if (data.already_member) {
        toast({ title: 'Already a member!', description: data.pool.name });
      } else {
        toast({ title: 'Joined pool!', description: data.pool.name });
      }
    },
    onError: (error: Error) => {
      setJoinError(error.message);
    },
  });

  useEffect(() => {
    if (session?.access_token && params.code && !autoJoining && !joinedPool && !joinError) {
      setAutoJoining(true);
      joinPoolMutation.mutate(params.code);
    }
  }, [session?.access_token, params.code, autoJoining, joinedPool, joinError]);

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e]">
        <Navigation />
        <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Users className="text-purple-400" size={32} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Join a Pool</h1>
          <p className="text-gray-400 mb-6">Sign in to join this prediction pool</p>
          <Button
            onClick={() => {
              const returnUrl = `/pool/join/${params.code}`;
              setLocation(`/login?redirect=${encodeURIComponent(returnUrl)}`);
            }}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Sign In to Join
          </Button>
        </div>
      </div>
    );
  }

  if (joinPoolMutation.isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e]">
        <Navigation />
        <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center">
          <Loader2 className="animate-spin text-purple-500 mb-4" size={40} />
          <p className="text-gray-400">Joining pool...</p>
        </div>
      </div>
    );
  }

  if (joinError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e]">
        <Navigation />
        <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <XCircle className="text-red-400" size={32} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Couldn't Join Pool</h1>
          <p className="text-gray-400 mb-6">{joinError}</p>
          <div className="flex gap-3">
            <Button
              onClick={() => setLocation('/pools')}
              variant="outline"
              className="border-gray-600 text-gray-400"
            >
              View My Pools
            </Button>
            <Button
              onClick={() => {
                setJoinError(null);
                setAutoJoining(false);
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (joinedPool) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e]">
        <Navigation />
        <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="text-green-400" size={32} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">You're In!</h1>
          <p className="text-gray-400 mb-6">You've joined "{joinedPool.name}"</p>
          <Button
            onClick={() => setLocation(`/pool/${joinedPool.id}`)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Go to Pool
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#1a1a2e]">
      <Navigation />
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    </div>
  );
}
