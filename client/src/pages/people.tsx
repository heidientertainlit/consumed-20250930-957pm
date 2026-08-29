import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, Clock, Dna, Loader2, LockKeyhole, Share2, Sparkles, Star, Users } from "lucide-react";
import Navigation from "@/components/navigation";
import FollowCreatorsCard from "@/components/follow-creators-card";
import FriendsManager from "@/components/friends-manager";
import { IdentityFace } from "@/components/feed-identity-hero";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { APP_BASE } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";

type Tab = "friends" | "tribes" | "creators";
export type Person = {
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
  fit_score: number; evidence: Array<{ label?: string; group?: string; type?: string; value?: string }>; recommended: boolean; is_member: boolean;
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
const mediaTypeLabel = (type?: string) => {
  const value = normalizedGroupMediaType(type);
  if (!value) return "";
  if (value === "youtube") return "YouTube";
  return `${value[0].toUpperCase()}${value.slice(1)}`;
};
const normalizedGroupMediaType = (type?: string) => {
  const value = type?.trim().toLowerCase() || "";
  if (["book", "books"].includes(value)) return "books";
  if (["movie", "movies", "film"].includes(value)) return "movies";
  if (["tv", "show", "shows", "series"].includes(value)) return "shows";
  if (["music", "track", "album", "artist"].includes(value)) return "music";
  if (["podcast", "podcasts"].includes(value)) return "podcasts";
  if (["game", "games"].includes(value)) return "games";
  if (["youtube", "youtube_video", "youtube_channel", "video", "channel"].includes(value)) return "youtube";
  return value;
};
const groupConnectionKind = (tribe: Tribe, allowOverall = true) => {
  const counts = new Map<string, number>();
  tribe.media.forEach((item) => {
    const type = normalizedGroupMediaType(item.media_type);
    if (type) counts.set(type, (counts.get(type) || 0) + 1);
  });
  const rankedTypes = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = rankedTypes.reduce((sum, [, count]) => sum + count, 0);
  const dominantType = rankedTypes[0]?.[0] || "";
  const dominantShare = total ? (rankedTypes[0]?.[1] || 0) / total : 0;
  if (allowOverall && rankedTypes.length >= 2 && dominantShare <= 0.6) return "overall";
  const distinctiveFormat = ["podcasts", "youtube"].find((format) =>
    rankedTypes.some(([type]) => type === format)
    || tribe.evidence.some((item) => item.type === "media_type" && normalizedGroupMediaType(item.value) === format)
  );
  if (distinctiveFormat) return distinctiveFormat;
  const strongestEvidence = tribe.evidence.slice(0, 3);
  const genreEvidenceCount = strongestEvidence.filter((item) =>
    `${item.group || ""} ${item.type || ""}`.toLowerCase().includes("genre")
  ).length;
  if (strongestEvidence.length && genreEvidenceCount >= Math.ceil(strongestEvidence.length / 2)) return "genres";
  if (["books", "movies", "shows", "music", "podcasts", "games", "youtube"].includes(dominantType)) return dominantType;
  return "general";
};
const groupEmotionalPositioning = (tribe: Tribe, allowOverall = true) => {
  const kind = groupConnectionKind(tribe, allowOverall);
  if (kind === "overall") return { label: "A lot in common", line: "You like a lot of the same things." };
  if (kind === "books") return { label: "Your book people", line: "Books are where you connect." };
  if (kind === "movies") return { label: "Same movie language", line: "You’re drawn to the same kinds of stories." };
  if (kind === "shows") return { label: "Same comfort zone", line: "You keep coming back to the same favorites." };
  if (kind === "music") return { label: "On the same wavelength", line: "The same sounds stay with you." };
  if (kind === "podcasts") return { label: "Same conversation", line: "You listen for the same voices and ideas." };
  if (kind === "games") return { label: "Same kind of player", line: "You play for many of the same reasons." };
  if (kind === "youtube") return { label: "Same rabbit holes", line: "You get pulled into the same corners of YouTube." };
  if (kind === "genres") return { label: "Same obsession", line: "You all have a thing for the same kinds of stories." };
  return { label: "One big thing in common", line: "You may be different everywhere else. But not here." };
};

function Avatar({ person, small = false }: { person: Person; small?: boolean }) {
  const src = person.profile_image_url || person.avatar_url || person.avatar;
  const size = small ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";
  return src ? <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover bg-[#d9d4ee]`} /> :
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-[#e5dff3] font-bold text-[#4c3972]`}>{initials(nameFor(person))}</span>;
}

function AvatarStack({ people }: { people: Person[] }) {
  const previewPeople = people.slice(0, 4);
  if (!previewPeople.length) return null;

  return <div className="flex items-center">{previewPeople.map((person, index) => {
    const src = person.profile_image_url || person.avatar_url || person.avatar;
    return src
      ? <img
          key={person.id}
          src={src}
          alt={nameFor(person)}
          className={`h-8 w-8 shrink-0 rounded-full border-2 border-[#fffdfb] bg-[#e5dff3] object-cover ${index ? "-ml-2" : ""}`}
        />
      : <span
          key={person.id}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-[#fffdfb] bg-[#e5dff3] text-[9px] font-bold text-[#4c3972] ${index ? "-ml-2" : ""}`}
        >
          {initials(nameFor(person))}
        </span>;
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

async function hydrateTribeMediaImages(data: TribesResponse, token: string): Promise<TribesResponse> {
  const missing = data.tribes.flatMap((tribe) =>
    tribe.media
      .filter((item) => item.title?.trim() && !item.image_url)
      .map((item) => ({ title: item.title.trim(), mediaType: item.media_type?.trim() || "", id: item.id }))
  );
  const unique = [...new Map(missing.map((item) => [`${item.mediaType.toLowerCase()}:${item.title.toLowerCase()}`, item])).values()];
  const resolvedEntries = await Promise.all(unique.map(async (item) => {
    try {
      const params = new URLSearchParams({ query: item.title });
      if (item.mediaType) params.set("type", item.mediaType);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/media-search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [item.id, ""] as const;
      const payload = await response.json();
      const results = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload) ? payload : [];
      const normalizedTitle = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const match = results.find((result: any) =>
        String(result?.title || result?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "") === normalizedTitle
      ) || results[0];
      const image = match?.poster_url || match?.image || match?.image_url || match?.cover_url || "";
      return [item.id, String(image)] as const;
    } catch {
      return [item.id, ""] as const;
    }
  }));
  const imagesById = new Map(resolvedEntries.filter(([, image]) => Boolean(image)));
  return {
    ...data,
    tribes: data.tribes.map((tribe) => ({
      ...tribe,
      media: tribe.media.map((item) => ({ ...item, image_url: item.image_url || imagesById.get(item.id) || undefined })),
    })),
  };
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
  const tab: Tab = tabParam === "tribes" || tabParam === "creators" ? tabParam : "friends";
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
    queryKey: ["people-affinity-v9", user?.id], enabled: !!session?.access_token && (tab === "friends" || tab === "tribes"),
    queryFn: () => functionRequest<Affinity>("people-affinity", session!.access_token, { action: "load", batch_size: 25 }), staleTime: 60_000,
  });
  const tribesQuery = useQuery({
    queryKey: ["people-tribes-v4", user?.id], enabled: !!session?.access_token,
    queryFn: async () => hydrateTribeMediaImages(
      await functionRequest<TribesResponse>("people-tribes", session!.access_token, { action: "load" }),
      session!.access_token,
    ), staleTime: 60_000,
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
    onSuccess: async (data) => queryClient.setQueryData(["people-tribes-v4", user?.id], await hydrateTribeMediaImages(data, session!.access_token)),
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
  const relatedPeople = (affinityQuery.data?.bands || [])
    .flatMap((band) => band.people)
    .filter((person, index, all) => all.findIndex((candidate) => candidate.id === person.id) === index)
    .sort((a, b) => Number(Boolean(b.profile_image_url || b.avatar_url || b.avatar)) - Number(Boolean(a.profile_image_url || a.avatar_url || a.avatar)));
  const tabs: Array<{ id: Tab; label: string; Icon: typeof Dna }> = [
    { id: "friends", label: "Friends", Icon: Users },
    { id: "tribes", label: "Tribes", Icon: Sparkles },
    { id: "creators", label: "Creators", Icon: Star },
  ];
  return <div className="min-h-[100dvh] bg-[#fbf8f5] pb-24 text-[#271d3a]">
    <Navigation roomyTopBar topBarTone="purple" />
    <header className="relative -mt-px bg-[linear-gradient(to_right,#21183b,#332052,#4a246b)] px-4 pb-6 pt-5 text-white shadow-[0_10px_28px_rgba(41,16,71,.18)] sm:px-6 sm:pb-8 sm:pt-6">
      <div className="mx-auto max-w-5xl">
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 px-6 py-6 shadow-[0_10px_40px_rgba(22,10,38,.24)] sm:px-8 sm:py-8"
          style={{ background: "linear-gradient(155deg, #302452 0%, #1c1630 100%)" }}
        >
          <div className="pointer-events-none absolute right-7 top-5 opacity-80 sm:right-10 sm:top-7">
            <IdentityFace
              size={96}
              content={<Users size={30} strokeWidth={1.35} className="text-violet-300" />}
            />
          </div>
          <div className="relative max-w-[72%] sm:max-w-xl">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-violet-300">People</p>
            <h1
              className="mt-2 text-[28px] leading-[1.12] tracking-[-.02em] text-white"
              style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600 }}
            >
              Entertainment<br />is better with<br />your people.
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-5 text-white/65">Find the people, communities, and creators connected by what you love.</p>
          </div>
        </div>
      </div>
    </header>
    <div className="bg-[#fbf8f5] px-4 pb-1 pt-4 sm:px-6">
      <nav className="mx-auto flex max-w-5xl overflow-x-auto rounded-full border border-[#e2d9e8] bg-[#f3eef5] p-1 shadow-[inset_0_1px_2px_rgba(76,44,98,.05)]" aria-label="People sections">
        {tabs.map(({ id, label, Icon }) => <button
          key={id}
          onClick={() => setTab(id)}
          className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 py-3 text-[12px] font-bold transition-all sm:text-[13px] ${
            tab === id
              ? "bg-[linear-gradient(135deg,#5b168f,#7c2bb7)] text-white shadow-[0_5px_14px_rgba(91,22,143,.25)]"
              : "text-[#34213f] hover:bg-white/55"
          }`}
        >
          <Icon size={17} strokeWidth={2} className={tab === id ? "text-white" : "text-[#69358d]"} />
          {label}
        </button>)}
      </nav>
    </div>
    <main className="mx-auto max-w-5xl px-4 sm:px-6">

      {tab === "friends" && <Friends query={affinityQuery} more={moreMatches} onSelectPerson={openPerson} onInvite={copyInvite} userId={user?.id} />}
      {tab === "tribes" && <Tribes query={tribesQuery} selected={selectedTribe} onSelect={setTribe} membership={membership} relatedPeople={relatedPeople} />}
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

function Friends({ query, more, onSelectPerson, onInvite, userId }: { query: ReturnType<typeof useQuery<Affinity>>; more: ReturnType<typeof useMutation<Affinity, Error, void>>; onSelectPerson: (person: Person) => void; onInvite: () => void; userId?: string }) {
  if (query.isLoading) return <section className="mt-7"><div className="mb-5"><p className="text-[10px] font-medium uppercase tracking-[.18em] text-[#817786]">Friends</p><h2 className="mt-2 font-serif text-[24px] font-medium leading-[1.05] tracking-[-.035em] text-[#30203f]">Your people.</h2><p className="mt-1 text-sm leading-5 text-[#746b78]">Find new connections through your taste and keep up with the friends already in your circle.</p></div><div className="space-y-3">{[1, 2].map((item) => <div key={item} className="h-[252px] animate-pulse rounded-[22px] bg-[#e6e0e7]" />)}<div className="h-28 animate-pulse rounded-xl bg-[#e6e0e7]" /></div></section>;
  const data = query.data;
  if (query.isError) return <section className="mt-7"><FriendsHeader /><ErrorState onRetry={() => query.refetch()} />{userId && <div className="mt-8"><FriendsManager userId={userId} /></div>}</section>;
  if (!data?.ready) return <section className="mt-7"><FriendsHeader /><Readiness readiness={data?.readiness} onInvite={onInvite} />{userId && <div className="mt-9 border-t border-[#e3dce5] pt-7"><FriendsManager userId={userId} /></div>}</section>;
  const ordered = bands.map((definition) => ({ ...definition, people: data.bands?.find((band) => band.id === definition.id)?.people || [] })).filter((band) => band.people.length);
  const friendMatchScores = Object.fromEntries(
    ordered.flatMap((band) => band.people)
      .filter((person) => person.is_friend && person.match_score != null)
      .map((person) => [person.id, Math.round(person.match_score || 0)])
  );
  const closestFriend = ordered
    .flatMap((band) => band.people)
    .filter((person) => person.is_friend && person.match_score != null)
    .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))[0];
  const discoverable = ordered.map((band) => ({ ...band, people: band.people.filter((person) => !person.is_friend) })).filter((band) => band.people.length);
  const featured = discoverable.flatMap((band) => band.people.map((person) => ({ person, band }))).sort((a, b) => (b.person.match_score || 0) - (a.person.match_score || 0)).slice(0, 2);
  const featuredIds = new Set(featured.map(({ person }) => person.id));
  const remaining = discoverable.map((band) => ({ ...band, people: band.people.filter((person) => !featuredIds.has(person.id)) })).filter((band) => band.people.length);
  return <section className="mt-7">
    <FriendsHeader />
    {userId && <div className="mb-10"><div className="mb-3"><h3 className="text-base font-bold tracking-[-.02em] text-[#30203f]">Your circle</h3><p className="mt-0.5 text-xs text-[#7d7382]">Search, review requests, invite people, and find your closest friends.</p></div><FriendsManager userId={userId} matchScores={friendMatchScores} featuredFriend={closestFriend} /></div>}
    <div className="mb-9 border-t border-[#e2dbe5] pt-7">
      <div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#65457b]">Potential new friends</p><p className="mt-1 max-w-xl text-xs leading-4 text-[#7d7382]">People outside your circle with the strongest Entertainment DNA overlap.</p></div>
      {featured.length > 0 ? <div className="grid gap-3 lg:grid-cols-2">{featured.map(({ person, band }, index) => <FeaturedMatch key={person.id} person={person} band={band} index={index} onSelect={onSelectPerson} />)}</div> : <div className="rounded-xl border border-dashed border-[#d6ceda] px-5 py-7 text-sm text-[#746b7b]"><p className="font-bold text-[#3b2c47]">No new taste matches yet.</p><p className="mt-1 leading-5">We’ll add compatible people here as more members build their Entertainment DNA.</p></div>}
    </div>
    {remaining.length > 0 && <div><div className="mb-3 flex items-end justify-between"><div><h3 className="text-base font-bold tracking-[-.02em] text-[#30203f]">More people to explore</h3><p className="mt-0.5 text-xs text-[#7d7382]">Every overlap is a place to start.</p></div></div><div className="divide-y divide-[#dfd8e1] border-y border-[#dfd8e1]">{remaining.map((band) => <div key={band.id} className="py-5"><div className="mb-2 flex items-baseline justify-between"><h3 className="text-[11px] font-bold uppercase tracking-[.15em] text-[#65457b]">{band.label}%</h3><span className="text-xs text-[#857a8b]">{band.note}</span></div>{band.people.map((person) => <MatchRow key={person.id} person={person} onSelect={onSelectPerson} />)}</div>)}</div></div>}
    {data.has_more && <button disabled={more.isPending} onClick={() => more.mutate()} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#503574] disabled:opacity-50">Compare more people <ChevronRight size={16} /></button>}
  </section>;
}

function FriendsHeader() {
  return <div className="mb-5"><p className="text-[10px] font-medium uppercase tracking-[.18em] text-[#817786]">Friends</p><h2 className="mt-2 font-serif text-[24px] font-medium leading-[1.05] tracking-[-.035em] text-[#30203f]">Your people.</h2><p className="mt-1 text-sm leading-5 text-[#746b78]">Find new connections through your taste and keep up with the friends already in your circle.</p></div>;
}

function FeaturedMatch({ person, band, onSelect }: { person: Person; band: { label: string; note: string }; index: number; onSelect: (person: Person) => void }) {
  const shared = (person.shared_titles || []).map((item) => typeof item === "string" ? { title: item } : { ...item, title: item.title || item.name }).filter((item): item is { title: string; image_url?: string | null; media_type?: string } => Boolean(item.title));
  const posters = shared.filter((item) => Boolean(item.image_url)).slice(0, 3);
  const totalShared = (person.shared_titles?.length || 0) + (person.shared_genres?.length || 0) + (person.shared_creators?.length || 0);
  return <button type="button" onClick={() => onSelect(person)} className="group relative overflow-hidden rounded-[22px] border border-[#e1dadd] bg-[#fffdfb] p-4 text-left shadow-[0_6px_18px_rgba(65,49,55,.055)] transition duration-300 hover:-translate-y-0.5 hover:border-[#cbbfc6] hover:shadow-[0_11px_24px_rgba(65,49,55,.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#624183] focus-visible:ring-offset-2">
    <div className="relative flex items-start gap-3"><Avatar person={person} /><div className="flex h-10 min-w-0 flex-1 flex-col justify-center"><p className="truncate text-[15px] font-bold leading-none text-[#2c2038]">{nameFor(person)}</p><span className="mt-1.5 w-fit rounded-full bg-[#eee6f3] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.09em] text-[#69477f]">New match</span></div><div className="text-right"><p className="font-serif text-3xl leading-none tracking-[-.06em] text-[#4f2d73]">{Math.round(person.match_score || 0)}%</p><span className="mt-1 inline-block rounded-full bg-[#5b387f] px-2 py-1 text-[8px] font-bold uppercase tracking-[.11em] text-white">{band.note}</span></div></div>
    <div className="relative mt-3.5"><p className="mb-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#67447c]">You both love</p>{posters.length ? <div className="flex gap-2">{posters.map((item, tileIndex) => <SharedTitleTile key={`${item.title}-${tileIndex}`} item={item} />)}{totalShared > posters.length && <div className="flex aspect-[4/5] w-[64px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#e7dfee] text-[#583875]"><span className="text-lg font-bold">+{totalShared - posters.length}</span><span className="text-[9px] font-semibold">more</span></div>}</div> : <p className="line-clamp-2 text-xs leading-5 text-[#756b79]">{shared.slice(0, 3).map((item) => item.title).join(" · ") || "Your taste profiles were compared across media."}</p>}</div>
    <div className="relative mt-4 flex items-center justify-between border-t border-[#dcd2df] pt-3 text-xs font-semibold text-[#614276]"><span>{totalShared ? `${totalShared} thing${totalShared === 1 ? "" : "s"} in common` : "Taste profile compared"}</span><ChevronRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" /></div>
  </button>;
}

function SharedTitleTile({ item }: { item: { title: string; image_url?: string | null } }) {
  return <div className="aspect-[4/5] w-[64px] shrink-0 overflow-hidden rounded-xl bg-[#ddd6e0] shadow-sm"><img src={item.image_url || ""} alt={item.title} className="h-full w-full object-cover" loading="lazy" /></div>;
}

function MatchRow({ person, onSelect }: { person: Person; onSelect: (person: Person) => void }) {
  return <button type="button" onClick={() => onSelect(person)} className="group flex min-h-[62px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-[#ece6ee]"><Avatar person={person} small /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{nameFor(person)}</p><span className="shrink-0 rounded-full bg-[#eee6f3] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.08em] text-[#69477f]">New match</span></div><p className="truncate text-xs text-[#7d7382]">{evidenceFor(person)}</p></div><span className="font-serif text-lg text-[#4b2d75]">{Math.round(person.match_score || 0)}%</span></button>;
}

function Tribes({ query, selected, onSelect, membership, relatedPeople }: { query: ReturnType<typeof useQuery<TribesResponse>>; selected?: Tribe; onSelect: (slug?: string) => void; membership: ReturnType<typeof useMutation<TribesResponse, Error, { slug: string; joined: boolean }>>; relatedPeople: Person[] }) {
  if (query.isLoading) return <div className="mt-7 grid gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl bg-[#e6e0e7]" />)}</div>;
  if (query.isError) return <div className="mt-7"><ErrorState onRetry={() => query.refetch()} /></div>;
  const isReady = Boolean(query.data?.readiness?.ready);
  const tribes = query.data?.tribes || [];
  const displayTribes = tribes
    .map((tribe, originalIndex) => ({ tribe, originalIndex }))
    .sort((a, b) => {
      const overallDifference = Number(groupConnectionKind(b.tribe) === "overall") - Number(groupConnectionKind(a.tribe) === "overall");
      if (overallDifference) return overallDifference;
      if (groupConnectionKind(a.tribe) === "overall" && groupConnectionKind(b.tribe) === "overall") return b.tribe.fit_score - a.tribe.fit_score;
      return a.originalIndex - b.originalIndex;
    })
    .map(({ tribe }) => tribe);
  const overallTribeSlug = displayTribes.find((tribe) => groupConnectionKind(tribe) === "overall")?.slug;
  if (selected) return <TribeDetail tribe={selected} onBack={() => onSelect()} membership={membership} personalized={isReady} allowOverall={selected.slug === overallTribeSlug} />;
  return <section id="tribe-list" className="mt-7 scroll-mt-4">
    <div className="mb-5">
      <p className="text-[10px] font-medium uppercase tracking-[.18em] text-[#817786]">Tribes</p>
      <h2 className="mt-2 font-serif text-[24px] font-medium leading-[1.05] tracking-[-.035em] text-[#30203f]">Where your DNA fits.</h2>
      <p className="mt-1 text-sm leading-5 text-[#746b78]">Find communities built around what you love — and discover what to watch, read, play, and talk about next.</p>
    </div>
    {!isReady && <div className="mb-5 rounded-[18px] border border-[#ded7e9] bg-[#f4f0f5] p-4"><p className="text-sm font-bold text-[#342642]">Explore taste groups now</p><p className="mt-1 text-sm leading-5 text-[#746b7b]">Track {query.data?.readiness?.items_needed || 10} more {(query.data?.readiness?.items_needed || 10) === 1 ? "item" : "items"} to reveal which groups share the most with you.</p><Link href="/add" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#513879]">Track more <ArrowUpRight size={15} /></Link></div>}
    {!displayTribes.length ? <div className="rounded-xl border border-dashed border-[#d6ceda] px-5 py-8 text-sm text-[#746b7b]">There are no taste groups to recommend right now.</div> :
      <div className="grid gap-4">{displayTribes.map((tribe, index) => {
        const accent = tribe.accent_color || ["#ee9a45", "#e43b8d", "#8661c5", "#7da649"][index % 4];
        const media = tribe.media.filter((item) => item.title?.trim()).slice(0, 4);
        const typeLabels = Array.from(new Set(media.map((item) => item.media_type?.trim()).filter(Boolean)))
          .slice(0, 3)
          .map((type) => mediaTypeLabel(type));
        const emotional = groupEmotionalPositioning(tribe, tribe.slug === overallTribeSlug);
        const cardPeople = tribe.members.length
          ? tribe.members.slice(0, 4)
          : relatedPeople.length
            ? Array.from({ length: Math.min(4, relatedPeople.length) }, (_, offset) => relatedPeople[(index * 2 + offset) % relatedPeople.length])
            : [];
        return <button
          key={tribe.slug}
          onClick={() => onSelect(tribe.slug)}
          className="group relative overflow-hidden rounded-[20px] border border-[#d8cce1] bg-[#fffdfb] px-4 py-5 text-left shadow-[0_7px_18px_rgba(65,49,55,.065)] transition duration-300 hover:-translate-y-0.5 hover:border-[#b99fcd] hover:shadow-[0_12px_28px_rgba(91,49,133,.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#755294] focus-visible:ring-offset-2 sm:px-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[.055em] text-[#281e34]">{isReady ? `${Math.round(tribe.fit_score)}% — ${emotional.label}` : emotional.label}</p>
              <h3 className="mt-2 font-serif text-[22px] font-normal italic leading-[1.18] tracking-[-.025em] text-[#5d5062] sm:text-[24px]">{emotional.line}</h3>
            </div>
          </div>
          {media.length > 0 && <div className="mt-4 flex gap-2">
            {media.map((item, mediaIndex) => <div key={`${item.id}-${mediaIndex}`} className="relative aspect-[4/5] w-[58px] shrink-0 overflow-hidden rounded-lg bg-[#ddd6e0] shadow-sm">
              {item.image_url
                ? <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                : <div className="flex h-full items-end p-2 text-[9px] font-bold leading-tight text-white" style={{ background: `linear-gradient(145deg, ${accent}, ${tribe.accent_color_2 || "#4d6e9b"})` }}>{item.title}</div>}
            </div>)}
          </div>}
          <div className="mt-4 flex items-center gap-2">
            {typeLabels.map((label) => <span key={label} className="rounded-full bg-[#eee8f4] px-2.5 py-1.5 text-[11px] font-semibold text-[#5b466d]">{label}</span>)}
            <span className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#603782] text-white shadow-[0_4px_12px_rgba(96,55,130,.24)] transition group-hover:translate-x-0.5 group-hover:bg-[#4f2c70]"><ArrowRight size={19} /></span>
          </div>
          {cardPeople.length > 0 && <div className="mt-4 flex items-center gap-3 border-t border-[#e6e0df] pt-4">
            <AvatarStack people={cardPeople} />
            <span className="text-xs font-semibold text-[#746b78]">
              {tribe.member_count > 0 ? `${tribe.member_count} ${tribe.member_count === 1 ? "person" : "people"} in this group` : "People with related taste"}
            </span>
          </div>}
        </button>;
      })}</div>}
  </section>;
}

function TribeDetail({ tribe, onBack, membership, personalized, allowOverall }: { tribe: Tribe; onBack: () => void; membership: ReturnType<typeof useMutation<TribesResponse, Error, { slug: string; joined: boolean }>>; personalized: boolean; allowOverall: boolean }) {
  const { toast } = useToast();
  const emotional = groupEmotionalPositioning(tribe, allowOverall);
  const mediaTypes = Array.from(new Set(tribe.media.map((item) => normalizedGroupMediaType(item.media_type)).filter(Boolean)))
    .slice(0, 4)
    .map((type) => mediaTypeLabel(type));
  const share = async () => {
    const url = `${APP_BASE}/people?tab=tribes&tribe=${encodeURIComponent(tribe.slug)}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "People with taste like yours", text: "Take a look at this taste group on Consumed.", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      toast({ title: typeof navigator.share === "function" ? "Share sheet opened" : "Group link copied" });
    } catch { /* intentional cancellation */ }
  };
  return <section className="mt-7"><button onClick={onBack} className="mb-5 inline-flex items-center gap-1 text-sm font-bold text-[#543d72]"><ArrowLeft size={16} /> All taste groups</button>
    <div className="overflow-hidden rounded-[22px] border border-[#ded4e1] bg-[#ece6ec]"><div className="p-6 sm:p-8" style={{ background: `linear-gradient(125deg, ${tribe.accent_color || "#745386"}22, ${tribe.accent_color_2 || "#4d6e9b"}35)` }}><div><p className="text-sm font-bold uppercase tracking-[.055em] text-[#30203f]">{personalized ? `${Math.round(tribe.fit_score)}% — ${emotional.label}` : emotional.label}</p><h2 className="mt-3 max-w-xl font-serif text-3xl italic leading-[1.08] tracking-[-.04em] text-[#514557] sm:text-4xl">{emotional.line}</h2><p className="mt-4 max-w-xl text-sm leading-6 text-[#5f5665]">See the media and people behind the connection.</p></div>
      <div className="mt-6 flex flex-wrap gap-2">{personalized && <button disabled={membership.isPending} onClick={() => membership.mutate({ slug: tribe.slug, joined: tribe.is_member })} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${tribe.is_member ? "border border-[#bdb0c4] bg-[#fbf9fa] text-[#4e3d58]" : "bg-[#4f3373] text-[#faf8fb] hover:bg-[#432965]"}`}>{tribe.is_member && <Check size={15} />}{membership.isPending ? "Updating…" : tribe.is_member ? "Leave group" : "Join group"}</button>}<button onClick={share} className="inline-flex items-center gap-2 rounded-full border border-[#bdb0c4] bg-[#fbf9fa]/80 px-4 py-2 text-sm font-bold text-[#503c61]"><Share2 size={15} /> Share</button></div></div>
      <div className="grid gap-6 bg-[#fbf9fa] p-6 sm:grid-cols-2 sm:p-8"><div><h3 className="text-[11px] font-bold uppercase tracking-[.16em] text-[#725581]">What they’re into</h3>{mediaTypes.length ? <div className="mt-3 flex flex-wrap gap-2">{mediaTypes.map((label) => <span key={label} className="rounded-full bg-[#eee8f4] px-3 py-2 text-xs font-semibold text-[#5b466d]">{label}</span>)}</div> : <p className="mt-3 text-sm text-[#746b7b]">Add more media to reveal the types this group shares.</p>}</div><div><h3 className="text-[11px] font-bold uppercase tracking-[.16em] text-[#725581]">People in this group</h3>{tribe.members.length ? <div className="mt-3 flex items-center gap-3"><AvatarStack people={tribe.members} /><span className="text-sm text-[#6f6574]">{tribe.member_count} {tribe.member_count === 1 ? "person" : "people"}</span></div> : <p className="mt-3 text-sm text-[#746b7b]">This group is taking shape.</p>}</div></div>
      {tribe.media.length > 0 && <div className="border-t border-[#e0d9e3] bg-[#f6f3f5] p-6 sm:p-8"><h3 className="text-[11px] font-bold uppercase tracking-[.16em] text-[#725581]">Media that connects this group</h3><div className="mt-4 flex gap-3 overflow-x-auto pb-1">{tribe.media.slice(0, 6).map((item, index) => <article key={item.id} className="w-28 shrink-0"><div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-[#ddd6e0]">{item.image_url ? <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col justify-between p-3 text-white" style={{ background: `linear-gradient(145deg, ${tribe.accent_color || "#745386"}, ${tribe.accent_color_2 || "#4d6e9b"})` }}><span className="text-[9px] font-bold uppercase tracking-[.14em] text-white/65">{item.media_type}</span><span className="font-serif text-xl text-white/90">0{index + 1}</span></div>}</div><p className="mt-2 line-clamp-2 text-xs font-bold">{item.title}</p>{item.creator && <p className="truncate text-[11px] text-[#7b7180]">{item.creator}</p>}</article>)}</div></div>}
    </div>
  </section>;
}

function Creators({ query }: { query: ReturnType<typeof useQuery<any[]>> }) {
  return <section className="mt-7"><div className="mb-5"><p className="text-sm text-[#6e6475]">The people behind the work you return to.</p><h2 className="mt-1 text-xl font-bold tracking-[-.035em]">Artists & Creators</h2></div>{query.isLoading ? <div className="h-28 animate-pulse rounded-xl bg-[#e6e0e7]" /> : query.data?.length ? <div className="mb-5 flex gap-4 overflow-x-auto border-y border-[#ded7e1] py-4">{query.data.map((creator: any) => <div key={`${creator.external_source}-${creator.external_id}`} className="w-20 shrink-0 text-center">{creator.creator_image ? <img src={creator.creator_image} alt="" className="mx-auto h-12 w-12 rounded-full object-cover" /> : <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#e4ddec] text-xs font-bold text-[#57416f]">{initials(creator.creator_name)}</span>}<p className="mt-2 line-clamp-2 text-xs font-bold">{creator.creator_name}</p><p className="truncate text-[10px] text-[#827887]">{creator.creator_role}</p></div>)}</div> : null}<FollowCreatorsCard dismissible={false} /></section>;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="rounded-xl border border-[#ded6e2] bg-[#fbf9fa] p-6 text-sm text-[#746b7b]">This view didn’t load. <button onClick={onRetry} className="ml-1 font-bold text-[#543d72]">Try again</button></div>;
}