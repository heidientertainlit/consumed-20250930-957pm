import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Plus, Loader2, Users, Search, X, CheckCircle,
  Tv, Film, BookOpen, Music, Globe, Lock, Building2,
  Copy, ExternalLink, Hash, ChevronRight, Palette,
} from "lucide-react";

type RoomCategory = "media" | "genre" | "platform";
type MediaType = "tv" | "movie" | "book" | "music" | "podcast" | "";

interface RoomForm {
  name: string;
  description: string;
  room_category: RoomCategory;
  series_tag: string;
  media_type: MediaType;
  media_image: string;
  accent_color: string;
  is_public: boolean;
  partner_name: string;
  partner_logo_url: string;
}

interface UserResult {
  id: string;
  user_name: string;
  display_name: string;
}

interface RoomRow {
  id: string;
  name: string;
  description: string | null;
  room_category: string | null;
  series_tag: string | null;
  media_type: string | null;
  is_official: boolean;
  is_public: boolean;
  accent_color: string | null;
  media_image: string | null;
  status: string | null;
  created_at: string;
  invite_code: string;
  member_count?: number;
}

const MEDIA_TYPE_OPTS: { value: MediaType; label: string; Icon: any }[] = [
  { value: "tv", label: "TV Show", Icon: Tv },
  { value: "movie", label: "Movie", Icon: Film },
  { value: "book", label: "Book / Series", Icon: BookOpen },
  { value: "music", label: "Music / Artist", Icon: Music },
  { value: "", label: "Mixed / None", Icon: Globe },
];

const ROOM_CAT_OPTS: { value: RoomCategory; label: string; pill: string; desc: string }[] = [
  { value: "media", label: "Media Room", pill: "media", desc: "Tied to a specific show, movie, book, or artist (e.g. Paradise, Emma M. Lion)" },
  { value: "genre", label: "Genre Room", pill: "genre", desc: "A genre or topic community (e.g. True Crime, Sci-Fi, Romance)" },
  { value: "platform", label: "Partner Room", pill: "partner", desc: "Branded partner / network room (e.g. Reelz, Peacock)" },
];

const PILL_COLORS: Record<string, string> = {
  media: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  genre: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  platform: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  partner: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
};

function Pill({ label }: { label: string }) {
  const color = PILL_COLORS[label] ?? PILL_COLORS.media;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  );
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const DEFAULT_FORM: RoomForm = {
  name: "",
  description: "",
  room_category: "media",
  series_tag: "",
  media_type: "tv",
  media_image: "",
  accent_color: "",
  is_public: true,
  partner_name: "",
  partner_logo_url: "",
};

export default function AdminRoomsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"create" | "manage">("create");
  const [form, setForm] = useState<RoomForm>(DEFAULT_FORM);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<UserResult[]>([]);
  const [userSearchResults, setUserSearchResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<{ id: string; invite_code: string; name: string } | null>(null);

  const set = (k: keyof RoomForm, v: any) => setForm(f => ({ ...f, [k]: v }));

  const { data: existingRooms, isLoading: roomsLoading } = useQuery<RoomRow[]>({
    queryKey: ["admin-rooms-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pools")
        .select("id, name, description, room_category, series_tag, media_type, is_official, is_public, accent_color, media_image, status, created_at, invite_code")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: tab === "manage",
  });

  const { data: memberCounts } = useQuery<Record<string, number>>({
    queryKey: ["admin-rooms-member-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pool_members")
        .select("pool_id");
      if (error) return {};
      const counts: Record<string, number> = {};
      (data ?? []).forEach(r => { counts[r.pool_id] = (counts[r.pool_id] ?? 0) + 1; });
      return counts;
    },
    enabled: tab === "manage",
  });

  useEffect(() => {
    if (!memberSearch.trim()) { setUserSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      const q = memberSearch.trim().toLowerCase();
      const { data } = await supabase
        .from("users")
        .select("id, user_name, display_name")
        .or(`user_name.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8);
      setUserSearchResults((data ?? []).filter(u => !selectedMembers.some(m => m.id === u.id)));
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [memberSearch, selectedMembers]);

  function addMember(u: UserResult) {
    setSelectedMembers(prev => [...prev, u]);
    setMemberSearch("");
    setUserSearchResults([]);
  }

  function removeMember(id: string) {
    setSelectedMembers(prev => prev.filter(m => m.id !== id));
  }

  async function handleCreate() {
    if (!form.name.trim()) { toast({ title: "Room name required", variant: "destructive" }); return; }
    if (!user?.id) { toast({ title: "Not authenticated", variant: "destructive" }); return; }

    setCreating(true);
    try {
      const invite_code = generateInviteCode();
      const roomPayload: any = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        host_id: user.id,
        invite_code,
        category: "custom",
        room_category: form.room_category,
        series_tag: form.series_tag.trim().toLowerCase().replace(/\s+/g, "-") || null,
        media_type: form.media_type || null,
        media_image: form.media_image.trim() || null,
        accent_color: form.accent_color || null,
        is_public: form.is_public,
        is_official: true,
        status: "open",
        partner_name: form.room_category === "platform" ? form.partner_name.trim() || null : null,
        partner_logo_url: form.room_category === "platform" ? form.partner_logo_url.trim() || null : null,
      };

      const { data: newRoom, error: roomErr } = await supabase
        .from("pools")
        .insert(roomPayload)
        .select("id, name, invite_code")
        .single();

      if (roomErr) throw roomErr;

      const hostMember = { pool_id: newRoom.id, user_id: user.id, role: "host", total_points: 0 };
      const memberRows = selectedMembers.map(m => ({
        pool_id: newRoom.id, user_id: m.id, role: "member", total_points: 0,
      }));

      const { error: membersErr } = await supabase
        .from("pool_members")
        .insert([hostMember, ...memberRows]);

      if (membersErr) throw membersErr;

      setCreatedRoom(newRoom);
      queryClient.invalidateQueries({ queryKey: ["admin-rooms-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-rooms-member-counts"] });
      toast({ title: "Room created!", description: `"${newRoom.name}" is live.` });
    } catch (e: any) {
      toast({ title: "Error creating room", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setForm(DEFAULT_FORM);
    setSelectedMembers([]);
    setCreatedRoom(null);
    setMemberSearch("");
  }

  const isMediaRoom = form.room_category === "media";
  const isGenreRoom = form.room_category === "genre";
  const isPartnerRoom = form.room_category === "platform";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => setLocation("/admin")}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={18} className="text-gray-300" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Room Builder</h1>
            <p className="text-sm text-gray-400">Create and manage official Consumed rooms</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-8">
          {(["create", "manage"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === t ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t === "create" ? "Create Room" : "Manage Rooms"}
            </button>
          ))}
        </div>

        {/* ── CREATE TAB ── */}
        {tab === "create" && (
          <>
            {createdRoom ? (
              <SuccessBanner room={createdRoom} onAnother={resetForm} onView={() => setLocation(`/rooms/${createdRoom.id}`)} />
            ) : (
              <div className="space-y-6">

                {/* Room Type */}
                <Section title="Room Type">
                  <div className="grid grid-cols-1 gap-2">
                    {ROOM_CAT_OPTS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => set("room_category", opt.value)}
                        className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                          form.room_category === opt.value
                            ? "bg-purple-900/30 border-purple-500/50"
                            : "bg-gray-800/60 border-gray-700/40 hover:border-gray-600/60"
                        }`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          form.room_category === opt.value ? "border-purple-400" : "border-gray-500"
                        }`}>
                          {form.room_category === opt.value && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-white">{opt.label}</span>
                            <Pill label={opt.pill} />
                          </div>
                          <p className="text-xs text-gray-400">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Room Details */}
                <Section title="Details">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                        Room Name *
                      </label>
                      <Input
                        value={form.name}
                        onChange={e => set("name", e.target.value)}
                        placeholder={isGenreRoom ? "e.g. True Crime" : isPartnerRoom ? "e.g. Reelz Official Room" : "e.g. Paradise"}
                        className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                        Description
                      </label>
                      <Textarea
                        value={form.description}
                        onChange={e => set("description", e.target.value)}
                        placeholder={
                          isGenreRoom
                            ? "A community for true crime fans — discuss podcasts, docuseries, and unsolved cases."
                            : isPartnerRoom
                            ? "The official partner community on Consumed."
                            : "Discuss, predict, and debate the show here."
                        }
                        rows={3}
                        className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 resize-none"
                      />
                    </div>

                    {/* Tag / Slug */}
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                        {isGenreRoom ? "Genre Tag" : isPartnerRoom ? "Partner Tag (slug)" : "Series Tag (slug)"}
                      </label>
                      <div className="relative">
                        <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <Input
                          value={form.series_tag}
                          onChange={e => set("series_tag", e.target.value)}
                          placeholder={
                            isGenreRoom ? "true-crime" : isPartnerRoom ? "reelz" : "paradise"
                          }
                          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 pl-8"
                        />
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">Used to group trivia/polls — lowercase, hyphens OK</p>
                    </div>
                  </div>
                </Section>

                {/* Media Type */}
                <Section title="Media Type">
                  <div className="flex flex-wrap gap-2">
                    {MEDIA_TYPE_OPTS.map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        onClick={() => set("media_type", value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                          form.media_type === value
                            ? "bg-purple-700/40 border-purple-500/60 text-white"
                            : "bg-gray-800/60 border-gray-700/40 text-gray-400 hover:text-white hover:border-gray-600"
                        }`}
                      >
                        <Icon size={14} />
                        {label}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Appearance */}
                <Section title="Appearance">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                        Cover Image URL
                      </label>
                      <Input
                        value={form.media_image}
                        onChange={e => set("media_image", e.target.value)}
                        placeholder="https://image.tmdb.org/t/p/w500/..."
                        className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                      />
                      {form.media_image && (
                        <img
                          src={form.media_image}
                          alt="preview"
                          className="mt-2 h-20 rounded-lg object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                        Accent Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={form.accent_color || "#7c3aed"}
                          onChange={e => set("accent_color", e.target.value)}
                          className="w-10 h-10 rounded-lg border border-gray-700 bg-transparent cursor-pointer"
                        />
                        <Input
                          value={form.accent_color}
                          onChange={e => set("accent_color", e.target.value)}
                          placeholder="#7c3aed (optional)"
                          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 flex-1"
                        />
                        {form.accent_color && (
                          <button onClick={() => set("accent_color", "")} className="text-gray-500 hover:text-gray-300">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {isPartnerRoom && (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                            Partner Name
                          </label>
                          <Input
                            value={form.partner_name}
                            onChange={e => set("partner_name", e.target.value)}
                            placeholder="Reelz"
                            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                            Partner Logo URL
                          </label>
                          <Input
                            value={form.partner_logo_url}
                            onChange={e => set("partner_logo_url", e.target.value)}
                            placeholder="https://..."
                            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </Section>

                {/* Visibility */}
                <Section title="Visibility">
                  <button
                    onClick={() => set("is_public", !form.is_public)}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-all ${
                      form.is_public
                        ? "bg-green-900/20 border-green-700/40"
                        : "bg-gray-800/60 border-gray-700/40"
                    }`}
                  >
                    {form.is_public ? <Globe size={16} className="text-green-400" /> : <Lock size={16} className="text-gray-400" />}
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-white">{form.is_public ? "Public" : "Private"}</p>
                      <p className="text-xs text-gray-400">
                        {form.is_public ? "Anyone can discover and join this room" : "Only members with the invite code can join"}
                      </p>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition-colors relative ${form.is_public ? "bg-green-500" : "bg-gray-600"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.is_public ? "left-5" : "left-0.5"}`} />
                    </div>
                  </button>
                </Section>

                {/* Members */}
                <Section title="Add Members" subtitle="Search for users to pre-seed the room. Invite code is always generated for others to join.">
                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <Input
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Search by username or display name..."
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 pl-9"
                    />
                    {searchLoading && (
                      <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                    )}
                  </div>

                  {userSearchResults.length > 0 && (
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-3">
                      {userSearchResults.map(u => (
                        <button
                          key={u.id}
                          onClick={() => addMember(u)}
                          className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-700 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white">
                            {(u.display_name || u.user_name).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{u.display_name || u.user_name}</p>
                            <p className="text-xs text-gray-400">@{u.user_name}</p>
                          </div>
                          <Plus size={14} className="ml-auto text-purple-400" />
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedMembers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedMembers.map(m => (
                        <div key={m.id} className="flex items-center gap-1.5 bg-purple-900/30 border border-purple-500/30 rounded-full px-3 py-1">
                          <span className="text-sm font-medium text-white">{m.display_name || m.user_name}</span>
                          <button onClick={() => removeMember(m.id)} className="text-gray-400 hover:text-white ml-1">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedMembers.length === 0 && !memberSearch && (
                    <p className="text-xs text-gray-500">No members added yet — you (admin host) are automatically included.</p>
                  )}
                </Section>

                {/* Preview */}
                <RoomPreview form={form} memberCount={selectedMembers.length + 1} />

                {/* Create Button */}
                <button
                  onClick={handleCreate}
                  disabled={creating || !form.name.trim()}
                  className="w-full py-4 rounded-2xl font-bold text-base text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                  style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" }}
                >
                  {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  {creating ? "Creating Room…" : "Create Room"}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── MANAGE TAB ── */}
        {tab === "manage" && (
          <div className="space-y-3">
            {roomsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-purple-400" />
              </div>
            ) : !existingRooms?.length ? (
              <div className="text-center py-16 text-gray-500">No rooms yet</div>
            ) : (
              existingRooms.map(room => (
                <RoomCard
                  key={room.id}
                  room={room}
                  memberCount={memberCounts?.[room.id] ?? 0}
                  onView={() => setLocation(`/rooms/${room.id}`)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function RoomPreview({ form, memberCount }: { form: RoomForm; memberCount: number }) {
  const catLabel = form.room_category === "platform" ? "partner" : form.room_category;
  return (
    <div className="rounded-2xl border border-gray-700/60 overflow-hidden">
      <div className="relative h-24 bg-gray-800"
        style={form.accent_color ? { background: `linear-gradient(135deg, ${form.accent_color}30, ${form.accent_color}10)` } : {}}>
        {form.media_image && (
          <img src={form.media_image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-900/80" />
      </div>
      <div className="bg-gray-900 px-4 py-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-white truncate">{form.name || "Room Name"}</p>
            <p className="text-xs text-gray-400 leading-snug mt-0.5 line-clamp-2">
              {form.description || "Room description will appear here."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <Pill label={catLabel || "genre"} />
            {form.media_type && (
              <span className="text-[10px] text-gray-500 uppercase">{form.media_type}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Users size={11} />{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1">
            {form.is_public ? <Globe size={11} /> : <Lock size={11} />}
            {form.is_public ? "Public" : "Private"}
          </span>
          <span className="ml-auto text-[10px] font-bold text-green-400">● Official</span>
        </div>
      </div>
    </div>
  );
}

function RoomCard({ room, memberCount, onView }: { room: RoomRow; memberCount: number; onView: () => void }) {
  const { toast } = useToast();
  const catLabel = room.room_category === "platform" ? "partner" : (room.room_category ?? "media");

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-700/60 overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-4">
        {room.media_image ? (
          <img src={room.media_image} alt={room.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0"
            style={room.accent_color ? { background: room.accent_color + "33" } : {}}>
            <Building2 size={20} className="text-gray-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-bold text-white truncate">{room.name}</p>
            {room.is_official && <span className="text-[10px] font-bold text-yellow-400">✦ Official</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Pill label={catLabel} />
            {room.media_type && (
              <span className="text-[10px] text-gray-500 uppercase">{room.media_type}</span>
            )}
            <span className="text-[10px] text-gray-500 flex items-center gap-1">
              <Users size={9} />{memberCount}
            </span>
            <span className={`text-[10px] ${room.is_public ? "text-green-400" : "text-gray-500"}`}>
              {room.is_public ? "Public" : "Private"}
            </span>
          </div>
        </div>
        <button
          onClick={onView}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors flex-shrink-0"
        >
          <ExternalLink size={14} className="text-gray-300" />
        </button>
      </div>

      {/* Invite code row */}
      <div className="px-4 pb-3 flex items-center gap-2">
        <span className="text-[11px] text-gray-500">Invite code:</span>
        <code className="text-[11px] font-mono font-bold text-purple-300 bg-purple-900/20 px-2 py-0.5 rounded">
          {room.invite_code}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(room.invite_code);
            toast({ title: "Copied!", description: room.invite_code });
          }}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <Copy size={12} />
        </button>
        {room.series_tag && (
          <span className="ml-auto text-[11px] text-gray-500 flex items-center gap-1">
            <Hash size={9} />{room.series_tag}
          </span>
        )}
      </div>
    </div>
  );
}

function SuccessBanner({
  room,
  onAnother,
  onView,
}: { room: { id: string; name: string; invite_code: string }; onAnother: () => void; onView: () => void }) {
  const { toast } = useToast();
  return (
    <div className="text-center py-10 flex flex-col items-center gap-5">
      <div className="w-20 h-20 rounded-full bg-green-900/30 border-2 border-green-500/40 flex items-center justify-center">
        <CheckCircle size={36} className="text-green-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white mb-1">"{room.name}" is live!</h2>
        <p className="text-sm text-gray-400">The room is open and members have been added.</p>
      </div>
      <div className="bg-gray-800 rounded-2xl px-6 py-4 text-center w-full max-w-xs">
        <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Invite Code</p>
        <p className="text-2xl font-mono font-black text-purple-300 tracking-widest">{room.invite_code}</p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(room.invite_code);
            toast({ title: "Copied!", description: room.invite_code });
          }}
          className="mt-2 flex items-center gap-1.5 mx-auto text-xs text-gray-400 hover:text-white transition-colors"
        >
          <Copy size={12} /> Copy code
        </button>
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={onView}
          className="flex-1 py-3 rounded-xl border border-gray-700 text-sm font-semibold text-gray-200 hover:bg-gray-800 flex items-center justify-center gap-2"
        >
          <ExternalLink size={14} /> View Room
        </button>
        <button
          onClick={onAnother}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
        >
          <Plus size={14} /> Create Another
        </button>
      </div>
    </div>
  );
}
