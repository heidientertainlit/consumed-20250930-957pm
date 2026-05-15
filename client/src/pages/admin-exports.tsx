import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Download, Loader2, FileText, Table2 } from "lucide-react";

function downloadCSV(filename: string, rows: Record<string, any>[], fields: string[]) {
  const escape = (v: any) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    fields.join(","),
    ...rows.map(r => fields.map(f => escape(r[f])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function flt(v: any): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

async function buildMasterExport() {
  // 1. Non-persona users
  const { data: users } = await supabase
    .from("users")
    .select("id, created_at, is_admin")
    .or("is_persona.is.null,is_persona.eq.false")
    .order("created_at");

  const userIds = (users || []).map((u: any) => u.id);
  const userMap: Record<string, any> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });

  // 2. Genre signals
  const { data: genreSigs } = await supabase
    .from("user_dna_signals")
    .select("user_id, signal_value, strength")
    .eq("signal_type", "genre")
    .order("strength", { ascending: false });

  const { data: mediaTypeSigs } = await supabase
    .from("user_dna_signals")
    .select("user_id, signal_value, strength")
    .eq("signal_type", "media_type")
    .order("strength", { ascending: false });

  const userGenres: Record<string, any[]> = {};
  (genreSigs || []).forEach((r: any) => {
    if (!userGenres[r.user_id]) userGenres[r.user_id] = [];
    userGenres[r.user_id].push(r);
  });

  const userMediaTypes: Record<string, any[]> = {};
  (mediaTypeSigs || []).forEach((r: any) => {
    if (!userMediaTypes[r.user_id]) userMediaTypes[r.user_id] = [];
    userMediaTypes[r.user_id].push(r);
  });

  // 3. Genre poll responses (show_tag = 'Genres')
  const { data: genrePoolsRaw } = await supabase
    .from("prediction_pools")
    .select("id, title")
    .eq("show_tag", "Genres");

  const genrePools = genrePoolsRaw || [];
  const genrePoolIds = genrePools.map((p: any) => p.id);

  const { data: genrePredictions } = genrePoolIds.length > 0
    ? await supabase
        .from("user_predictions")
        .select("user_id, pool_id, prediction")
        .in("pool_id", genrePoolIds)
    : { data: [] };

  const claimed: Record<string, Record<string, string>> = {};
  (genrePredictions || []).forEach((row: any) => {
    const pool = genrePools.find((p: any) => p.id === row.pool_id);
    if (!pool) return;
    const t = (pool.title || "").toLowerCase();
    if (!claimed[row.user_id]) claimed[row.user_id] = {};
    if (t.includes("lighter") || t.includes("reelz")) claimed[row.user_id]["TV"] = row.prediction;
    else if (t.includes("escape")) claimed[row.user_id]["Book (escape)"] = row.prediction;
    else if (t.includes("default book")) claimed[row.user_id]["Book (default)"] = row.prediction;
    else if (t.includes("music") || t.includes("default to")) claimed[row.user_id]["Music"] = row.prediction;
  });

  // 4. Game stats (trivia + polls)
  const { data: allPredictions } = await supabase
    .from("user_predictions")
    .select("user_id, pool_id, points_earned");

  const { data: allPools } = await supabase
    .from("prediction_pools")
    .select("id, type");

  const poolTypeMap: Record<string, string> = {};
  (allPools || []).forEach((p: any) => { poolTypeMap[p.id] = p.type; });

  const gameStats: Record<string, { trivia_attempts: number; trivia_points: number; poll_votes: number }> = {};
  (allPredictions || []).forEach((p: any) => {
    const type = poolTypeMap[p.pool_id];
    if (!gameStats[p.user_id]) gameStats[p.user_id] = { trivia_attempts: 0, trivia_points: 0, poll_votes: 0 };
    if (type === "trivia") {
      gameStats[p.user_id].trivia_attempts++;
      gameStats[p.user_id].trivia_points += flt(p.points_earned);
    } else if (type === "poll") {
      gameStats[p.user_id].poll_votes++;
    }
  });

  // 5. List items + list names
  const { data: listItems } = await supabase
    .from("list_items")
    .select("user_id, title, media_type, external_id, external_source, list_id")
    .not("title", "is", null);

  const { data: lists } = await supabase
    .from("lists")
    .select("id, title");

  const listNameMap: Record<string, string> = {};
  (lists || []).forEach((l: any) => { listNameMap[l.id] = l.title; });

  // 6. Ratings
  const { data: ratings } = await supabase
    .from("media_ratings")
    .select("user_id, media_external_id, media_external_source, rating");

  const ratingMap: Record<string, number> = {};
  (ratings || []).forEach((r: any) => {
    ratingMap[`${r.user_id}|${r.media_external_id}|${r.media_external_source}`] = flt(r.rating);
  });

  const ratingSummary: Record<string, { total: number; sum: number }> = {};
  (ratings || []).forEach((r: any) => {
    if (!ratingSummary[r.user_id]) ratingSummary[r.user_id] = { total: 0, sum: 0 };
    ratingSummary[r.user_id].total++;
    ratingSummary[r.user_id].sum += flt(r.rating);
  });

  // Group list items per user
  const userItems: Record<string, Record<string, { lists: string[]; rating: number | null; media_type: string }>> = {};
  (listItems || []).forEach((item: any) => {
    const uid = item.user_id;
    if (!uid) return;
    const key = `${item.title}|${item.external_id || ""}`;
    if (!userItems[uid]) userItems[uid] = {};
    if (!userItems[uid][key]) userItems[uid][key] = { lists: [], rating: null, media_type: item.media_type };
    const lname = listNameMap[item.list_id];
    if (lname && !userItems[uid][key].lists.includes(lname)) userItems[uid][key].lists.push(lname);
    const rKey = `${uid}|${item.external_id}|${item.external_source}`;
    if (ratingMap[rKey] !== undefined && userItems[uid][key].rating === null) {
      userItems[uid][key].rating = ratingMap[rKey];
    }
  });

  // Build rows
  const rows = userIds.map((uid: string) => {
    const u = userMap[uid];
    const genres = (userGenres[uid] || []).slice(0, 15);
    const mts = userMediaTypes[uid] || [];
    const cl = claimed[uid] || {};
    const items = userItems[uid] || {};
    const gstat = gameStats[uid] || { trivia_attempts: 0, trivia_points: 0, poll_votes: 0 };
    const rstat = ratingSummary[uid] || { total: 0, sum: 0 };

    const claimedStr = Object.entries(cl).map(([k, v]) => `${v} (${k})`).join("; ");
    const behavioralStr = genres.map(g => `${g.signal_value}: ${flt(g.strength).toFixed(2)}`).join("; ");
    const mtStr = mts.map((m: any) => `${m.signal_value}: ${flt(m.strength).toFixed(2)}`).join("; ");

    const byType: Record<string, Array<{ rating: number; title: string }>> = {};
    const allLists = new Set<string>();
    Object.entries(items).forEach(([key, entry]) => {
      const title = key.split("|")[0];
      const mt = entry.media_type || "unknown";
      if (!byType[mt]) byType[mt] = [];
      byType[mt].push({ rating: entry.rating ?? 0, title });
      entry.lists.forEach(l => allLists.add(l));
    });

    const topTitles = (type: string, n = 6) =>
      (byType[type] || []).sort((a, b) => b.rating - a.rating).slice(0, n).map(x => x.title).join("; ");

    const allRated = Object.entries(items)
      .filter(([, e]) => e.rating !== null)
      .map(([key, e]) => ({ title: key.split("|")[0], rating: e.rating! }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 8)
      .map(x => x.title)
      .join("; ");

    const avgRating = rstat.total > 0 ? (rstat.sum / rstat.total).toFixed(1) : "";

    return {
      anon_id: uid,
      joined_at: (u.created_at || "").slice(0, 10),
      is_admin: u.is_admin ? "yes" : "",
      claimed_genres: claimedStr,
      behavioral_genres: behavioralStr,
      genre_signal_count: genres.length,
      top_media_type: mts[0]?.signal_value || "",
      media_type_breakdown: mtStr,
      total_items_tracked: Object.keys(items).length,
      lists_used: Array.from(allLists).sort().join("; "),
      total_rated: rstat.total,
      avg_rating: avgRating,
      top_rated_items: allRated,
      top_tv: topTitles("tv"),
      top_movies: topTitles("movie"),
      top_books: topTitles("book"),
      top_music: topTitles("music"),
      top_podcasts: topTitles("podcast"),
      trivia_attempts: gstat.trivia_attempts,
      trivia_points: gstat.trivia_points,
      poll_votes: gstat.poll_votes,
    };
  });

  const fields = [
    "anon_id", "joined_at", "is_admin",
    "claimed_genres", "behavioral_genres", "genre_signal_count",
    "top_media_type", "media_type_breakdown",
    "total_items_tracked", "lists_used",
    "total_rated", "avg_rating", "top_rated_items",
    "top_tv", "top_movies", "top_books", "top_music", "top_podcasts",
    "trivia_attempts", "trivia_points", "poll_votes",
  ];

  const today = new Date().toISOString().slice(0, 10);
  downloadCSV(`consumed_master_${today}.csv`, rows, fields);
  return rows.length;
}

async function buildMediaDetailExport() {
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .or("is_persona.is.null,is_persona.eq.false");
  const realUserIds = new Set((users || []).map((u: any) => u.id));

  const { data: listItems } = await supabase
    .from("list_items")
    .select("user_id, title, media_type, external_id, external_source, list_id")
    .not("title", "is", null);

  const { data: lists } = await supabase.from("lists").select("id, title");
  const listNameMap: Record<string, string> = {};
  (lists || []).forEach((l: any) => { listNameMap[l.id] = l.title; });

  const { data: ratings } = await supabase
    .from("media_ratings")
    .select("user_id, media_external_id, media_external_source, rating");
  const ratingMap: Record<string, number> = {};
  (ratings || []).forEach((r: any) => {
    ratingMap[`${r.user_id}|${r.media_external_id}|${r.media_external_source}`] = flt(r.rating);
  });

  const userItems: Record<string, Record<string, { lists: string[]; rating: number | null; media_type: string; external_source: string }>> = {};
  (listItems || []).forEach((item: any) => {
    const uid = item.user_id;
    if (!uid || !realUserIds.has(uid)) return;
    const key = `${item.title}|${item.external_id || ""}`;
    if (!userItems[uid]) userItems[uid] = {};
    if (!userItems[uid][key]) userItems[uid][key] = { lists: [], rating: null, media_type: item.media_type, external_source: item.external_source };
    const lname = listNameMap[item.list_id];
    if (lname && !userItems[uid][key].lists.includes(lname)) userItems[uid][key].lists.push(lname);
    const rKey = `${uid}|${item.external_id}|${item.external_source}`;
    if (ratingMap[rKey] !== undefined && userItems[uid][key].rating === null) {
      userItems[uid][key].rating = ratingMap[rKey];
    }
  });

  const rows: any[] = [];
  Object.entries(userItems).sort(([a], [b]) => a.localeCompare(b)).forEach(([uid, items]) => {
    Object.entries(items).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, entry]) => {
      const title = key.split("|")[0];
      const types = ["tracked"];
      if (entry.rating !== null) {
        types.push("rated");
        if (entry.rating >= 4) types.push("rated_high");
      }
      rows.push({
        anon_id: uid,
        media_title: title,
        media_type: entry.media_type || "",
        external_source: entry.external_source || "",
        rating: entry.rating ?? "",
        lists: entry.lists.join("; "),
        engagement_types: types.join("; "),
      });
    });
  });

  const fields = ["anon_id", "media_title", "media_type", "external_source", "rating", "lists", "engagement_types"];
  const today = new Date().toISOString().slice(0, 10);
  downloadCSV(`consumed_media_detail_${today}.csv`, rows, fields);
  return rows.length;
}

export default function AdminExportsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [masterLoading, setMasterLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [masterCount, setMasterCount] = useState<number | null>(null);
  const [detailCount, setDetailCount] = useState<number | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-profile-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("users").select("is_admin").eq("id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-purple-400" />
      </div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Access restricted</p>
      </div>
    );
  }

  const handleMaster = async () => {
    setMasterLoading(true);
    setMasterCount(null);
    try {
      const count = await buildMasterExport();
      setMasterCount(count);
    } finally {
      setMasterLoading(false);
    }
  };

  const handleDetail = async () => {
    setDetailLoading(true);
    setDetailCount(null);
    try {
      const count = await buildMediaDetailExport();
      setDetailCount(count);
    } finally {
      setDetailLoading(false);
    }
  };

  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button
          onClick={() => setLocation("/admin")}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Admin
        </button>

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Data Exports</h1>
          <p className="text-gray-400 text-sm">Anonymous user data exports for analysis. Updated live each time you download. As of {today}.</p>
        </div>

        <div className="space-y-4">
          {/* Master Export */}
          <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-700/40 rounded-2xl p-6">
            <div className="flex items-start gap-5">
              <div className="bg-purple-900/50 rounded-xl p-3 flex-shrink-0">
                <Table2 size={24} className="text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white mb-1">Master Export</p>
                <p className="text-sm text-gray-400 leading-snug mb-1">
                  One row per user. Includes claimed genres (from polls), behavioral genre signals with strength scores, media type breakdown, top tracked items per category, ratings summary, and trivia/poll participation.
                </p>
                <p className="text-xs text-purple-300/70 mb-4">
                  ~170 rows · fully anonymous (UUID only, no names or email)
                </p>
                <button
                  onClick={handleMaster}
                  disabled={masterLoading}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {masterLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  {masterLoading ? "Building export…" : "Download consumed_master.csv"}
                </button>
                {masterCount !== null && (
                  <p className="text-xs text-green-400 mt-2">✓ Downloaded {masterCount} users</p>
                )}
              </div>
            </div>
          </div>

          {/* Media Detail Export */}
          <div className="bg-gradient-to-br from-teal-900/40 to-teal-800/20 border border-teal-700/40 rounded-2xl p-6">
            <div className="flex items-start gap-5">
              <div className="bg-teal-900/50 rounded-xl p-3 flex-shrink-0">
                <FileText size={24} className="text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white mb-1">Media Detail Export</p>
                <p className="text-sm text-gray-400 leading-snug mb-1">
                  One row per user-item pair. Every piece of media tracked by every user — which lists it's in, their rating, and engagement type (tracked / rated / rated_high). Join to Master Export on <code className="text-teal-300 text-xs">anon_id</code>.
                </p>
                <p className="text-xs text-teal-300/70 mb-4">
                  ~700+ rows · same anonymous ID as Master Export
                </p>
                <button
                  onClick={handleDetail}
                  disabled={detailLoading}
                  className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {detailLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  {detailLoading ? "Building export…" : "Download consumed_media_detail.csv"}
                </button>
                {detailCount !== null && (
                  <p className="text-xs text-green-400 mt-2">✓ Downloaded {detailCount} rows</p>
                )}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 mt-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">How to join the files</p>
            <div className="space-y-2 text-sm text-gray-400">
              <p>Both files share the same <span className="text-white font-medium">anon_id</span> column — a consistent anonymous ID per user.</p>
              <p><span className="text-white font-medium">Google Sheets:</span> Use <code className="text-purple-300 text-xs">VLOOKUP(A2, 'Media Detail'!A:G, 5, false)</code> to pull any column from the detail file into the master.</p>
              <p><span className="text-white font-medium">Excel:</span> Use Power Query → Merge Queries on <code className="text-purple-300 text-xs">anon_id</code>.</p>
              <p><span className="text-white font-medium">Pivot tables:</span> The Master Export is ready to pivot directly — filter by <code className="text-purple-300 text-xs">top_media_type</code> or <code className="text-purple-300 text-xs">top_genre</code>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
