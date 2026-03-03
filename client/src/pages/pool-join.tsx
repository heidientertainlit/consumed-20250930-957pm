import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Trophy, Users } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

export default function PoolJoinPage() {
  const params = useParams<{ code: string }>();
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const [state, setState] = useState<'joining' | 'success' | 'error' | 'auth'>('joining');
  const [poolName, setPoolName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!params.code) return;
    if (!session?.access_token) { setState('auth'); return; }

    const join = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/join-pool`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ invite_code: params.code })
        });
        const data = await res.json();
        if (data.error) { setState('error'); setErrorMsg(data.error); return; }
        setPoolName(data.pool_name || 'the pool');
        setState('success');
        setTimeout(() => setLocation(`/pool/${data.pool_id}`), 1500);
      } catch {
        setState('error');
        setErrorMsg('Something went wrong. Please try again.');
      }
    };

    join();
  }, [params.code, session?.access_token]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-purple-600/20 flex items-center justify-center mb-6">
        <Trophy size={32} className="text-purple-400" />
      </div>

      {state === 'joining' && (
        <>
          <h1 className="text-white text-2xl font-semibold mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Joining pool...</h1>
          <p className="text-white/50 text-sm">Just a moment</p>
        </>
      )}

      {state === 'success' && (
        <>
          <h1 className="text-white text-2xl font-semibold mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>You're in!</h1>
          <p className="text-white/50 text-sm mb-6">You joined <span className="text-white font-medium">{poolName}</span></p>
          <p className="text-white/30 text-xs">Taking you there now...</p>
        </>
      )}

      {state === 'error' && (
        <>
          <h1 className="text-white text-2xl font-semibold mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Invalid link</h1>
          <p className="text-white/50 text-sm mb-6">{errorMsg || 'This invite link is not valid.'}</p>
          <Button onClick={() => setLocation('/pools')} className="bg-purple-600 hover:bg-purple-700 text-white">
            Go to Pools
          </Button>
        </>
      )}

      {state === 'auth' && (
        <>
          <h1 className="text-white text-2xl font-semibold mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>Sign in to join</h1>
          <p className="text-white/50 text-sm mb-6">You need an account to join this pool</p>
          <Button onClick={() => setLocation('/login')} className="bg-purple-600 hover:bg-purple-700 text-white">
            Sign In
          </Button>
        </>
      )}
    </div>
  );
}
