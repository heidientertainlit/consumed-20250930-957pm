import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Dna,
  Heart,
  LockKeyhole,
  Music2,
  RefreshCw,
  Sparkles,
  Users,
  UsersRound,
} from "lucide-react";
import Navigation from "@/components/navigation";
import FollowCreatorsCard from "@/components/follow-creators-card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Mode = "friends" | "tribes" | "creators";
type AffinityPerson = {
  id: string;
  user_name?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  match_score?: number;
  is_friend?: boolean;
  shared_titles?: Array<{ title?: string; name?: string } | string>;
  shared_genres?: string[];
  shared_creators?: string[];
  differences?: string[] | { user_unique?: string[]; friend_unique?: string[] };
  insights?: string[] | { compatibilityLine?: string; [key: string]: unknown };
};
type AffinityBand = { id: string; label: string; min: number; max: number; feeling: string; people: AffinityPerson[]; color?: string; tint?: string };
type AffinityResponse = {
  ready?: boolean;
  discoverable?: boolean;
  readiness?: { has_survey?: boolean; item_count?: number; items_needed?: number };
  bands?: AffinityBand[];
  compared_now?: number;
  has_more?: boolean;
  next_cursor?: number | string | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
const bandMeta = [
  { id: "your-people", label: "Your People", min: 80, max: 100, feeling: "They just get it.", color: "#db7657", tint: "#fff0e8" },
  { id: "same-wavelength", label: "Same Wavelength", min: 60, max: 79, feeling: "A lot in common.", color: "#7b63c9", tint: "#f1edff" },
  { id: "common-ground", label: "Common Ground", min: 40, max: 59, feeling: "Some overlap. Some surprises.", color: "#c59a45", tint: "#fbf4dc" },
  { id: "wildcards", label: "Wildcards", min: 0, max: 39, feeling: "Things could get interesting.", color: "#3d9277", tint: "#e7f5ef" },
];

const nameFor = (person: any) =>
  person?.display_name || [person?.first_name, person?.last_name].filter(Boolean).join(" ") || person?.user_name || "A Consumed member";
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

function Avatar({ person, size = "md" }: { person: any; size?: "sm" | "md" | "lg" }) {
  const src = person?.profile_image_url || person?.avatar_url || person?.avatar;
  const dimensions = size === "lg" ? "w-14 h-14 text-lg" : size === "sm" ? "w-9 h-9 text-[10px]" : "w-11 h-11 text-sm";
  return src ? <img src={src} alt="" className={`${dimensions} rounded-full object-cover bg-[#ded7ff]`} /> :
    <span className={`${dimensions} rounded-full shrink-0 bg-[#eee8ff] text-[#6048a1] font-black flex items-center justify-center`}>{initials(nameFor(person))}</span>;
}

function normalizeAffinity(data: any): AffinityResponse {
  const bands = Array.isArray(data?.bands)
    ? data.bands
    : bandMeta.map((meta) => ({ ...meta, people: data?.bands?.[meta.id] || [] }));
  return {
    ...data,
    ready: data?.ready ?? data?.readiness?.ready ?? false,
    discoverable: typeof data?.discoverable === "boolean" ? data.discoverable : (typeof data?.isDiscoverable === "boolean" ? data.isDiscoverable : (typeof data?.is_discoverable === "boolean" ? data.is_discoverable : undefined)),
    bands: bandMeta.map((meta) => {
      const found = bands.find((band: any) => band.id === meta.id || band.label === meta.label || (Number(band.min) === meta.min && Number(band.max) === meta.max));
      return { ...meta, ...(found || {}), people: Array.isArray(found?.people) ? found.people : [] };
    }),
    readiness: data?.readiness || {},
  };
}

async function affinityRequest(token: string, body: Record<string, unknown>): Promise<AffinityResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/people-affinity`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Affinity results are taking a moment.");
  const result = await response.json();
  return body.action === "set-discoverable"
    ? { discoverable: typeof result === "boolean" ? result : result?.discoverable } as AffinityResponse
    : normalizeAffinity(result);
}

function Evidence({ person }: { person: AffinityPerson }) {
  const titles = (person.shared_titles || []).map((item: any) => typeof item === "string" ? item : item?.title || item?.name).filter(Boolean);
  const genres = (person.shared_genres || []).filter(Boolean);
  const creators = (person.shared_creators || []).filter(Boolean);
  const groups = [{ label: "Shared titles", items: titles.slice(0, 3) }, { label: "Shared DNA", items: [...genres.slice(0, 2), ...creators.slice(0, 2)] }].filter((group) => group.items.length);
  return groups.length ? <div className="mt-3 space-y-2">{groups.map((group) => <div key={group.label}><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#9a8b89]">{group.label}</p><div className="flex flex-wrap gap-1.5 mt-1">{group.items.map((item, index) => <span key={`${item}-${index}`} className="rounded-full bg-[#f1edff] px-2.5 py-1 text-[11px] font-bold text-[#634ba6]">{item}</span>)}</div></div>)}</div> : <p className="text-xs text-[#8b7f82] mt-2">Shared DNA details are still coming together.</p>;
}

export default function PeoplePage() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("friends");
  const [selectedBand, setSelectedBand] = useState<string | null>(null);
  const automaticMoreStarted = useRef<string | null>(null);

  const friendsQuery = useQuery({
    queryKey: ["people-friends", user?.id],
    enabled: !!session?.access_token,
    queryFn: async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-friendships`, { method: "POST", headers: { Authorization: `Bearer ${session!.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "getFriends" }) });
      if (!response.ok) throw new Error("Could not load friends");
      const data = await response.json();
      const friends = data.friends || [];
      const ids = friends.map((item: any) => item.friend?.id).filter(Boolean);
      if (!ids.length || !user?.id) return friends;
      const [{ data: from }, { data: to }] = await Promise.all([
        supabase.from("dna_comparisons").select("user_id_2,match_score").eq("user_id_1", user.id).in("user_id_2", ids),
        supabase.from("dna_comparisons").select("user_id_1,match_score").eq("user_id_2", user.id).in("user_id_1", ids),
      ]);
      const scores = new Map<string, number>();
      [...(from || []).map((row: any) => [row.user_id_2, row.match_score]), ...(to || []).map((row: any) => [row.user_id_1, row.match_score])].forEach(([id, score]: any) => scores.set(id, Math.max(scores.get(id) || 0, Math.round(score))));
      return friends.map((item: any) => ({ ...item, match_percentage: scores.get(item.friend?.id) }));
    },
  });

  const tribesQuery = useQuery({
    queryKey: ["people-affinity", "v2", user?.id],
    enabled: !!user?.id && mode === "tribes",
    staleTime: 1000 * 60 * 5,
    queryFn: () => affinityRequest(session!.access_token, { action: "load", batch_size: 5 }),
  });

  const moreMutation = useMutation({
    mutationFn: () => affinityRequest(session!.access_token, { action: "more", cursor: tribesQuery.data?.next_cursor, batch_size: 5 }),
    onSuccess: (next) => queryClient.setQueryData(["people-affinity", "v2", user?.id], (old: AffinityResponse | undefined) => {
      return old ? { ...old, ...next } : next;
    }),
  });
  useEffect(() => {
    if (mode !== "tribes" || tribesQuery.status !== "success" || !tribesQuery.data?.has_more || automaticMoreStarted.current === user?.id) return;
    automaticMoreStarted.current = user?.id || null;
    moreMutation.mutate();
  }, [mode, tribesQuery.status, tribesQuery.data?.has_more, user?.id]);

  const discoverableMutation = useMutation({
    mutationFn: (discoverable: boolean) => affinityRequest(session!.access_token, { action: "set-discoverable", discoverable }),
    onSuccess: (result) => queryClient.setQueryData(["people-affinity", "v2", user?.id], (old: AffinityResponse | undefined) => old ? { ...old, discoverable: result.discoverable } : result),
  });

  const creatorsQuery = useQuery({
    queryKey: ["people-followed-creators", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("followed_creators").select("creator_name,creator_role,creator_image,external_id,external_source").eq("user_id", user!.id);
      if (error) throw error;
      return data || [];
    },
  });

  const friends = friendsQuery.data || [];
  const creators = creatorsQuery.data || [];
  const affinity = tribesQuery.data;
  const activeBand = affinity?.bands?.find((band) => band.id === selectedBand);
  const tabs = [{ id: "friends" as const, label: "Friends", Icon: Users }, { id: "tribes" as const, label: "Tribes", Icon: UsersRound }, { id: "creators" as const, label: "Artists", Icon: Music2 }];
  const setTab = (next: Mode) => { setMode(next); setSelectedBand(null); };

  return <div className="min-h-[100dvh] pb-24 bg-gray-100 text-[#29233b]">
    <Navigation roomyTopBar />
    <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
      <section className="relative overflow-hidden rounded-[30px] bg-[#2d2347] px-6 py-8 sm:px-10 sm:py-11 text-[#fff9f0]">
        <svg aria-hidden="true" viewBox="0 0 100 100" className="pointer-events-none absolute -right-24 -top-10 h-56 w-56 rotate-[-9deg] text-[#c6b8ff] opacity-[.08] sm:-right-28 sm:-top-12 sm:h-64 sm:w-64" style={{ filter: "drop-shadow(0 0 10px rgba(168, 139, 236, .16))" }}>
          <circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" strokeWidth="3.5" />
          <path d="M28 48 q7 -8 14 0" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M58 48 q7 -8 14 0" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M34 62 q16 14 32 0" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
        </svg>
        <div className="relative max-w-xl"><p className="text-[11px] tracking-[.22em] uppercase text-[#ded4ff] font-black mb-3">Your taste, in company</p><h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.08]">People make your Entertainment DNA matter.</h1><p className="mt-4 text-sm sm:text-base leading-relaxed text-[#ddd5e9] max-w-md">Find the familiar edges of your taste — and the surprising ones worth following.</p></div>
      </section>
      <nav className="mt-5 flex gap-1 rounded-xl border border-gray-200 bg-gray-200/80 p-1 shadow-sm" aria-label="People sections">{tabs.map(({ id, label, Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[13px] font-semibold transition-colors ${mode === id ? "border-violet-300 bg-white text-violet-700 shadow-sm" : "border-transparent text-gray-600 hover:bg-white/60 hover:text-gray-800"}`}><Icon size={15} strokeWidth={2.2} />{label}</button>)}</nav>

      {mode === "friends" && <section className="mt-7 animate-in fade-in duration-300"><div className="flex items-end justify-between gap-4 mb-4"><div><p className="eyebrow">Your circle</p><h2 className="section-title">People who know your taste</h2></div><Link href="/friends" className="text-sm font-black text-[#6547b8] flex items-center gap-1">Manage <ArrowUpRight size={15} /></Link></div>{friendsQuery.isLoading ? <div className="grid sm:grid-cols-2 gap-3">{[1,2,3,4].map((item) => <div key={item} className="h-24 rounded-2xl bg-[#e9e0d5] animate-pulse" />)}</div> : friendsQuery.isError ? <div className="surface p-6 text-sm">We couldn’t load your people. <button className="font-black text-[#6547b8]" onClick={() => friendsQuery.refetch()}>Try again</button></div> : friends.length ? <div className="grid sm:grid-cols-2 gap-3">{friends.map((friendship: any) => { const friend = friendship.friend || friendship.users || friendship; const match = friendship.dna_match ?? friendship.match_percentage; return <Link key={friendship.id || friend.id} href={`/user/${friend.id || friendship.friend_id}`} className="surface group p-4 flex items-center gap-3 hover:border-violet-200 transition-colors"><Avatar person={friend} /><div className="min-w-0 flex-1"><p className="font-black truncate">{nameFor(friend)}</p><p className="text-xs text-[#81747a] truncate">{friend.user_name ? `@${friend.user_name}` : "View their Entertainment DNA"}</p></div>{typeof match === "number" ? <span className="text-xs font-black text-[#6547b8] bg-[#eee8ff] px-2 py-1 rounded-lg">{Math.round(match)}% match</span> : <ChevronRight className="text-[#b5aab1]" size={18} />}</Link> })}</div> : <div className="surface border-dashed p-9 text-center"><Dna size={28} className="mx-auto text-[#775cc4] mb-3" /><h3 className="font-black text-lg">Your taste is ready for company.</h3><p className="text-sm text-[#766c76] max-w-sm mx-auto mt-1">Connect with friends and give your shared favorites somewhere to land.</p><Link href="/friends" className="inline-flex mt-5 rounded-xl bg-[#30234f] px-4 py-2.5 text-sm font-black text-white">Find friends</Link></div>}</section>}

      {mode === "tribes" && <section className="mt-7 animate-in fade-in duration-300">
        {activeBand ? <BandDetail band={activeBand} onBack={() => setSelectedBand(null)} /> : <><div className="mb-5"><p className="eyebrow">Personalized affinity</p><h2 className="section-title">Find your people</h2><p className="text-sm text-[#766c76] mt-1 max-w-lg">Not genre groups. These bands reflect how closely your Entertainment DNA lines up with real people.</p></div>
          {tribesQuery.isLoading ? <div className="grid gap-3 sm:grid-cols-2">{[1,2,3,4].map((item) => <div key={item} className="h-40 rounded-[24px] bg-[#e9e0d5] animate-pulse" />)}</div> : tribesQuery.isError ? <div className="surface p-7 text-sm">Your affinity map couldn’t load. <button className="font-black text-[#6547b8]" onClick={() => tribesQuery.refetch()}>Try again</button></div> : !affinity?.ready ? <div className="surface p-9 text-center"><LockKeyhole size={28} className="mx-auto text-[#775cc4] mb-3" /><h3 className="font-black text-lg">Your people are still taking shape.</h3><p className="text-sm text-[#766c76] max-w-sm mx-auto mt-1">{affinity?.readiness?.items_needed ? `Add ${affinity.readiness.items_needed} more titles to unlock personalized affinity.` : "Complete your Entertainment DNA to unlock personalized affinity."}</p><Link href="/me" className="inline-flex mt-5 rounded-xl bg-[#30234f] px-4 py-2.5 text-sm font-black text-white">Build your DNA</Link></div> : <div className="grid gap-3 sm:grid-cols-2">{(affinity.bands || []).map((band) => {
            const visiblePeople = [...band.people]
              .sort((a, b) => Number(Boolean((b as any).profile_image_url || b.avatar_url || (b as any).avatar)) - Number(Boolean((a as any).profile_image_url || a.avatar_url || (a as any).avatar)))
              .slice(0, 4);
            const remaining = Math.max(0, band.people.length - visiblePeople.length);
            return <button key={band.id} onClick={() => setSelectedBand(band.id)} className="group relative min-h-40 w-full overflow-hidden rounded-2xl border border-violet-100 bg-white p-5 text-left shadow-sm transition-colors hover:border-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6547b8] focus-visible:ring-offset-2">
              <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-[.09]" style={{ background: band.color }} />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <UsersRound size={17} strokeWidth={2.6} style={{ color: band.color }} />
                      <h3 className="text-lg font-black tracking-[-.025em]">{band.label}</h3>
                      {band.id === "your-people" && <Sparkles size={15} style={{ color: band.color }} />}
                    </div>
                    <p className="mt-1 text-xs font-black" style={{ color: band.color }}>{band.min}–{band.max}% match</p>
                    <p className="mt-1.5 text-sm text-[#655d69]">{band.feeling}</p>
                  </div>
                </div>
                <div className="mt-auto flex min-h-10 items-end justify-between gap-3 pt-4">
                  {band.people.length > 0 ? <div className="flex items-center">
                    <div className="flex -space-x-2.5">{visiblePeople.map((person) => <span key={person.id} className="rounded-full border-2 border-white shadow-sm"><Avatar person={person} size="sm" /></span>)}</div>
                    {remaining > 0 && <span className="-ml-2.5 flex h-9 min-w-9 items-center justify-center rounded-full border-2 border-white px-1.5 text-[10px] font-black shadow-sm" style={{ background: band.color, color: "#fff" }}>+{remaining}</span>}
                  </div> : <p className="text-xs font-bold text-[#837982]">No matches here yet</p>}
                  {band.people.length > 0 && <p className="text-xs font-black" style={{ color: band.color }}>{band.people.length} {band.people.length === 1 ? "person" : "people"}</p>}
                </div>
              </div>
            </button>;
          })}</div>}
           {affinity?.ready && <><div className="surface mt-4 px-4 py-3 flex items-center gap-3"><div className="flex-1 min-w-0"><p className="text-sm font-black">Appear in affinity discovery</p><p className="text-xs text-[#766c76] mt-0.5">People can find your taste here. Friends can still compare with you either way.</p>{discoverableMutation.isError && <p className="text-[11px] font-bold text-[#b04f56] mt-1">Couldn’t update privacy. Try again.</p>}</div><button role="switch" aria-checked={affinity.discoverable === true} disabled={discoverableMutation.isPending || affinity.discoverable == null} onClick={() => discoverableMutation.mutate(affinity.discoverable !== true)} className={`relative h-6 w-11 rounded-full shrink-0 transition-colors disabled:opacity-50 ${affinity.discoverable === true ? "bg-[#6547b8]" : "bg-[#cfc4c5]"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-[#fffaf2] shadow-sm transition-transform ${affinity.discoverable === true ? "translate-x-6" : "translate-x-1"}`} /></button></div><div className="mt-4 flex items-center justify-between rounded-2xl bg-[#eee8df] px-4 py-3 text-xs text-[#766c76]"><span>{moreMutation.isPending ? "Finding more matches…" : (affinity.compared_now || 0) > 0 ? `${affinity.compared_now} new people compared` : "Affinity updates as your DNA grows."}</span>{affinity.has_more && !moreMutation.isPending && <button onClick={() => moreMutation.mutate()} className="font-black text-[#6547b8] flex items-center gap-1">Find more people<RefreshCw size={13} /></button>}</div></>}
        </>}
      </section>}

      {mode === "creators" && <section className="mt-7 animate-in fade-in duration-300"><div className="mb-4"><p className="eyebrow">The people behind the work</p><h2 className="section-title">Artists & Creators</h2></div>{creatorsQuery.isLoading ? <div className="h-28 rounded-2xl bg-[#e9e0d5] animate-pulse mb-4" /> : creators.length > 0 ? <div className="surface p-5 mb-5"><p className="font-black mb-4">You follow</p><div className="flex gap-4 overflow-x-auto pb-1">{creators.map((creator: any) => <div key={`${creator.external_source}-${creator.external_id}`} className="w-20 shrink-0 text-center"><Avatar person={{ display_name: creator.creator_name, avatar_url: creator.creator_image }} size="lg" /><p className="text-xs font-black mt-2 line-clamp-2">{creator.creator_name}</p><p className="text-[10px] text-[#8a8089] truncate">{creator.creator_role}</p></div>)}</div></div> : <div className="surface border-dashed p-5 mb-5 flex gap-3"><Heart className="text-[#c96172] shrink-0" size={21} /><p className="text-sm text-[#766c76]">You haven’t followed any creators yet. Start with a few whose work helps define your taste.</p></div>}<FollowCreatorsCard dismissible={false} /></section>}
    </main>
    <style>{`.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.18em;font-weight:900;color:#9a6671}.section-title{font-size:1.5rem;font-weight:900;letter-spacing:-.04em}.surface{border:1px solid #ede9fe;background:#fff;border-radius:16px;box-shadow:0 1px 2px 0 rgba(0,0,0,.05)}`}</style>
  </div>;
}

function BandDetail({ band, onBack }: { band: AffinityBand; onBack: () => void }) {
  const ranked = [...band.people].sort((a, b) => Number(b.match_score || 0) - Number(a.match_score || 0));
  return <div><button onClick={onBack} className="flex items-center gap-2 text-sm font-black text-[#6547b8] mb-5 hover:-translate-x-0.5 transition-transform"><ArrowLeft size={17} />All affinity bands</button><div className="rounded-[28px] p-6 sm:p-8 mb-5" style={{ background: band.tint }}><div className="flex items-start gap-4"><div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${band.color}22`, color: band.color }}><Sparkles size={27} /></div><div><p className="eyebrow" style={{ color: band.color }}>Your people</p><h2 className="text-3xl font-black tracking-[-.05em]">{band.label}</h2><p className="font-black mt-1" style={{ color: band.color }}>{band.min}–{band.max}% match</p><p className="text-sm text-[#766c76] mt-2">{band.feeling}</p></div></div></div>{ranked.length ? <div className="space-y-3">{ranked.map((person) => <article key={person.id} className="surface p-4 sm:p-5"><div className="flex items-center gap-3"><Avatar person={person} /><div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><p className="font-black truncate">{nameFor(person)}</p>{person.is_friend ? <span className="rounded-full bg-[#e5f3eb] px-2 py-0.5 text-[10px] font-black text-[#32765b]">Friend</span> : <span className="rounded-full bg-[#eee8ff] px-2 py-0.5 text-[10px] font-black text-[#6547b8]">Potential match</span>}</div><p className="text-xs text-[#81747a]">{person.user_name ? `@${person.user_name}` : "Consumed member"}</p></div>{typeof person.match_score === "number" && <span className="text-lg font-black" style={{ color: band.color }}>{Math.round(person.match_score)}%</span>}<Link href={`/user/${person.id}`} aria-label={`View ${nameFor(person)}`} className="rounded-xl border border-[#d6c8db] px-3 py-2 text-xs font-black text-[#6547b8] hover:bg-[#f1edff]">View</Link></div><Evidence person={person} />{typeof person.insights === "object" && !Array.isArray(person.insights) && person.insights.compatibilityLine && <p className="text-xs italic text-[#766c76] mt-3">“{String(person.insights.compatibilityLine)}”</p>}</article>)}</div> : <div className="surface border-dashed p-9 text-center"><UsersRound size={28} className="mx-auto text-[#775cc4] mb-3" /><h3 className="font-black">No people in this range yet</h3><p className="text-sm text-[#766c76] mt-1">As more DNA gets compared, this band will fill with real possibilities.</p></div>}</div>;
}