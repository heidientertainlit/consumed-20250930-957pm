import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, Clock, Dna, Heart, Leaf, Loader2, LockKeyhole, Moon, Share2, Sparkles, Users } from "lucide-react";
import Navigation from "@/components/navigation";
import FollowCreatorsCard from "@/components/follow-creators-card";
import FriendsManager from "@/components/friends-manager";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { APP_BASE } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";

type Tab = "matches" | "friends" | "tribes" | "creators";
type Person = {
  id: string; user_name?: string; display_name?: string; first_name?: string; last_name?: string;
  avatar_url?: string; profile_image_url?: string; avatar?: string; match_score?: number; is_friend?: boolean;
  shared_titles?: Array<{ title?: string; name?: string; image_url?: string | null; media_type?: string } | string>; shared_genres?: string[]; shared_creators?: string[];
};
type Band = { id: string; min: number; max: number; people: Person[] };
type AffinityCursor = { friend: boolean; id: string };
type Affinity = { ready?: boolean; readiness?: { ready?: boolean; has_dna_profile?: boolean; item_count?: number; tracked_items?: number; items_needed?: number; required_tracked_items?: number }; bands?: Band[]; compared_now?: number; has_more?: boolean; next_cursor?: AffinityCursor | null };
type TribeMedia = { id: string; title: string; creator?: string; image_url?: string; media_type?: string; editorial_reason?: string };
type Tribe = {
  id: string; slug: string; name: string; description?: string; identity_statement?: string; accent_color?: string; accent_color_2?: string;
  fit_score: number; evidence: Array<{ label?: string; group?: string; value?: string }>; recommended: boolean; is_member: boolean;
  member_count: number; members: Person[]; media: TribeMedia[];
};
type TribesResponse = { readiness: Affinity["readiness"]; tribes: Tribe[] };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
const bands = [
  { id: "your-people", label: "65–100", min: 65, max: 100, note: "Your People" },
  { id: "common-ground", label: "35–64", min: 35, max: 64, note: "Common Ground" },
  { id: "wildcards", label: "0–34", min: 0, max: 34, note: "Different Vibes" },
] as const;

const feedSafeName = (first?: string, last?: string) => {
  const cleanFirst = first?.trim();
  const cleanLast = last?.trim();
  return cleanFirst ? `${cleanFirst}${cleanLast ? ` ${cleanLast[0].toUpperCase()}.` : ""}` : "";
};
const nameFor = (person: Person) => {
  const canonical = feedSafeName(person.first_name, person.last_name);
  if (canonical) return canonical;
  const displayParts = person.display_name?.trim().split(/\s+/).filter(Boolean) || [];
  if (displayParts.length > 1) return feedSafeName(displayParts[0], displayParts.at(-1));
  return person.display_name || person.user_name || "Consumed member";
};
const initials = (name: string) => name.split(/\s+/).map((word) => word[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
const evidenceFor = (person: Person) => {
  const title = (person.shared_titles || []).map((item) => typeof item === "string" ? item : item.title || item.name).find(Boolean);
  return title || person.shared_genres?.[0] || person.shared_creators?.[0] || "Taste profile compared";
};

function Avatar({ person, small = false }: { person: Person; small?: boolean }) {
  const src = person.profile_image_url || person.avatar_url || person.avatar;
  const size = small ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";
  return src ? <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover bg-[#d9d4ee]`} /> :
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-[#e5dff3] font-bold text-[#4c3972]`}>{initials(nameFor(person))}</span>;
}

function AvatarStack({ people }: { people: Person[] }) {
  const peopleWithImages = people
    .filter((person) => Boolean(person.profile_image_url || person.avatar_url || person.avatar))
    .slice(0, 4);

  if (!peopleWithImages.length) return null;

  return <div className="flex items-center">{peopleWithImages.map((person, index) => {
    const src = person.profile_image_url || person.avatar_url || person.avatar;
    return <img
      key={person.id}
      src={src}
      alt=""
      className={`h-8 w-8 shrink-0 rounded-full border-2 border-[#fffdfb] object-cover ${index ? "-ml-2" : ""}`}
      onError={(event) => { event.currentTarget.style.display = "none"; }}
    />;
  })}</div>;
}

async function functionRequest<T>(path: "people-affinity" | "people-tribes", token: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || "This section is unavailable right now.");
  }
  return response.json();
}

function Readiness({ readiness, onInvite }: { readiness?: Affinity["readiness"]; onInvite: () => void }) {
  const count = readiness?.tracked_items ?? readiness?.item_count ?? 0;
  const needed = readiness?.items_needed ?? Math.max(0, 10 - count);
  const examples = [
    { score: 86, label: "Your People", detail: "Same comfort shows + music taste", color: "from-[#6d3da2] to-[#a855a7]" },
    { score: 58, label: "Common Ground", detail: "3 shared favorites across TV + books", color: "from-[#7f5f91] to-[#b48a9d]" },
    { score: 27, label: "Different Vibes", detail: "Opposite genres, one surprise overlap", color: "from-[#817887] to-[#aba2ac]" },
  ];
  return <section>
    <div className="text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#e8def1] text-[#553878]"><Dna size={20} /></span>
      <h2 className="mt-4 text-xl font-bold tracking-[-.035em] text-[#271d3a]">See how your taste connects</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#746b7b]">
        DNA comparisons reveal where you and another person overlap—and where your tastes take different paths.
      </p>
    </div>

    <div className="mt-6 space-y-3" aria-label="Example DNA comparisons">
      {examples.map((example) => (
        <div key={example.label} className="relative overflow-hidden rounded-[18px] border border-[#ded7e9] bg-white p-4 shadow-[0_4px_16px_rgba(53,35,69,.04)]">
          <span className="absolute right-3 top-3 rounded-full bg-[#f4eff6] px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#806e88]">Example</span>
          <div className="flex items-center gap-3">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br ${example.color} text-sm font-black text-white`}>
              {example.score}%
            </div>
            <div className="min-w-0 pr-14">
              <p className="text-sm font-bold text-[#2b2135]">{example.label}</p>
              <p className="mt-1 truncate text-xs text-[#796f7e]">{example.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="mt-6 rounded-[22px] border border-[#ded7e9] bg-[#f4f0f5] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ded5ef] text-[#4c3972]"><LockKeyhole size={16} /></span>
        <div>
          <p className="text-sm font-bold text-[#271d3a]">Unlock your real comparisons</p>
          <p className="mt-1 text-sm leading-5 text-[#746b7b]">
            {needed > 0
              ? `Track ${needed} more ${needed === 1 ? "item" : "items"} to unlock community DNA matches and personalized Tribes.`
              : "Your DNA is ready to find taste matches across the Consumed community."}
          </p>
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-[11px] font-bold uppercase tracking-[.12em] text-[#756985]"><span>Your DNA progress</span><span>{Math.min(count, 10)} / 10 tracked</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#ddd7e0]"><div className="h-full rounded-full bg-[#5b4389] transition-all duration-500" style={{ width: `${Math.min(100, count * 10)}%` }} /></div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" onClick={onInvite} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#513879] px-3 py-3 text-sm font-bold text-white transition hover:bg-[#412c62]">
          <Share2 size={15} /> Invite friends
        </button>
        <Link href="/add" className="inline-flex items-center justify-center gap-1 rounded-full border border-[#cfc3d8] bg-white px-3 py-3 text-sm font-bold text-[#513879] transition hover:bg-[#faf7fb]">
          Track more <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  </section>;
}

export default function PeoplePage() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const automaticMatchBatches = useRef(0);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<"loading" | "none" | "pending">("none");
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const tabParam = params.get("tab");
  const tab: Tab = tabParam === "friends" || tabParam === "tribes" || tabParam === "creators" ? tabParam : "matches";
  const selectedSlug = params.get("tribe");
  const setTab = (next: Tab) => setLocation(`/people?tab=${next}`);
  const setTribe = (slug?: string) => setLocation(slug ? `/people?tab=tribes&tribe=${encodeURIComponent(slug)}` : "/people?tab=tribes");
  const openPerson = async (person: Person) => {
    if (person.is_friend) {
      setLocation(`/user/${person.id}`);
      return;
    }
    if (!user?.id) return;
    const { data } = await supabase
      .from("friendships")
      .select("status")
      .or(`and(user_id.eq.${user.id},friend_id.eq.${person.id}),and(user_id.eq.${person.id},friend_id.eq.${user.id})`)
      .maybeSingle();
    if (data?.status === "accepted") {
      setLocation(`/user/${person.id}`);
      return;
    }
    setRelationshipStatus(data?.status === "pending" ? "pending" : "none");
    setSelectedPerson(person);
  };
  const sendFriendRequest = async () => {
    if (!selectedPerson || !session?.access_token) return;
    setIsSendingRequest(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-friendships`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendRequest", friendId: selectedPerson.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok && !String(result?.error || "").toLowerCase().includes("already")) {
        throw new Error(result?.error || "Unable to send friend request.");
      }
      setSelectedPerson(null);
      toast({
        title: response.ok ? "Request sent" : "Request already pending",
        description: response.ok ? `Your request to ${nameFor(selectedPerson)} is on its way.` : "You already sent this person a friend request.",
      });
    } catch (error) {
      toast({ title: "Couldn’t send request", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsSendingRequest(false);
    }
  };

  const affinityQuery = useQuery({
    queryKey: ["people-affinity-v9", user?.id], enabled: !!session?.access_token && tab === "matches",
    queryFn: () => functionRequest<Affinity>("people-affinity", session!.access_token, { action: "load", batch_size: 25 }), staleTime: 60_000,
  });
  const tribesQuery = useQuery({
    queryKey: ["people-tribes-v2", user?.id], enabled: !!session?.access_token && tab === "tribes",
    queryFn: () => functionRequest<TribesResponse>("people-tribes", session!.access_token, { action: "load" }), staleTime: 60_000,
  });
  const moreMatches = useMutation({
    mutationFn: () => functionRequest<Affinity>("people-affinity", session!.access_token, { action: "more", cursor: affinityQuery.data?.next_cursor, batch_size: 25 }),
    onSuccess: (next) => queryClient.setQueryData<Affinity>(["people-affinity-v9", user?.id], (old) => {
      if (!old) return next;
      const mergedBands = bands.map((definition) => {
        const previous = old.bands?.find((band) => band.id === definition.id)?.people || [];
        const incoming = next.bands?.find((band) => band.id === definition.id)?.people || [];
        const people = [...previous, ...incoming]
          .filter((person, index, all) => all.findIndex((candidate) => candidate.id === person.id) === index)
          .sort((a, b) => Number(b.is_friend) - Number(a.is_friend)
            || Number(b.match_score || 0) - Number(a.match_score || 0)
            || a.id.localeCompare(b.id));
        return { ...definition, people };
      });
      return {
        ...old,
        ...next,
        compared_now: (old.compared_now || 0) + (next.compared_now || 0),
        bands: mergedBands,
      };
    }),
  });
  useEffect(() => {
    automaticMatchBatches.current = 0;
  }, [user?.id]);
  useEffect(() => {
    if (!affinityQuery.data?.has_more || moreMatches.isPending || automaticMatchBatches.current >= 3) return;
    automaticMatchBatches.current += 1;
    moreMatches.mutate();
  }, [affinityQuery.data?.has_more, affinityQuery.data?.next_cursor, moreMatches.isPending]);
  const membership = useMutation({
    mutationFn: ({ slug, joined }: { slug: string; joined: boolean }) => functionRequest<TribesResponse>("people-tribes", session!.access_token, { action: joined ? "leave" : "join", slug }),
    onSuccess: (data) => queryClient.setQueryData(["people-tribes-v2", user?.id], data),
    onError: (error: Error) => toast({ title: "Couldn’t update membership", description: error.message }),
  });
  const creatorsQuery = useQuery({
    queryKey: ["people-followed-creators", user?.id], enabled: !!user?.id && tab === "creators",
    queryFn: async () => { const { data, error } = await supabase.from("followed_creators").select("creator_name,creator_role,creator_image,external_id,external_source").eq("user_id", user!.id); if (error) throw error; return data || []; },
  });
  const copyInvite = async () => {
    if (!user?.id) return;
    const url = `${APP_BASE}/invite/${user.id}`;
    try { if (typeof navigator.share === "function") await navigator.share({ title: "Join me on Consumed", text: "Compare your cross-media taste with me on Consumed.", url }); else await navigator.clipboard.writeText(url); toast({ title: "Invite ready", description: typeof navigator.share === "function" ? "Share sheet opened." : "Invite link copied." }); } catch { /* intentional cancellation */ }
  };
  const selectedTribe = tribesQuery.data?.tribes.find((tribe) => tribe.slug === selectedSlug);
  const tabs: Array<{ id: Tab; label: string }> = [{ id: "matches", label: "Matches" }, { id: "friends", label: "Friends" }, { id: "tribes", label: "Tribes" }, { id: "creators", label: "Artists & Creators" }];

  return <div className="min-h-[100dvh] bg-[#fbf8f5] pb-24 text-[#271d3a]">
    <Navigation roomyTopBar />
    <main className="mx-auto max-w-5xl px-4 sm:px-6">
      <header className="pt-6 sm:pt-8">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#ded9d5] bg-[#efedeb] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#5b3e78]"><Users size={15} /></span>
            <p className="text-xs font-semibold leading-4 text-[#594a61] sm:text-sm">
              Discover people who share your taste. Invite friends for private comparisons.
            </p>
          </div>
          <button onClick={copyInvite} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[#533576] px-3.5 text-xs font-bold text-white transition hover:bg-[#432a61]">
            <Share2 size={14} /> Invite
          </button>
        </div>
        <nav className="mt-5 flex overflow-x-auto border-b border-[#dcd5df]" aria-label="People sections">{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`relative shrink-0 px-4 py-2.5 text-[13px] font-bold transition-colors first:pl-0 ${tab === item.id ? "text-[#4b2f70] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-[#523177] first:after:left-0" : "text-[#827887] hover:text-[#493659]"}`}>{item.label}</button>)}</nav>
      </header>

      {tab === "matches" && <Matches query={affinityQuery} more={moreMatches} onSelectPerson={openPerson} onInvite={copyInvite} />}
      {tab === "friends" && <Friends userId={user?.id} />}
      {tab === "tribes" && <Tribes query={tribesQuery} selected={selectedTribe} onSelect={setTribe} membership={membership} />}
      {tab === "creators" && <Creators query={creatorsQuery} />}
    </main>
    <Dialog open={!!selectedPerson} onOpenChange={(open) => !open && setSelectedPerson(null)}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border-violet-100 bg-white px-6 py-9 text-center text-[#211b31] shadow-2xl">
        <DialogHeader className="items-center">
          {selectedPerson && <Avatar person={selectedPerson} />}
          <DialogTitle className="pt-3 text-2xl font-bold tracking-tight text-[#211b31]">
            {selectedPerson ? nameFor(selectedPerson) : "Consumed member"}
          </DialogTitle>
          {selectedPerson?.user_name && <p className="text-sm text-gray-500">@{selectedPerson.user_name}</p>}
          <DialogDescription className="pt-5 text-center">
            <span className="block text-lg font-bold text-[#211b31]">Their profile is for friends</span>
            <span className="mt-2 block text-sm leading-relaxed text-gray-500">
              Connect to see their Entertainment DNA, ratings, lists, and what they’re consuming.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex justify-center">
          {relationshipStatus === "loading" ? (
            <button disabled className="inline-flex items-center rounded-full bg-gray-200 px-6 py-2.5 text-sm font-bold text-gray-500">
              <Loader2 size={17} className="mr-2 animate-spin" /> Checking connection
            </button>
          ) : relationshipStatus === "pending" ? (
            <button onClick={() => setSelectedPerson(null)} className="inline-flex items-center rounded-full bg-gray-200 px-6 py-2.5 text-sm font-bold text-gray-600">
              <Clock size={17} className="mr-2" /> Request Pending
            </button>
          ) : (
            <button
              onClick={sendFriendRequest}
              disabled={isSendingRequest}
              className="inline-flex items-center rounded-full bg-violet-700 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-violet-800 disabled:opacity-60"
            >
              {isSendingRequest ? <Loader2 size={17} className="mr-2 animate-spin" /> : <Users size={17} className="mr-2" />}
              {isSendingRequest ? "Sending…" : "Add Friend"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

function Matches({ query, more, onSelectPerson, onInvite }: { query: ReturnType<typeof useQuery<Affinity>>; more: ReturnType<typeof useMutation<Affinity, Error, void>>; onSelectPerson: (person: Person) => void; onInvite: () => void }) {
  if (query.isLoading) return <div className="mt-7 space-y-3"><div className="h-5 w-48 animate-pulse rounded bg-[#e6e0e7]" />{[1, 2].map((item) => <div key={item} className="h-[252px] animate-pulse rounded-[22px] bg-[#e6e0e7]" />)}<div className="h-28 animate-pulse rounded-xl bg-[#e6e0e7]" /></div>;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;
  const data = query.data;
  if (!data?.ready) return <div className="mt-7"><Readiness readiness={data?.readiness} onInvite={onInvite} /></div>;
  const ordered = bands.map((definition) => ({ ...definition, people: data.bands?.find((band) => band.id === definition.id)?.people || [] })).filter((band) => band.people.length);
  const featured = ordered.flatMap((band) => band.people.map((person) => ({ person, band }))).sort((a, b) => (b.person.match_score || 0) - (a.person.match_score || 0)).slice(0, 2);
  const featuredIds = new Set(featured.map(({ person }) => person.id));
  const remaining = ordered.map((band) => ({ ...band, people: band.people.filter((person) => !featuredIds.has(person.id)) })).filter((band) => band.people.length);
  return <section className="mt-7">
    {!ordered.length ? <div className="rounded-xl border border-dashed border-[#d6ceda] px-5 py-8 text-sm text-[#746b7b]"><p className="font-bold text-[#3b2c47]">No community matches yet.</p><p className="mt-1 leading-5">We’ll add compatible people here as more members build their Entertainment DNA. Your matches do not depend on having friends in the app.</p><button type="button" onClick={onInvite} className="mt-4 inline-flex items-center gap-2 font-bold text-[#503574]"><Share2 size={15} /> Invite someone you know</button></div> :
      <>
        {featured.length > 0 && <div className="mb-9"><div className="mb-3"><p className="text-[10px] font-medium uppercase tracking-[.18em] text-[#817786]">Matches</p><h3 className="mt-2 font-serif text-[24px] font-medium leading-[1.05] tracking-[-.035em] text-[#30203f]">Who likes what you like?</h3><p className="mt-0.5 max-w-xl text-xs leading-4 text-[#7d7382]">See who shares similar Entertainment DNA.</p></div><div className="grid gap-3 lg:grid-cols-2">{featured.map(({ person, band }, index) => <FeaturedMatch key={person.id} person={person} band={band} index={index} onSelect={onSelectPerson} />)}</div></div>}
        {remaining.length > 0 && <div><div className="mb-3 flex items-end justify-between"><div><h3 className="text-base font-bold tracking-[-.02em] text-[#30203f]">More to explore</h3><p className="mt-0.5 text-xs text-[#7d7382]">Every overlap is a place to start.</p></div></div><div className="divide-y divide-[#dfd8e1] border-y border-[#dfd8e1]">{remaining.map((band) => <div key={band.id} className="py-5"><div className="mb-2 flex items-baseline justify-between"><h3 className="text-[11px] font-bold uppercase tracking-[.15em] text-[#65457b]">{band.label}%</h3><span className="text-xs text-[#857a8b]">{band.note}</span></div>{band.people.map((person) => <MatchRow key={person.id} person={person} onSelect={onSelectPerson} />)}</div>)}</div></div>}
      </>}
    {data.has_more && <button disabled={more.isPending} onClick={() => more.mutate()} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#503574] disabled:opacity-50">Compare more people <ChevronRight size={16} /></button>}
  </section>;
}

function FeaturedMatch({ person, band, onSelect }: { person: Person; band: { label: string; note: string }; index: number; onSelect: (person: Person) => void }) {
  const shared = (person.shared_titles || []).map((item) => typeof item === "string" ? { title: item } : { ...item, title: item.title || item.name }).filter((item): item is { title: string; image_url?: string | null; media_type?: string } => Boolean(item.title));
  const posters = shared.filter((item) => Boolean(item.image_url)).slice(0, 3);
  const totalShared = (person.shared_titles?.length || 0) + (person.shared_genres?.length || 0) + (person.shared_creators?.length || 0);
  return <button type="button" onClick={() => onSelect(person)} className="group relative overflow-hidden rounded-[22px] border border-[#e1dadd] bg-[#fffdfb] p-4 text-left shadow-[0_6px_18px_rgba(65,49,55,.055)] transition duration-300 hover:-translate-y-0.5 hover:border-[#cbbfc6] hover:shadow-[0_11px_24px_rgba(65,49,55,.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#624183] focus-visible:ring-offset-2">
    <div className="relative flex items-start gap-3"><Avatar person={person} /><div className="flex h-10 min-w-0 flex-1 flex-col justify-center"><p className="truncate text-[15px] font-bold leading-none text-[#2c2038]">{nameFor(person)}</p><span className={`-ml-0.5 mt-1.5 w-fit rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.09em] ${person.is_friend ? "bg-[#e9f0ec] text-[#527064]" : "bg-[#f0ecef] text-[#857989]"}`}>{person.is_friend ? "Friend" : "New"}</span></div><div className="text-right"><p className="font-serif text-3xl leading-none tracking-[-.06em] text-[#4f2d73]">{Math.round(person.match_score || 0)}%</p><span className="mt-1 inline-block rounded-full bg-[#5b387f] px-2 py-1 text-[8px] font-bold uppercase tracking-[.11em] text-white">{band.note}</span></div></div>
    <div className="relative mt-3.5"><p className="mb-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#67447c]">You both love</p>{posters.length ? <div className="flex gap-2">{posters.map((item, tileIndex) => <SharedTitleTile key={`${item.title}-${tileIndex}`} item={item} />)}{totalShared > posters.length && <div className="flex aspect-[4/5] w-[64px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#e7dfee] text-[#583875]"><span className="text-lg font-bold">+{totalShared - posters.length}</span><span className="text-[9px] font-semibold">more</span></div>}</div> : <p className="line-clamp-2 text-xs leading-5 text-[#756b79]">{shared.slice(0, 3).map((item) => item.title).join(" · ") || "Your taste profiles were compared across media."}</p>}</div>
    <div className="relative mt-4 flex items-center justify-between border-t border-[#dcd2df] pt-3 text-xs font-semibold text-[#614276]"><span>{totalShared ? `${totalShared} thing${totalShared === 1 ? "" : "s"} in common` : "Taste profile compared"}</span><ChevronRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" /></div>
  </button>;
}

function SharedTitleTile({ item }: { item: { title: string; image_url?: string | null } }) {
  return <div className="aspect-[4/5] w-[64px] shrink-0 overflow-hidden rounded-xl bg-[#ddd6e0] shadow-sm"><img src={item.image_url || ""} alt={item.title} className="h-full w-full object-cover" loading="lazy" /></div>;
}

function MatchRow({ person, onSelect }: { person: Person; onSelect: (person: Person) => void }) {
  return <button type="button" onClick={() => onSelect(person)} className="group flex min-h-[62px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-[#ece6ee]"><Avatar person={person} small /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{nameFor(person)}</p><span className={`shrink-0 text-[10px] font-bold ${person.is_friend ? "text-[#356454]" : "text-[#786384]"}`}>{person.is_friend ? "Friend" : "New"}</span></div><p className="truncate text-xs text-[#7d7382]">{evidenceFor(person)}</p></div><span className="font-serif text-lg text-[#4b2d75]">{Math.round(person.match_score || 0)}%</span></button>;
}

function Friends({ userId }: { userId?: string }) {
  return <section className="mt-7"><div className="mb-5"><p className="text-[10px] font-medium uppercase tracking-[.18em] text-[#817786]">Friends</p><h2 className="mt-2 font-serif text-[24px] font-medium leading-[1.05] tracking-[-.035em] text-[#30203f]">Your circle.</h2><p className="mt-1 text-sm leading-5 text-[#746b78]">Find people you know and keep up with the friends you chose to keep close.</p></div>{userId && <FriendsManager userId={userId} />}</section>;
}

function Tribes({ query, selected, onSelect, membership }: { query: ReturnType<typeof useQuery<TribesResponse>>; selected?: Tribe; onSelect: (slug?: string) => void; membership: ReturnType<typeof useMutation<TribesResponse, Error, { slug: string; joined: boolean }>> }) {
  if (query.isLoading) return <div className="mt-7 grid gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl bg-[#e6e0e7]" />)}</div>;
  if (query.isError) return <div className="mt-7"><ErrorState onRetry={() => query.refetch()} /></div>;
  const isReady = Boolean(query.data?.readiness?.ready);
  if (selected) return <TribeDetail tribe={selected} onBack={() => onSelect()} membership={membership} personalized={isReady} />;
  const tribes = query.data?.tribes || [];
  return <section className="mt-7"><div className="mb-5"><p className="text-[10px] font-medium uppercase tracking-[.18em] text-[#817786]">Tribes</p><h2 className="mt-2 font-serif text-[24px] font-medium leading-[1.05] tracking-[-.035em] text-[#30203f]">Where your DNA fits.</h2><p className="mt-1 text-sm leading-5 text-[#746b78]">Find communities built around the things you love together.</p></div>
    {!isReady && <div className="mb-5 rounded-[18px] border border-[#ded7e9] bg-[#f4f0f5] p-4"><p className="text-sm font-bold text-[#342642]">Explore every Tribe now</p><p className="mt-1 text-sm leading-5 text-[#746b7b]">Track {query.data?.readiness?.items_needed || 10} more {(query.data?.readiness?.items_needed || 10) === 1 ? "item" : "items"} to reveal your personal fit and join the communities that match your taste.</p><Link href="/add" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#513879]">Track more <ArrowUpRight size={15} /></Link></div>}
    {!tribes.length ? <div className="rounded-xl border border-dashed border-[#d6ceda] px-5 py-8 text-sm text-[#746b7b]">There are no Tribes to recommend right now.</div> :
      <div className="grid gap-4">{tribes.map((tribe, index) => {
        const icons = [Sparkles, Heart, Moon, Leaf];
        const TribeIcon = icons[index % icons.length];
        const accent = tribe.accent_color || ["#ee9a45", "#e43b8d", "#8661c5", "#7da649"][index % 4];
        const evidence = tribe.evidence.map((item) => item.label || item.value || item.group).filter(Boolean).slice(0, 2);
        const featuredMedia = tribe.media[0];
        return <button
          key={tribe.slug}
          onClick={() => onSelect(tribe.slug)}
          className="group relative overflow-hidden rounded-[20px] border border-[#e4dedb] bg-[#fffdfb] px-4 py-5 text-left shadow-[0_7px_18px_rgba(65,49,55,.055)] transition duration-300 hover:-translate-y-0.5 hover:border-[#cfc4c0] hover:shadow-[0_11px_24px_rgba(65,49,55,.09)] sm:px-6"
        >
          <div className="flex items-start gap-3.5">
            <TribeIcon size={27} strokeWidth={1.8} className="mt-0.5 shrink-0" style={{ color: accent }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-serif text-[24px] font-medium leading-[1.05] tracking-[-.035em] text-[#281e34] sm:text-[27px]">{tribe.name}</h3>
                {isReady && <span className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.04em]" style={{ color: accent, backgroundColor: `${accent}17` }}>{tribe.fit_score}% match</span>}
              </div>
              <p className="mt-2 max-w-xl line-clamp-2 text-sm leading-5 text-[#716971]">{tribe.identity_statement || tribe.description}</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 overflow-hidden">
            {featuredMedia && <span className="inline-flex min-w-0 shrink items-center rounded-full bg-[#f2efed] px-3 py-2 text-xs font-semibold text-[#39313f]">
              <span className="truncate">{featuredMedia.title}</span>
            </span>}
            {evidence.map((label) => <span key={label} className="hidden shrink-0 rounded-full bg-[#f2efed] px-3 py-2 text-xs font-semibold text-[#443a49] min-[390px]:inline-flex">{label}</span>)}
            <span className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ded8d5] bg-white text-[#573876] shadow-sm transition-transform group-hover:translate-x-0.5">
              <ArrowRight size={19} />
            </span>
          </div>
          {tribe.members.length > 0 && <div className="mt-4 flex items-center gap-3 border-t border-[#e6e0df] pt-4"><AvatarStack people={tribe.members} /><span className="text-xs font-semibold text-[#746b78]">{tribe.member_count} {tribe.member_count === 1 ? "person" : "people"} in this Tribe</span></div>}
        </button>;
      })}</div>}
  </section>;
}

function TribeDetail({ tribe, onBack, membership, personalized }: { tribe: Tribe; onBack: () => void; membership: ReturnType<typeof useMutation<TribesResponse, Error, { slug: string; joined: boolean }>>; personalized: boolean }) {
  const { toast } = useToast();
  const share = async () => { const url = `${APP_BASE}/people?tab=tribes&tribe=${encodeURIComponent(tribe.slug)}`; try { if (typeof navigator.share === "function") await navigator.share({ title: tribe.name, text: `Take a look at the ${tribe.name} Tribe on Consumed.`, url }); else await navigator.clipboard.writeText(url); toast({ title: typeof navigator.share === "function" ? "Share sheet opened" : "Tribe link copied" }); } catch { /* intentional cancellation */ } };
  const labels = tribe.evidence.slice(0, 4).map((item) => item.label || item.value || item.group).filter(Boolean);
  return <section className="mt-7"><button onClick={onBack} className="mb-5 inline-flex items-center gap-1 text-sm font-bold text-[#543d72]"><ArrowLeft size={16} /> All Tribes</button>
    <div className="overflow-hidden rounded-[22px] border border-[#ded4e1] bg-[#ece6ec]"><div className="p-6 sm:p-8" style={{ background: `linear-gradient(125deg, ${tribe.accent_color || "#745386"}22, ${tribe.accent_color_2 || "#4d6e9b"}35)` }}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#65457b]">{tribe.is_member ? "Your Tribe" : personalized ? "Recommended community" : "Explore this Tribe"}</p><h2 className="mt-2 font-serif text-4xl tracking-[-.05em]">{tribe.name}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#5f5665]">{tribe.identity_statement || tribe.description}</p></div>{personalized && <span className="rounded-full bg-[#fbf9fa]/70 px-3 py-1.5 text-xs font-bold text-[#4e356a]">{tribe.fit_score}% fit</span>}</div>
      <div className="mt-6 flex flex-wrap gap-2">{personalized && <button disabled={membership.isPending} onClick={() => membership.mutate({ slug: tribe.slug, joined: tribe.is_member })} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${tribe.is_member ? "border border-[#bdb0c4] bg-[#fbf9fa] text-[#4e3d58]" : "bg-[#4f3373] text-[#faf8fb] hover:bg-[#432965]"}`}>{tribe.is_member && <Check size={15} />}{membership.isPending ? "Updating…" : tribe.is_member ? "Leave Tribe" : "Join Tribe"}</button>}<button onClick={share} className="inline-flex items-center gap-2 rounded-full border border-[#bdb0c4] bg-[#fbf9fa]/80 px-4 py-2 text-sm font-bold text-[#503c61]"><Share2 size={15} /> Share</button></div></div>
      <div className="grid gap-6 bg-[#fbf9fa] p-6 sm:grid-cols-2 sm:p-8"><div><h3 className="text-[11px] font-bold uppercase tracking-[.16em] text-[#725581]">{personalized ? "Why you fit" : "What defines this Tribe"}</h3>{personalized && labels.length ? <ul className="mt-3 space-y-2">{labels.map((label) => <li key={label} className="flex gap-2 text-sm text-[#605766]"><Dna size={15} className="mt-0.5 shrink-0 text-[#66447c]" />{label}</li>)}</ul> : <p className="mt-3 text-sm text-[#746b7b]">{personalized ? "Your tracked taste connects with the signals that define this Tribe." : "Track 10 titles to reveal how your taste connects with this community."}</p>}</div><div><h3 className="text-[11px] font-bold uppercase tracking-[.16em] text-[#725581]">Member preview</h3>{tribe.members.length ? <div className="mt-3 flex items-center gap-3"><AvatarStack people={tribe.members} /><span className="text-sm text-[#6f6574]">{tribe.member_count} {tribe.member_count === 1 ? "member" : "members"}</span></div> : <p className="mt-3 text-sm text-[#746b7b]">Membership is taking shape.</p>}</div></div>
      {tribe.media.length > 0 && <div className="border-t border-[#e0d9e3] bg-[#f6f3f5] p-6 sm:p-8"><h3 className="text-[11px] font-bold uppercase tracking-[.16em] text-[#725581]">In the mix</h3><div className="mt-4 flex gap-3 overflow-x-auto pb-1">{tribe.media.slice(0, 6).map((item, index) => <article key={item.id} className="w-28 shrink-0"><div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-[#ddd6e0]">{item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full flex-col justify-between p-3 text-white" style={{ background: `linear-gradient(145deg, ${tribe.accent_color || "#745386"}, ${tribe.accent_color_2 || "#4d6e9b"})` }}><span className="text-[9px] font-bold uppercase tracking-[.14em] text-white/65">{item.media_type}</span><span className="font-serif text-xl text-white/90">0{index + 1}</span></div>}</div><p className="mt-2 line-clamp-2 text-xs font-bold">{item.title}</p>{item.creator && <p className="truncate text-[11px] text-[#7b7180]">{item.creator}</p>}</article>)}</div></div>}
    </div>
  </section>;
}

function Creators({ query }: { query: ReturnType<typeof useQuery<any[]>> }) {
  return <section className="mt-7"><div className="mb-5"><p className="text-sm text-[#6e6475]">The people behind the work you return to.</p><h2 className="mt-1 text-xl font-bold tracking-[-.035em]">Artists & Creators</h2></div>{query.isLoading ? <div className="h-28 animate-pulse rounded-xl bg-[#e6e0e7]" /> : query.data?.length ? <div className="mb-5 flex gap-4 overflow-x-auto border-y border-[#ded7e1] py-4">{query.data.map((creator: any) => <div key={`${creator.external_source}-${creator.external_id}`} className="w-20 shrink-0 text-center">{creator.creator_image ? <img src={creator.creator_image} alt="" className="mx-auto h-12 w-12 rounded-full object-cover" /> : <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#e4ddec] text-xs font-bold text-[#57416f]">{initials(creator.creator_name)}</span>}<p className="mt-2 line-clamp-2 text-xs font-bold">{creator.creator_name}</p><p className="truncate text-[10px] text-[#827887]">{creator.creator_role}</p></div>)}</div> : null}<FollowCreatorsCard dismissible={false} /></section>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="rounded-xl border border-[#ded6e2] bg-[#fbf9fa] p-6 text-sm text-[#746b7b]">This view didn’t load. <button onClick={onRetry} className="ml-1 font-bold text-[#543d72]">Try again</button></div>;
}