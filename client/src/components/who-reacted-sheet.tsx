import { useQuery } from "@tanstack/react-query";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";

interface WhoReactedSheetProps {
  postId: string | null; // open when non-null
  onClose: () => void;
}

interface Person {
  id: string;
  name: string;
  avatar?: string | null;
}

function PersonRow({ person }: { person: Person }) {
  const [, setLocation] = useLocation();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); setLocation(`/user/${person.id}`); }}
      className="flex items-center gap-3 py-2 w-full text-left active:opacity-70"
    >
      {person.avatar ? (
        <img src={person.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-semibold">
          {person.name.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="text-sm text-gray-800 font-medium">{person.name}</span>
    </button>
  );
}

export function WhoReactedInline({ postId }: { postId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["who-reacted", postId],
    queryFn: () => fetchReactors(postId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
      </div>
    );
  }
  const ups = data?.ups || [];
  const downs = data?.downs || [];
  if (ups.length === 0 && downs.length === 0) {
    return <p className="text-xs text-gray-400 py-2 px-4">No reactions yet.</p>;
  }
  return (
    <div className="mx-4 mb-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
      {ups.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide pt-1">
            <ThumbsUp size={12} /> {ups.length}
          </div>
          {ups.map((p) => <PersonRow key={`u-${p.id}`} person={p} />)}
        </div>
      )}
      {downs.length > 0 && (
        <div className={ups.length > 0 ? "mt-1 border-t border-gray-100 pt-2" : ""}>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            <ThumbsDown size={12} /> {downs.length}
          </div>
          {downs.map((p) => <PersonRow key={`d-${p.id}`} person={p} />)}
        </div>
      )}
    </div>
  );
}

async function fetchReactors(postId: string) {
  const [likesRes, reactionsRes] = await Promise.all([
        supabase.from("social_post_likes").select("user_id").eq("social_post_id", postId),
    supabase.from("post_reactions").select("user_id, reaction").eq("social_post_id", postId),
  ]);
  const likeIds = (likesRes.data || []).map((r: any) => r.user_id);
  const downIds = (reactionsRes.data || [])
    .filter((r: any) => r.reaction === "disagree")
    .map((r: any) => r.user_id);
  const allIds = Array.from(new Set([...likeIds, ...downIds]));
  const userMap = new Map<string, Person>();
  if (allIds.length > 0) {
    const { data: users } = await supabase
      .from("public_user_profiles")
      .select("id, display_name, user_name, first_name, last_name, avatar")
      .in("id", allIds);
    for (const u of users || []) {
      const name =
        (u.first_name && u.last_name && `${u.first_name} ${u.last_name}`) ||
        u.display_name || u.user_name || "Someone";
      userMap.set(u.id, { id: u.id, name, avatar: u.avatar });
    }
  }
  const resolve = (ids: string[]) =>
    ids.map((id) => userMap.get(id)).filter(Boolean) as Person[];
  return { ups: resolve(likeIds), downs: resolve(downIds) };
}

export default function WhoReactedSheet({ postId, onClose }: WhoReactedSheetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["who-reacted", postId],
    queryFn: () => fetchReactors(postId!),
    enabled: !!postId,
  });

  return (
    <Sheet open={!!postId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-base">Reactions</SheetTitle>
        </SheetHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="pb-6">
            {(data?.ups.length || 0) === 0 && (data?.downs.length || 0) === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">No reactions yet.</p>
            )}
            {(data?.ups.length || 0) > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  <ThumbsUp size={13} /> {data!.ups.length}
                </div>
                {data!.ups.map((p) => <PersonRow key={`u-${p.id}`} person={p} />)}
              </div>
            )}
            {(data?.downs.length || 0) > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  <ThumbsDown size={13} /> {data!.downs.length}
                </div>
                {data!.downs.map((p) => <PersonRow key={`d-${p.id}`} person={p} />)}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
