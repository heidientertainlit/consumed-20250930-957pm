import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { LabState, LabVariant, LabVerdict, LabReason } from "@shared/recommendation-lab";

export function useRecommendationLab() {
  const { user, session } = useAuth();
  const client = useQueryClient();
  const key = ["admin-recommendation-lab", user?.id];
  async function request(body: Record<string, unknown>): Promise<any> {
    if (!session?.access_token) throw new Error("Admin sign-in required.");
    const { data, error } = await supabase.functions.invoke("admin-recommendation-lab", {
      body, headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) {
      let message = error.message;
      if (error.context instanceof Response) {
        try { message = (await error.context.json()).error || message; } catch {}
      }
      throw new Error(message || "The lab request failed.");
    }
    return data;
  }
  const state = useQuery<LabState>({
    queryKey: key, enabled: !!user?.id && !!session?.access_token,
    queryFn: () => request({ action: "state" }), retry: false, staleTime: 15_000,
  });
  const prepare = useMutation({
    mutationFn: () => request({ action: "step" }),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  const compare = useMutation({
    mutationFn: (sourceKey: string) => request({ action: "compare", sourceKey }),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  const evaluate = useMutation({
    mutationFn: (input: { runId: string; variant: LabVariant; candidateId: string; verdict: LabVerdict; reasons: LabReason[]; note: string }) =>
      request({ action: "evaluate", ...input }),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  return { state, prepare, compare, evaluate };
}
