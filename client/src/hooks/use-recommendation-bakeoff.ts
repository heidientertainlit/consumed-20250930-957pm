import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BakeoffDashboard, BakeoffSource, BakeoffTrial, BakeoffLabel, BakeoffRating } from "@shared/recommendation-bakeoff";

export function useRecommendationBakeoff() {
  const { user, session, loading } = useAuth();
  const client = useQueryClient();
  const prefix = ["recommendation-bakeoff", user?.id];
  async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    if (!session?.access_token) throw new Error("Please sign in.");
    const response = await fetch(`/api/admin/recommendation-bakeoff${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body), signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Bake-off request failed.");
    return data;
  }
  const enabled = !loading && !!session?.access_token;
  const sources = useQuery({ queryKey: [...prefix, "sources"], queryFn: ({ signal }) => request<{ sources: BakeoffSource[]; storageNotice: string }>("/sources", undefined, signal), enabled, retry: false });
  const dashboard = useQuery({ queryKey: [...prefix, "dashboard"], queryFn: ({ signal }) => request<BakeoffDashboard>("/dashboard", undefined, signal), enabled: enabled && !!sources.data, retry: false });
  const invalidate = () => client.invalidateQueries({ queryKey: prefix });
  const capture = useMutation({ mutationFn: (source: BakeoffSource) => request<BakeoffTrial>("/capture", { source }), onSuccess: invalidate });
  const save = useMutation({ mutationFn: (input: { id: string; label?: BakeoffLabel; rank?: number; rating?: BakeoffRating; preference?: BakeoffLabel | "none" }) => request<BakeoffTrial>(`/trials/${input.id}/rate`, input), onSuccess: invalidate });
  const reveal = useMutation({ mutationFn: (id: string) => request<BakeoffTrial>(`/trials/${id}/reveal`, {}), onSuccess: invalidate });
  return {
    loading, signedIn: !!user, sources, dashboard, capture, save, reveal,
    search: (query: string, signal?: AbortSignal) => request<{ results: BakeoffSource[] }>("/search?q=" + encodeURIComponent(query), undefined, signal),
    load: (id: string) => request<BakeoffTrial>(`/trials/${id}`),
    exportResults: () => request<BakeoffDashboard>("/dashboard"),
  };
}
