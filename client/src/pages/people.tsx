import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowUpRight, ChevronRight, Dna, Heart, Music2, Users, UsersRound } from "lucide-react";
import Navigation from "@/components/navigation";
import FollowCreatorsCard from "@/components/follow-creators-card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Mode = "friends" | "tribes" | "creators";

const nameFor = (person: any) =>
  person?.display_name ||
  [person?.first_name, person?.last_name].filter(Boolean).join(" ") ||
  person?.user_name ||
  "A Consumed member";

const initials = (name: string) =>
  name.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

function Avatar({ person, size = "md" }: { person: any; size?: "sm" | "md" | "lg" }) {
  const src = person?.profile_image_url || person?.avatar_url || person?.avatar;
  const dimensions = size === "lg" ? "w-14 h-14 text-lg" : size === "sm" ? "w-8 h-8 text-[10px]" : "w-11 h-11 text-sm";
  return src ? (
    <img src={src} alt="" className={`${dimensions} rounded-full object-cover bg-[#ded7ff]`} />
  ) : (
    <span className={`${dimensions} rounded-full shrink-0 bg-[#e9e3ff] text-[#5538a2] font-bold flex items-center justify-center`}>
      {initials(nameFor(person))}
    </span>
  );
}

export default function PeoplePage() {
  const { session, user } = useAuth();
  const [mode, setMode] = useState<Mode>("friends");

  const friendsQuery = useQuery({
    queryKey: ["people-friends", user?.id],
    enabled: !!session?.access_token,
    queryFn: async () => {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships", {
        method: "POST",
        headers: { Authorization: `Bearer ${session!.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getFriends" }),
      });
      if (!response.ok) throw new Error("Could not load friends");
      const data = await response.json();
      const friends = data.friends || [];
      const friendIds = friends.map((friendship: any) => friendship.friend?.id).filter(Boolean);
      if (!friendIds.length || !user?.id) return friends;
      const [{ data: comparisonsFromMe }, { data: comparisonsToMe }] = await Promise.all([
        supabase.from("dna_comparisons").select("user_id_2,match_score").eq("user_id_1", user.id).in("user_id_2", friendIds),
        supabase.from("dna_comparisons").select("user_id_1,match_score").eq("user_id_2", user.id).in("user_id_1", friendIds),
      ]);
      const matchMap = new Map<string, number>();
      (comparisonsFromMe || []).forEach((row: any) => matchMap.set(row.user_id_2, Math.round(row.match_score)));
      (comparisonsToMe || []).forEach((row: any) => {
        const score = Math.round(row.match_score);
        if (!matchMap.has(row.user_id_1) || score > matchMap.get(row.user_id_1)!) matchMap.set(row.user_id_1, score);
      });
      return friends.map((friendship: any) => ({
        ...friendship,
        match_percentage: matchMap.get(friendship.friend?.id),
      }));
    },
  });

  const tribesQuery = useQuery({
    queryKey: ["people-tribes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_people_tribes_summary", { member_limit: 4 });
      if (error) throw error;
      return (data || [])
        .map((tribe: any) => ({
          ...tribe,
          isMember: tribe.is_member,
          memberCount: Number(tribe.member_count || 0),
          members: tribe.members || [],
          interests: tribe.interests || [],
        }))
        .sort((a: any, b: any) => Number(b.isMember) - Number(a.isMember) || a.sort_order - b.sort_order);
    },
  });

  const creatorsQuery = useQuery({
    queryKey: ["people-followed-creators", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followed_creators")
        .select("creator_name,creator_role,creator_image,external_id,external_source")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data || [];
    },
  });

  const friends = friendsQuery.data || [];
  const sharedFriends = useMemo(() => friends.slice(0, 4), [friends]);
  const tribes = tribesQuery.data || [];
  const creators = creatorsQuery.data || [];
  const activeMode = [{ id: "friends" as const, label: "Friends", Icon: Users }, { id: "tribes" as const, label: "Tribes", Icon: UsersRound }, { id: "creators" as const, label: "Artists & Creators", Icon: Music2 }];

  return (
    <div className="min-h-[100dvh] pb-24 bg-[#f6f2ec] text-[#242035]">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        <section className="relative overflow-hidden rounded-[28px] bg-[#241b3b] px-6 py-7 sm:px-10 sm:py-10 text-[#fcf7ed]">
          <div className="absolute -right-16 -top-20 w-56 h-56 rounded-full bg-[#e27950] opacity-80" />
          <div className="absolute right-16 bottom-[-75px] w-44 h-44 rounded-full border-[22px] border-[#9d8be8] opacity-50" />
          <div className="relative max-w-xl">
            <p className="text-[11px] tracking-[0.22em] uppercase text-[#d9d0ff] font-bold mb-3">Your taste, in company</p>
            <h1 className="text-3xl sm:text-5xl font-black tracking-[-0.055em] leading-[0.95]">People make your Entertainment DNA matter.</h1>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#d9d3e9] max-w-md">Find the familiar edges of your taste: friends, interest circles, and the artists behind the work you keep returning to.</p>
          </div>
        </section>

        <nav className="mt-5 flex gap-1.5 p-1.5 bg-[#e9e2d9] rounded-2xl overflow-x-auto" aria-label="People sections">
          {activeMode.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setMode(id)} className={`shrink-0 flex-1 min-w-max flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${mode === id ? "bg-[#fffaf2] text-[#34275a] shadow-sm" : "text-[#756c78] hover:text-[#34275a]"}`}>
              <Icon size={16} strokeWidth={2.3} />{label}
            </button>
          ))}
        </nav>

        {mode === "friends" && (
          <section className="mt-6 animate-in fade-in duration-300">
            <div className="flex items-end justify-between gap-4 mb-3">
              <div><p className="text-[11px] uppercase tracking-[.18em] font-bold text-[#9a6671]">Your circle</p><h2 className="text-2xl font-black tracking-tight">People who know your taste</h2></div>
              <Link href="/friends" className="text-sm font-bold text-[#6547b8] flex items-center gap-1">Manage <ArrowUpRight size={15} /></Link>
            </div>
            {friendsQuery.isLoading ? <div className="grid sm:grid-cols-2 gap-3">{[1, 2, 3, 4].map((item) => <div key={item} className="h-24 rounded-2xl bg-[#e9e2d9] animate-pulse" />)}</div> : friendsQuery.isError ? (
              <div className="rounded-2xl border border-[#d8cfc4] bg-[#fffaf2] p-6 text-sm text-[#6e6470]">We couldn’t load your people right now. <button className="font-bold text-[#6547b8]" onClick={() => friendsQuery.refetch()}>Try again</button></div>
            ) : friends.length ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {friends.map((friendship: any) => {
                  const friend = friendship.friend || friendship.users || friendship;
                  const match = friendship.dna_match ?? friendship.match_percentage ?? friendship.dna_comparisons?.match_percentage;
                  return <Link key={friendship.id || friend.id} href={`/user/${friend.id || friendship.friend_id}`} className="group rounded-2xl bg-[#fffaf2] border border-[#dfd5c9] p-4 flex items-center gap-3 hover:-translate-y-0.5 hover:border-[#a895ea] transition-all">
                    <Avatar person={friend} /><div className="min-w-0 flex-1"><p className="font-extrabold truncate">{nameFor(friend)}</p><p className="text-xs text-[#776d79] truncate">{friend.user_name ? `@${friend.user_name}` : "View their Entertainment DNA"}</p></div>
                    {typeof match === "number" ? <span className="text-xs font-black text-[#6547b8] bg-[#ece7ff] px-2 py-1 rounded-lg">{Math.round(match)}% match</span> : <ChevronRight className="text-[#b5aab1] group-hover:text-[#6547b8]" size={18} />}
                  </Link>;
                })}
              </div>
            ) : (
              <div className="rounded-[24px] bg-[#fffaf2] border border-dashed border-[#cfc1b3] p-7 sm:p-10 text-center"><Dna size={28} className="mx-auto text-[#775cc4] mb-3" /><h3 className="font-black text-lg">Your taste is ready for company.</h3><p className="text-sm text-[#766c76] max-w-sm mx-auto mt-1">When you connect with friends, their profile gives your shared favorites somewhere to land.</p><Link href="/friends" className="inline-flex mt-5 rounded-xl bg-[#30234f] px-4 py-2.5 text-sm font-bold text-white">Find friends</Link></div>
            )}
          </section>
        )}

        {mode === "tribes" && (
          <section className="mt-6 animate-in fade-in duration-300">
             <div className="mb-4"><p className="text-[11px] uppercase tracking-[.18em] font-bold text-[#9a6671]">Interest circles</p><h2 className="text-2xl font-black tracking-tight">Tribes shaped by what you love</h2><p className="text-sm text-[#766c76] mt-1">See the people who share the same entertainment interests.</p></div>
            {tribesQuery.isLoading ? <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-32 rounded-2xl bg-[#e9e2d9] animate-pulse" />)}</div> : tribesQuery.isError ? <div className="rounded-2xl bg-[#fffaf2] p-6 border border-[#dfd5c9] text-sm">Tribes are taking a moment to load. <button onClick={() => tribesQuery.refetch()} className="font-bold text-[#6547b8]">Try again</button></div> : tribes.length ? <div className="grid md:grid-cols-2 gap-4">{tribes.map((tribe: any) => {
              const accent = tribe.accent_color || "#7256bc";
              return <article key={tribe.id} className="overflow-hidden rounded-[22px] bg-[#fffaf2] border border-[#dfd5c9]">
                <div className="h-2" style={{ background: accent }} />
                <div className="p-5"><div className="flex gap-4">{tribe.cover_image_url ? <img src={tribe.cover_image_url} alt="" className="w-12 h-12 rounded-2xl object-cover shrink-0" /> : <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-sm font-black" style={{ color: accent, background: `${accent}18` }}>{initials(tribe.name)}</div>}<div className="min-w-0 flex-1"><div className="flex gap-2 items-center"><h3 className="font-black text-lg truncate">{tribe.name}</h3>{tribe.isMember && <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full" style={{ color: accent, background: `${accent}16` }}>Your tribe</span>}</div><p className="mt-1 text-sm text-[#766c76] line-clamp-2">{tribe.description}</p></div></div>
                  {tribe.interests?.length > 0 && <div className="mt-4"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#9a6671]">What they’re into</p><div className="flex flex-wrap gap-1.5">{tribe.interests.slice(0, 4).map((interest: any) => <span key={interest.title} className="rounded-full bg-[#eee8ff] px-2.5 py-1 text-[11px] font-bold text-[#6547b8]">{interest.title}</span>)}</div></div>}
                  <div className="mt-5 flex items-center justify-between gap-3"><div className="flex -space-x-2">{tribe.members.slice(0, 4).map((member: any) => <Link key={member.id} href={`/user/${member.id}`} className="relative group" title={`${nameFor(member)}${member.match_score ? ` · ${Math.round(member.match_score)}% match` : ""}`}><Avatar person={member} size="sm" />{member.match_score ? <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[#30234f] px-1 text-[8px] font-bold text-white ring-2 ring-[#fffaf2]">{Math.round(member.match_score)}%</span> : null}</Link>)}{!tribe.members.length && <span className="w-8 h-8 rounded-full bg-[#eee7df] border-2 border-[#fffaf2]" />}</div><p className="text-xs font-bold text-[#766c76]">{tribe.memberCount ? `${tribe.memberCount} ${tribe.memberCount === 1 ? "person" : "people"}` : "No members yet"}</p></div>
                </div>
              </article>;
            })}</div> : <div className="rounded-[24px] p-9 bg-[#fffaf2] border border-dashed border-[#cfc1b3] text-center"><UsersRound size={28} className="mx-auto text-[#775cc4] mb-3" /><h3 className="font-black">No Tribes yet</h3><p className="mt-1 text-sm text-[#766c76]">As shared-interest groups become available, the people and titles that define them will appear here.</p></div>}
          </section>
        )}

        {mode === "creators" && (
          <section className="mt-6 animate-in fade-in duration-300">
            <div className="mb-4"><p className="text-[11px] uppercase tracking-[.18em] font-bold text-[#9a6671]">The people behind the work</p><h2 className="text-2xl font-black tracking-tight">Artists & Creators</h2></div>
            {creatorsQuery.isLoading ? <div className="h-28 rounded-2xl bg-[#e9e2d9] animate-pulse mb-4" /> : creators.length > 0 && <div className="mb-5 rounded-[22px] border border-[#dfd5c9] bg-[#fffaf2] p-5"><p className="font-black mb-4">You follow</p><div className="flex gap-4 overflow-x-auto pb-1">{creators.map((creator: any) => <div key={`${creator.external_source}-${creator.external_id}`} className="w-20 shrink-0 text-center"><Avatar person={{ display_name: creator.creator_name, avatar_url: creator.creator_image }} size="lg" /><p className="text-xs font-bold mt-2 line-clamp-2">{creator.creator_name}</p><p className="text-[10px] text-[#8a8089] truncate">{creator.creator_role}</p></div>)}</div></div>}
            {!creatorsQuery.isLoading && !creators.length && <div className="rounded-[22px] border border-dashed border-[#cfc1b3] bg-[#fffaf2] p-5 mb-5 flex gap-3"><Heart className="text-[#c96172] shrink-0" size={21} /><p className="text-sm text-[#766c76]">You haven’t followed any creators yet. Start with a few whose work helps define your taste.</p></div>}
            <FollowCreatorsCard dismissible={false} />
          </section>
        )}
        {mode === "friends" && sharedFriends.length > 0 && <p className="mt-6 text-center text-xs text-[#8a8089]">Open a friend’s profile to compare Entertainment DNA and discover overlap.</p>}
      </main>
    </div>
  );
}