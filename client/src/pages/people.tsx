import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowUpRight,
  Atom,
  ChevronRight,
  Dna,
  Heart,
  Info,
  LockKeyhole,
  Music2,
  Orbit,
  RefreshCw,
  Sparkles,
  Smile,
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
  { id: "your-people", label: "Your People", min: 80, max: 100, feeling: "They just get it.", color: "#c4a0ff", tint: "#f1edff" },
  { id: "same-wavelength", label: "Your Orbit", min: 60, max: 79, feeling: "A lot in common.", color: "#c4a0ff", tint: "#f1edff" },
  { id: "common-ground", label: "Common Ground", min: 40, max: 59, feeling: "Some shared favorites.", color: "#c4a0ff", tint: "#f1edff" },
  { id: "wildcards", label: "Wildcards", min: 0, max: 39, feeling: "Different tastes, new takes.", color: "#c4a0ff", tint: "#f1edff" },
];
const bandGradients: Record<string, string> = {
  "your-people": "linear-gradient(135deg, #302452 0%, #1c1630 100%)",
  "same-wavelength": "linear-gradient(135deg, #3b2b62 0%, #2c204d 100%)",
  "common-ground": "linear-gradient(135deg, #514078 0%, #3e3165 100%)",
  wildcards: "linear-gradient(135deg, #684f96 0%, #513a80 100%)",
};

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
      return { ...(found || {}), ...meta, people: Array.isArray(found?.people) ? found.people : [] };
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
  const [mode, setMode] = useState<Mode>("tribes");
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
  const tabs = [
    { id: "tribes" as const, label: "Tribes", Icon: UsersRound },
    { id: "friends" as const, label: "Friends", Icon: Users },
    { id: "creators" as const, label: "Artists & Creators", Icon: Music2 },
  ];
  const setTab = (next: Mode) => { setMode(next); setSelectedBand(null); };

  return <div className="min-h-[100dvh] pb-24 bg-gray-100 text-[#29233b]">
    <Navigation roomyTopBar />
    <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
      <nav className="flex border-b border-gray-300" aria-label="People sections">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={mode === id ? "page" : undefined}
            className={`relative flex min-h-[72px] min-w-0 flex-1 items-center justify-center gap-2 px-1 text-[11px] font-semibold transition-colors sm:text-[14px] ${
              mode === id
                ? "text-violet-700 after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:rounded-full after:bg-violet-700"
                : "text-[#625c67] hover:text-[#29233b]"
            }`}
          >
            <Icon size={21} strokeWidth={1.8} />
            <span className="leading-tight">{label}</span>
          </button>
        ))}
      </nav>

      {mode === "friends" && <section className="mt-7 animate-in fade-in duration-300"><div className="flex items-end justify-between gap-4 mb-4"><div><p className="eyebrow">Your circle</p><h2 className="section-title">People who know your taste</h2></div><Link href="/friends" className="text-sm font-black text-[#6547b8] flex items-center gap-1">Manage <ArrowUpRight size={15} /></Link></div>{friendsQuery.isLoading ? <div className="grid sm:grid-cols-2 gap-3">{[1,2,3,4].map((item) => <div key={item} className="h-24 rounded-2xl bg-[#e9e0d5] animate-pulse" />)}</div> : friendsQuery.isError ? <div className="surface p-6 text-sm">We couldn’t load your people. <button className="font-black text-[#6547b8]" onClick={() => friendsQuery.refetch()}>Try again</button></div> : friends.length ? <div className="grid sm:grid-cols-2 gap-3">{friends.map((friendship: any) => { const friend = friendship.friend || friendship.users || friendship; const match = friendship.dna_match ?? friendship.match_percentage; return <Link key={friendship.id || friend.id} href={`/user/${friend.id || friendship.friend_id}`} className="surface group p-4 flex items-center gap-3 hover:border-violet-200 transition-colors"><Avatar person={friend} /><div className="min-w-0 flex-1"><p className="font-black truncate">{nameFor(friend)}</p><p className="text-xs text-[#81747a] truncate">{friend.user_name ? `@${friend.user_name}` : "View their Entertainment DNA"}</p></div>{typeof match === "number" ? <span className="text-xs font-black text-[#6547b8] bg-[#eee8ff] px-2 py-1 rounded-lg">{Math.round(match)}% match</span> : <ChevronRight className="text-[#b5aab1]" size={18} />}</Link> })}</div> : <div className="surface border-dashed p-9 text-center"><Dna size={28} className="mx-auto text-[#775cc4] mb-3" /><h3 className="font-black text-lg">Your taste is ready for company.</h3><p className="text-sm text-[#766c76] max-w-sm mx-auto mt-1">Connect with friends and give your shared favorites somewhere to land.</p><Link href="/friends" className="inline-flex mt-5 rounded-xl bg-[#30234f] px-4 py-2.5 text-sm font-black text-white">Find friends</Link></div>}</section>}

      {mode === "tribes" && <section className="-mx-4 mt-0 bg-gray-100 px-4 pb-6 pt-7 animate-in fade-in duration-300 sm:-mx-6 sm:px-6">
        {activeBand ? <BandDetail band={activeBand} onBack={() => setSelectedBand(null)} /> : <><div className="mb-4 flex items-center justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-violet-700">Your Tribes</p><h2 className="mt-1 text-[25px] font-bold leading-tight tracking-tight text-[#171328]">Find the people who get you.</h2><p className="mt-1 text-sm text-[#766f80]">Based on your Entertainment DNA.</p></div><Info size={18} className="shrink-0 text-[#8a8390]" /></div>
           {tribesQuery.isLoading ? <div className="grid gap-3"><div className="h-44 rounded-[24px] bg-[#d9d1e5] animate-pulse" />{[1,2,3].map((item) => <div key={item} className="h-24 rounded-2xl bg-[#e5dff0] animate-pulse" />)}</div> : tribesQuery.isError ? <div className="surface p-7 text-sm">Your affinity map couldn’t load. <button className="font-black text-[#6547b8]" onClick={() => tribesQuery.refetch()}>Try again</button></div> : !affinity?.ready ? <div className="surface p-9 text-center"><LockKeyhole size={28} className="mx-auto text-[#775cc4] mb-3" /><h3 className="font-black text-lg">Your people are still taking shape.</h3><p className="text-sm text-[#766c76] max-w-sm mx-auto mt-1">{affinity?.readiness?.items_needed ? `Add ${affinity.readiness.items_needed} more titles to unlock personalized affinity.` : "Complete your Entertainment DNA to unlock personalized affinity."}</p><Link href="/me" className="inline-flex mt-5 rounded-xl bg-[#30234f] px-4 py-2.5 text-sm font-black text-white">Build your DNA</Link></div> : <div className="grid gap-3">{(affinity.bands || []).map((band, index) => {
             const visibleNames = band.people.slice(0, 3).map(nameFor);
             const hasMore = band.people.length > visibleNames.length;
             const BandIcon = band.id === "your-people" ? Smile : band.id === "same-wavelength" ? Orbit : band.id === "common-ground" ? Atom : Sparkles;
              if (index > 0) return <button key={band.id} onClick={() => setSelectedBand(band.id)} className="group flex h-[92px] w-full items-center gap-3 rounded-[20px] border border-[#e4dfe8] bg-[#fcfbfd] px-4 text-left shadow-[0_3px_9px_rgba(34,25,55,.055)] transition-transform active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#594091] to-[#302452] text-[#d3a6ff] shadow-[0_5px_11px_rgba(34,25,55,.16)]"><BandIcon size={30} strokeWidth={1.45} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-[.16em] text-violet-700">{band.label}</span><span className="mt-1 block text-[18px] font-bold leading-none text-[#29233b]">{band.min}–{band.max}% match</span><span className="mt-1 block text-[11px] text-[#817789]">{band.people.length} {band.people.length === 1 ? "person" : "people"}</span></span>
                <ChevronRight size={18} className="shrink-0 text-[#766f80]" />
              </button>;
              return <button key={band.id} onClick={() => setSelectedBand(band.id)} className="group relative min-h-[172px] w-full overflow-hidden rounded-[24px] border border-white/[.14] px-5 py-5 text-left text-white shadow-[0_14px_30px_rgba(43,28,77,.24),inset_0_1px_0_rgba(255,255,255,.08)] transition-transform active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2" style={{ background: bandGradients[band.id] || bandGradients.wildcards }}>
               <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
               <div className="flex h-full flex-col">
                 <div className="flex min-h-0 flex-1 items-center gap-3">
                    <span className="grid h-[76px] w-[76px] shrink-0 place-items-center text-[#d18bff] drop-shadow-[0_0_13px_rgba(191,104,255,.5)]">
                      <BandIcon size={54} strokeWidth={1.35} />
                   </span>
                   <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[.17em] text-[#c4a0ff]">{band.label}</p>
                      <p className="mt-1 text-[22px] font-bold leading-tight">{band.min}–{band.max}% match</p>
                      <p className="mt-1 text-[11px] italic leading-snug text-white/50">{band.feeling}</p>
                   </div>
                    <ChevronRight size={24} className="shrink-0 text-white/85" />
                 </div>
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <p className="truncate text-[12px] font-medium text-white/60">
                     {visibleNames.length ? `${visibleNames.join(", ")}${hasMore ? ", …" : ""}` : "No matches yet"}
                   </p>
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