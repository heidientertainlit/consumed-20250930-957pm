import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export type FollowedCreator = {
  creator_name: string;
  creator_role: string;
  creator_image?: string | null;
  external_id: string;
  external_source: string;
};
type CreatorResult = {
  name: string;
  role: string;
  image?: string | null;
  external_id: string;
  external_source: string;
  known_for?: string[];
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
const identity = (creator: { external_id: string; external_source: string }) =>
  `${creator.external_source}:${creator.external_id}`;

export function CreatorSearch({ followedCreators, followsReady }: {
  followedCreators: FollowedCreator[];
  followsReady: boolean;
}) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const client = useQueryClient();
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const term = input.trim();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 300);
    return () => clearTimeout(timer);
  }, [term]);
  const search = useQuery({
    queryKey: ["creator-search", user?.id, debounced],
    enabled: !!session?.access_token && debounced.length >= 2 && term === debounced,
    staleTime: 60_000,
    retry: 1,
    queryFn: async ({ signal }): Promise<CreatorResult[]> => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/search-creators`, {
        method: "POST",
        signal,
        headers: { Authorization: `Bearer ${session!.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: debounced }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Creator search is unavailable. Please try again.");
      if (!Array.isArray(data.results)) throw new Error("Creator search returned an unexpected response.");
      return data.results;
    },
  });
  const follow = useMutation({
    mutationFn: async ({ creator, following }: { creator: CreatorResult; following: boolean }) => {
      if (!user?.id || !session?.access_token) throw new Error("Sign in to follow creators.");
      const response = await fetch(`${SUPABASE_URL}/functions/v1/follow-creator`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: following ? "unfollow" : "follow",
          creatorName: creator.name,
          creatorRole: creator.role,
          creatorImage: creator.image || "",
          externalId: creator.external_id,
          externalSource: creator.external_source,
        }),
      });
      if (!response.ok && !(response.status === 409 && !following)) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Couldn’t update this creator. Please try again.");
      }
    },
    onSuccess: (_, { creator, following }) => {
      client.setQueryData<FollowedCreator[]>(["people-followed-creators", user?.id], (current = []) => {
        const others = current.filter(row => identity(row) !== identity(creator));
        return following ? others : [...others, {
          creator_name: creator.name, creator_role: creator.role, creator_image: creator.image,
          external_id: creator.external_id, external_source: creator.external_source,
        }];
      });
      client.invalidateQueries({ queryKey: ["people-followed-creators", user?.id] });
      client.invalidateQueries({ queryKey: ["/api/creator-updates"] });
      client.invalidateQueries({ queryKey: ["suggest-creators"], refetchType: "none" });
      toast({ title: following ? `Unfollowed ${creator.name}` : `Following ${creator.name}` });
    },
    onError: (error: Error) => toast({
      title: "Couldn’t update creator", description: error.message, variant: "destructive",
    }),
  });
  const loading = term.length >= 2 && (term !== debounced || search.isPending);
  return <div className="mb-6">
    <div className="relative">
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#84768c]" />
      <input
        type="search"
        aria-label="Search artists and creators"
        placeholder="Search artists & creators"
        value={input}
        onChange={event => setInput(event.target.value)}
        maxLength={120}
        className="w-full rounded-xl border border-[#dcd3e1] bg-white py-3 pl-11 pr-11 text-sm text-[#30203f] outline-none placeholder:text-[#918696] focus:border-[#7040dc] focus:ring-2 focus:ring-[#7040dc]/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {input && <button type="button" onClick={() => setInput("")} aria-label="Clear creator search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#84768c] hover:bg-[#f0eaf4]"><X size={16} /></button>}
    </div>
    <p className="mt-2 text-xs text-[#817686]">Find actors, directors, musicians, and authors by name.</p>
    <div aria-live="polite" aria-busy={loading}>
      {term.length === 1 ? <p className="mt-4 text-sm text-[#746b7b]">Enter at least 2 characters to search.</p>
        : term.length < 2 ? null
        : loading ? <div role="status" className="mt-4 flex items-center gap-2 text-sm text-[#746b7b]"><Loader2 size={17} className="animate-spin" /> Searching creators…</div>
        : search.isError ? <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Creator search couldn’t load. <button type="button" onClick={() => search.refetch()} className="font-bold underline">Try again</button></div>
        : search.data?.length === 0 ? <p className="mt-4 text-sm text-[#746b7b]">No creators found for “{term}”. Try another name.</p>
        : <div className="mt-4 divide-y divide-[#e2dce4] rounded-xl border border-[#e2dce4] bg-white px-3">
          {search.data?.map(creator => {
            const following = followedCreators.some(row => identity(row) === identity(creator));
            const saving = follow.isPending && identity(follow.variables.creator) === identity(creator);
            return <div key={identity(creator)} className="flex items-center gap-3 py-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e5dff3] text-sm font-bold text-[#4c3972]">
                {creator.image ? <img src={creator.image} alt="" className="h-full w-full object-cover" /> : creator.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#30263a]">{creator.name}</p>
                <p className="text-xs text-[#817686]">{creator.role}</p>
                {!!creator.known_for?.length && <p className="mt-0.5 truncate text-xs text-[#817686]">{creator.known_for.join(" · ")}</p>}
              </div>
              <button
                type="button"
                disabled={!followsReady || follow.isPending}
                onClick={() => follow.mutate({ creator, following })}
                aria-label={`${following ? "Unfollow" : "Follow"} ${creator.name}`}
                aria-pressed={following}
                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-[#eee5f5] px-3 py-2 text-xs font-bold text-[#5b3777] transition hover:bg-[#e4d5ef] disabled:opacity-60"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : following ? <Check size={13} /> : <Plus size={13} />}
                {saving ? "Saving…" : following ? "Following" : "Follow"}
              </button>
            </div>;
          })}
        </div>}
    </div>
  </div>;
}
