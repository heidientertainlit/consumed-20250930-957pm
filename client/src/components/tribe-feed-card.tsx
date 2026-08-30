import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";

type TribePerson = {
  id: string;
  display_name?: string;
  user_name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  profile_image_url?: string;
  avatar?: string;
};

type Tribe = {
  id: string;
  slug: string;
  fit_score: number;
  recommended: boolean;
  member_count: number;
  members: TribePerson[];
  people?: TribePerson[];
  media: Array<{ media_type?: string }>;
  evidence: Array<{ label?: string; group?: string; type?: string; value?: string }>;
};

type TribesResponse = {
  readiness?: { ready?: boolean };
  tribes?: Tribe[];
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

const normalizedMediaType = (type?: string) => {
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

const mediaTypeLabel = (type?: string) => {
  const value = normalizedMediaType(type);
  if (!value) return "";
  if (value === "youtube") return "YouTube";
  return `${value[0].toUpperCase()}${value.slice(1)}`;
};

const connectionKind = (tribe: Tribe) => {
  const evidenceText = tribe.evidence
    .map((item) => `${item.group || ""} ${item.type || ""} ${item.label || ""}`.toLowerCase())
    .join(" ");
  if (/\bratings?\b|\bscoring\b|\bscore pattern\b/.test(evidenceText)) return "ratings";
  if (/\bcomfort\b|\brewatch\b|\breread\b/.test(evidenceText)) return "comfort";
  if (/\brecent\b|\bcurrently\b|\blately\b|\bcurrent interest\b/.test(evidenceText)) return "recent";
  if (tribe.evidence.some((item) => ["title", "titles", "media_title"].includes((item.type || "").toLowerCase()))) return "titles";

  const counts = new Map<string, number>();
  tribe.media.forEach((item) => {
    const type = normalizedMediaType(item.media_type);
    if (type) counts.set(type, (counts.get(type) || 0) + 1);
  });
  const rankedTypes = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = rankedTypes.reduce((sum, [, count]) => sum + count, 0);
  if (rankedTypes.length >= 2 && total > 0 && (rankedTypes[0]?.[1] || 0) / total <= 0.6) return "overall";
  return rankedTypes[0]?.[0] || "general";
};

const positioningFor = (tribe: Tribe) => {
  const kind = connectionKind(tribe);
  if (kind === "overall") return { title: "People who share your taste across entertainment", line: "You overlap across shows, books, movies, and more." };
  if (kind === "books") return { title: "People who share your taste in books", line: "Books are where your tastes connect." };
  if (kind === "movies") return { title: "People who share your taste in movies", line: "You’re drawn to many of the same films and stories." };
  if (kind === "shows") return { title: "People who share your taste in TV", line: "The same shows keep pulling you in." };
  if (kind === "music") return { title: "People who share your taste in music", line: "You come back to many of the same artists and sounds." };
  if (kind === "podcasts") return { title: "People who share your taste in podcasts", line: "You listen for many of the same voices and ideas." };
  if (kind === "games") return { title: "People who share your taste in games", line: "You’re drawn to many of the same ways to play." };
  if (kind === "youtube") return { title: "People who share your taste on YouTube", line: "You follow many of the same creators and rabbit holes." };
  if (kind === "ratings") return { title: "People who rate things like you do", line: "Your highs, lows, and in-betweens follow a similar pattern." };
  if (kind === "comfort") return { title: "People with similar comfort favorites", line: "You return to many of the same familiar favorites." };
  if (kind === "recent") return { title: "People who are into what you’re into lately", line: "Your current interests are moving in the same direction." };
  if (kind === "titles") return { title: "People who love the same titles", line: "Specific favorites are what connect this group." };
  return { title: "People who are into what you’re into", line: "A specific part of your entertainment taste connects this group." };
};

const personName = (person: TribePerson) => {
  if (person.first_name?.trim()) return `${person.first_name.trim()}${person.last_name?.trim() ? ` ${person.last_name.trim()[0].toUpperCase()}.` : ""}`;
  return person.display_name || person.user_name || "Consumed member";
};

function AvatarStack({ people }: { people: TribePerson[] }) {
  return (
    <div className="flex items-center">
      {people.slice(0, 4).map((person, index) => {
        const source = person.profile_image_url || person.avatar_url || person.avatar;
        const className = `grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-[#fffdfb] bg-[#e5dff3] text-[9px] font-bold text-[#4c3972] ${index ? "-ml-2" : ""}`;
        return source ? (
          <img key={person.id} src={source} alt="" className={`${className} object-cover`} />
        ) : (
          <span key={person.id} className={className}>
            {personName(person).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
          </span>
        );
      })}
    </div>
  );
}

export default function TribeFeedCard() {
  const { session, user } = useAuth();
  const query = useQuery<TribesResponse>({
    queryKey: ["people-tribes-v6", user?.id],
    enabled: Boolean(session?.access_token),
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/people-tribes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session!.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "load" }),
      });
      if (!response.ok) throw new Error("Unable to load Tribes");
      return response.json();
    },
  });

  const tribe = useMemo(() => {
    if (!query.data?.readiness?.ready) return undefined;
    const eligible = (query.data.tribes || []).filter((item) => item.recommended && item.fit_score > 0);
    return eligible.sort((a, b) => Number(connectionKind(b) === "overall") - Number(connectionKind(a) === "overall") || b.fit_score - a.fit_score)[0];
  }, [query.data]);

  if (!tribe) return null;

  const positioning = positioningFor(tribe);
  const people = (tribe.members.length ? tribe.members : tribe.people || []).slice(0, 4);
  const mediaTypes = tribe.media.map((item) => mediaTypeLabel(item.media_type)).filter(Boolean);
  const genres = tribe.evidence
    .filter((item) => `${item.group || ""} ${item.type || ""}`.toLowerCase().includes("genre"))
    .map((item) => item.value || item.label || "")
    .filter(Boolean);
  const tags = Array.from(new Set([...mediaTypes, ...genres])).slice(0, 3);

  return (
    <Link href={`/people/tribes/${encodeURIComponent(tribe.id)}`} className="group block">
      <article className="overflow-hidden rounded-[20px] border border-[#b99fcd] bg-[#fffdfb] px-5 py-5 text-left shadow-[0_7px_18px_rgba(65,49,55,.065)] transition active:scale-[.99]">
        <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#67447c]">{Math.round(tribe.fit_score)}% overlap</p>
        <h2 className="mt-2 font-serif text-[22px] font-medium leading-[1.12] tracking-[-.025em] text-[#281e34]">{positioning.title}</h2>
        <p className="mt-3 text-sm leading-5 text-[#746b78]">{positioning.line}</p>
        {tags.length > 0 && <p className="mt-3 text-[12px] font-semibold text-[#685b70]">{tags.join(" · ")}</p>}
        <div className="mt-5 border-t border-[#e6e0df] pt-4">
          <div className="flex items-center gap-3">
            {people.length > 0 && <AvatarStack people={people} />}
            <span className="text-xs font-semibold text-[#746b78]">
              {tribe.member_count > 0 ? `${tribe.member_count} ${tribe.member_count === 1 ? "person" : "people"} in this group` : "People with related taste"}
            </span>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#5b367b]">
            See what they’re into <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </article>
    </Link>
  );
}