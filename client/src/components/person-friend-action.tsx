import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Loader2, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

/** The server still owns friendship transitions; discovery never unlocks a profile. */
export function PersonFriendAction({ personId, name, isFriend = false }: {
  personId: string; name: string; isFriend?: boolean;
}) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const client = useQueryClient();
  const key = ["person-friendship-status", user?.id, personId];
  const relationship = useQuery({
    queryKey: key,
    enabled: !!user?.id && user.id !== personId && !isFriend,
    queryFn: async () => {
      const { data, error } = await supabase.from("friendships")
        .select("status")
        .or(`and(user_id.eq.${user!.id},friend_id.eq.${personId}),and(user_id.eq.${personId},friend_id.eq.${user!.id})`)
        .limit(2);
      if (error) throw error;
      if (data?.some(row => row.status === "accepted")) return "accepted";
      if (data?.some(row => row.status === "pending")) return "pending";
      return "none";
    },
  });
  const send = useMutation({
    mutationFn: async () => {
      if (!session?.access_token) throw new Error("Sign in to add friends.");
      const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-friendships`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendRequest", friendId: personId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send friend request.");
      return result;
    },
    onSuccess: () => {
      client.setQueryData(key, "pending");
      for (const queryKey of [["friends"], ["people-friends"], ["pending-requests"], ["user-search"], ["people-affinity-v9"]]) {
        client.invalidateQueries({ queryKey });
      }
      toast({ title: "Friend request sent", description: `Your request to ${name} is on its way.` });
    },
    onError: (error: Error) => {
      client.invalidateQueries({ queryKey: key });
      toast({ title: "Couldn’t send request", description: error.message, variant: "destructive" });
    },
  });
  const style = "inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-full border border-[#d9cce5] bg-[#eee5f5] px-2.5 py-1.5 text-[11px] font-bold text-[#5b3777] transition hover:bg-[#e4d5ef] disabled:opacity-60";
  if (!user || user.id === personId) return null;
  if (isFriend || relationship.data === "accepted") {
    return <Link href={`/user/${encodeURIComponent(personId)}`} className={style} aria-label={`View ${name}'s profile`}><Check size={13} /> Friends</Link>;
  }
  if (relationship.isError) {
    return <button type="button" className={style} onClick={() => relationship.refetch()} aria-label={`Retry connection status for ${name}`}>Retry</button>;
  }
  const pending = relationship.data === "pending";
  const loading = relationship.isLoading || send.isPending;
  return (
    <button
      type="button"
      className={style}
      disabled={pending || loading}
      onClick={() => send.mutate()}
      aria-label={pending ? `Friend request pending with ${name}` : `Add ${name} as a friend`}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : pending ? <Clock size={13} /> : <UserPlus size={13} />}
      {send.isPending ? "Sending…" : relationship.isLoading ? "Checking…" : pending ? "Pending" : "Add"}
    </button>
  );
}
