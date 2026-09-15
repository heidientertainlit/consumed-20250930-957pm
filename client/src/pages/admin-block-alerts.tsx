import { useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AlertState = "open" | "acknowledged";
type BlockAlert = {
  id: string;
  created_at: string;
  acknowledged_at: string | null;
  user_blocks: {
    blocker_id: string;
    blocked_id: string;
  };
};

async function blockAlertsRequest(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-block-alerts", { body });
  if (error) throw new Error(error.message || "Block alerts could not be loaded");
  return data;
}

export default function AdminBlockAlertsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [state, setState] = useLocationState();

  const { data: currentProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-profile-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("admin_user_profiles")
        .select("id, is_admin")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!profileLoading && currentProfile && !currentProfile.is_admin) setLocation("/");
  }, [currentProfile, profileLoading, setLocation]);

  const alerts = useQuery({
    queryKey: ["admin-block-alerts", state],
    queryFn: () => blockAlertsRequest({ action: "list", state }),
    enabled: !!currentProfile?.is_admin,
  });

  const acknowledge = useMutation({
    mutationFn: (alertId: string) => blockAlertsRequest({ action: "acknowledge", alert_id: alertId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-block-alerts"] });
    },
    onError: (error) => {
      toast({
        title: "Acknowledgement failed",
        description: error instanceof Error ? error.message : "The alert remains open. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (profileLoading || !user) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-purple-400" /></div>;
  }
  if (!currentProfile?.is_admin) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Access restricted</div>;
  }

  const rows: BlockAlert[] = Array.isArray(alerts.data?.alerts) ? alerts.data.alerts : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button onClick={() => setLocation("/admin")} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8">
          <ArrowLeft size={16} /> Admin
        </button>
        <div className="flex items-start gap-3 mb-7">
          <div className="rounded-xl bg-red-950/50 p-3"><ShieldAlert className="text-red-400" size={22} /></div>
          <div>
            <h1 className="text-2xl font-bold">Block alerts</h1>
            <p className="text-sm text-gray-400 mt-1">Private dashboard events. Participant IDs are opaque UUIDs; no profiles, emails, content, or notifications are included.</p>
          </div>
        </div>

        <div className="flex gap-2 mb-5">
          {(["open", "acknowledged"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setState(value)}
              className={`rounded-lg px-3 py-2 text-sm capitalize ${state === value ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
            >
              {value}
            </button>
          ))}
        </div>

        {alerts.isLoading && <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-purple-400" /></div>}
        {alerts.isError && <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">Block alerts could not be loaded. Please try again.</p>}
        {!alerts.isLoading && !alerts.isError && rows.length === 0 && (
          <p className="rounded-xl border border-gray-800 bg-gray-900/70 p-6 text-sm text-gray-400">No {state} block alerts.</p>
        )}
        <div className="space-y-3">
          {rows.map((alert) => (
            <div key={alert.id} className="rounded-xl border border-gray-800 bg-gray-900/70 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-sm">A user block was completed</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(alert.created_at).toLocaleString()}</p>
                <dl className="mt-3 grid gap-1 font-mono text-[11px] text-gray-400">
                  <div><dt className="inline text-gray-500">Blocker UUID: </dt><dd className="inline">{alert.user_blocks.blocker_id}</dd></div>
                  <div><dt className="inline text-gray-500">Blocked UUID: </dt><dd className="inline">{alert.user_blocks.blocked_id}</dd></div>
                </dl>
              </div>
              {state === "open" ? (
                <button
                  onClick={() => acknowledge.mutate(alert.id)}
                  disabled={acknowledge.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium hover:bg-purple-500 disabled:opacity-60"
                >
                  {acknowledge.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Acknowledge
                </button>
              ) : <span className="inline-flex items-center gap-1.5 text-xs text-green-400"><Check size={15} /> Acknowledged</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function useLocationState(): [AlertState, (state: AlertState) => void] {
  const [location, setLocation] = useLocation();
  const state: AlertState = location.includes("acknowledged") ? "acknowledged" : "open";
  return [state, (nextState) => setLocation(`/admin/block-alerts?state=${nextState}`)];
}