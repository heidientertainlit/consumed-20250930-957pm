import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Download, Loader2, FileText, Table2, BarChart2 } from "lucide-react";

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
  // 1. Non-persona real users
  const { data: users } = await supabase
    .from("users")
    .select("id, created_at, is_admin")
    .or("is_persona.is.null,is_persona.eq.false")
    .order("created_at");

  const userIds = (users || []).map((u: any) => u.id);
  const userMap: Record<string, any> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });

  // 2. Genre + media type behavioral signals
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

  // 3. Show + creator signals
  const { data: showSigs } = await supabase
    .from("user_dna_signals")
    .select("user_id, signal_value, strength")
    .eq("signal_type", "show")
    .order("strength", { ascending: false });

  const { data: creatorSigs } = await supabase
    .from("user_dna_signals")
    .select("user_id, signal_value, strength")
    .eq("signal_type", "creator")
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

  const userShows: Record<string, any[]> = {};
  (showSigs || []).forEach((r: any) => {
    if (!userShows[r.user_id]) userShows[r.user_id] = [];
    userShows[r.user_id].push(r);
  });

  const userCreators: Record<string, any[]> = {};
  (creatorSigs || []).forEach((r: any) => {
    if (!userCreators[r.user_id]) userCreators[r.user_id] = [];
    userCreators[r.user_id].push(r);
  });

  // 4. DNA profiles (archetype, tagline, flavor notes)
  const { data: dnaProfiles } = await supabase
    .from("dna_profiles")
    .select("user_id, label, tagline, flavor_notes, favorite_genres");

  const dnaMap: Record<string, any> = {};
  (dnaProfiles || []).forEach((d: any) => { dnaMap[d.user_id] = d; });

  // 5. Claimed genres from genre polls
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

  // 6. Game stats (trivia + polls)
  const { data: allPredictions } = await supabase
    .from("user_predictions")
    .select("user_id, pool_id, points_earned");

  const { data: allPools } = await supabase
    .from("prediction_pools")
    .select("id, type");

  const poolTypeMap: Record<string, string> = {};
  (allPools || []).forEach((p: any) => { poolTypeMap[p.id] = p.type; });

  const gameStats: Record<string, { trivia_attempts: number; trivia_correct: number; trivia_points: number; poll_votes: number }> = {};
  (allPredictions || []).forEach((p: any) => {
    const type = poolTypeMap[p.pool_id];
    if (!gameStats[p.user_id]) gameStats[p.user_id] = { trivia_attempts: 0, trivia_correct: 0, trivia_points: 0, poll_votes: 0 };
    if (type === "trivia") {
      gameStats[p.user_id].trivia_attempts++;
      if (flt(p.points_earned) > 0) gameStats[p.user_id].trivia_correct++;
      gameStats[p.user_id].trivia_points += flt(p.points_earned);
    } else if (type === "poll") {
      gameStats[p.user_id].poll_votes++;
    }
  });

  // 7. DNA moment responses count
  const { data: momentResponses } = await supabase
    .from("dna_moment_responses")
    .select("user_id");

  const momentCounts: Record<string, number> = {};
  (momentResponses || []).forEach((r: any) => {
    momentCounts[r.user_id] = (momentCounts[r.user_id] || 0) + 1;
  });

  // 10. Login streaks — last active, current streak, longest streak
  const { data: streaks } = await supabase
    .from("login_streaks")
    .select("user_id, last_login, current_streak, longest_streak");

  const streakMap: Record<string, any> = {};
  (streaks || []).forEach((s: any) => { streakMap[s.user_id] = s; });

  // 11. Social posts — posts written, likes received, comments received
  const { data: socialPosts } = await supabase
    .from("social_posts")
    .select("user_id, post_type, likes_count, comments_count, room_id")
    .or("origin_type.is.null,origin_type.eq.user");

  const socialMap: Record<string, {
    posts: number;
    room_posts: number;
    likes_received: number;
    comments_received: number;
  }> = {};
  (socialPosts || []).forEach((p: any) => {
    if (!socialMap[p.user_id]) socialMap[p.user_id] = { posts: 0, room_posts: 0, likes_received: 0, comments_received: 0 };
    if (p.room_id) {
      socialMap[p.user_id].room_posts++;
    } else {
      socialMap[p.user_id].posts++;
    }
    socialMap[p.user_id].likes_received += p.likes_count || 0;
    socialMap[p.user_id].comments_received += p.comments_count || 0;
  });

  // 12. Room membership — which official rooms each user has joined
  const { data: officialRooms } = await supabase
    .from("pools")
    .select("id, name, room_category, media_type")
    .eq("is_official", true);

  const roomNameMap: Record<string, string> = {};
  (officialRooms || []).forEach((r: any) => { roomNameMap[r.id] = r.name; });

  const { data: poolMembers } = await supabase
    .from("pool_members")
    .select("pool_id, user_id")
    .in("pool_id", (officialRooms || []).map((r: any) => r.id));

  const userRooms: Record<string, string[]> = {};
  (poolMembers || []).forEach((m: any) => {
    const name = roomNameMap[m.pool_id];
    if (!name) return;
    if (!userRooms[m.user_id]) userRooms[m.user_id] = [];
    userRooms[m.user_id].push(name);
  });

  // 13. Room takes — to find most active room per user
  const { data: allRoomTakes } = await supabase
    .from("room_takes")
    .select("user_id, room_id");

  const userRoomPostCounts: Record<string, Record<string, number>> = {};
  (allRoomTakes || []).forEach((t: any) => {
    if (!userRoomPostCounts[t.user_id]) userRoomPostCounts[t.user_id] = {};
    userRoomPostCounts[t.user_id][t.room_id] = (userRoomPostCounts[t.user_id][t.room_id] || 0) + 1;
  });

  // 8. List items
  const { data: listItems } = await supabase
    .from("list_items")
    .select("user_id, title, media_type, external_id, external_source, list_id")
    .not("title", "is", null);

  const { data: lists } = await supabase
    .from("lists")
    .select("id, title");

  const listNameMap: Record<string, string> = {};
  (lists || []).forEach((l: any) => { listNameMap[l.id] = l.title; });

  // 9. Ratings — all of them for high/low breakdown
  const { data: ratings } = await supabase
    .from("media_ratings")
    .select("user_id, media_external_id, media_external_source, media_title, rating");

  const ratingMap: Record<string, number> = {};
  (ratings || []).forEach((r: any) => {
    ratingMap[`${r.user_id}|${r.media_external_id}|${r.media_external_source}`] = flt(r.rating);
  });

  const ratingSummary: Record<string, { total: number; sum: number; low: number; lowTitles: string[] }> = {};
  (ratings || []).forEach((r: any) => {
    if (!ratingSummary[r.user_id]) ratingSummary[r.user_id] = { total: 0, sum: 0, low: 0, lowTitles: [] };
    ratingSummary[r.user_id].total++;
    ratingSummary[r.user_id].sum += flt(r.rating);
    if (flt(r.rating) <= 2 && r.media_title) {
      ratingSummary[r.user_id].low++;
      ratingSummary[r.user_id].lowTitles.push(r.media_title);
    }
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

  // Count items per list type across all users for each user
  const userListBreakdown: Record<string, Record<string, number>> = {};
  (listItems || []).forEach((item: any) => {
    const uid = item.user_id;
    if (!uid) return;
    const lname = listNameMap[item.list_id];
    if (!lname) return;
    if (!userListBreakdown[uid]) userListBreakdown[uid] = {};
    userListBreakdown[uid][lname] = (userListBreakdown[uid][lname] || 0) + 1;
  });

  // Library genres — actual genres of the titles each user tracks, from the
  // shared media_genres cache. This is the genre breakdown of what they really
  // consume (complements behavioral_genres, which is signal-derived).
  const { data: genreRows } = await supabase
    .from("media_genres")
    .select("external_source, external_id, canonical_genres");
  const genreMap: Record<string, string[]> = {};
  (genreRows || []).forEach((g: any) => {
    genreMap[`${g.external_source}::${g.external_id}`] = g.canonical_genres || [];
  });

  const userLibraryGenres: Record<string, Record<string, number>> = {};
  const libGenreSeen: Record<string, Set<string>> = {};
  (listItems || []).forEach((item: any) => {
    const uid = item.user_id;
    if (!uid || !item.external_id || !item.external_source) return;
    const gkey = `${item.external_source}::${item.external_id}`;
    const genres = genreMap[gkey];
    if (!genres || genres.length === 0) return;
    // Count each title once per user, even if it sits on several lists
    if (!libGenreSeen[uid]) libGenreSeen[uid] = new Set();
    if (libGenreSeen[uid].has(gkey)) return;
    libGenreSeen[uid].add(gkey);
    if (!userLibraryGenres[uid]) userLibraryGenres[uid] = {};
    genres.forEach((g) => { userLibraryGenres[uid][g] = (userLibraryGenres[uid][g] || 0) + 1; });
  });

  // Build rows
  const rows = userIds.map((uid: string) => {
    const u = userMap[uid];
    const genres = (userGenres[uid] || []).slice(0, 15);
    const mts = userMediaTypes[uid] || [];
    const shows = (userShows[uid] || []).slice(0, 8);
    const creators = (userCreators[uid] || []).slice(0, 6);
    const dna = dnaMap[uid] || {};
    const cl = claimed[uid] || {};
    const items = userItems[uid] || {};
    const gstat = gameStats[uid] || { trivia_attempts: 0, trivia_correct: 0, trivia_points: 0, poll_votes: 0 };
    const rstat = ratingSummary[uid] || { total: 0, sum: 0, low: 0, lowTitles: [] };
    const listBreak = userListBreakdown[uid] || {};
    const streak = streakMap[uid] || {};
    const social = socialMap[uid] || { posts: 0, room_posts: 0, likes_received: 0, comments_received: 0 };
    const totalPosts = social.posts + social.room_posts;
    const engagementLevel = totalPosts >= 10 ? "active_poster"
      : totalPosts >= 3 ? "occasional_poster"
      : totalPosts >= 1 ? "light_poster"
      : "lurker";

    const claimedStr = Object.entries(cl).map(([k, v]) => `${v} (${k})`).join("; ");
    const behavioralStr = genres.map(g => `${g.signal_value}: ${flt(g.strength).toFixed(2)}`).join("; ");
    const mtStr = mts.map((m: any) => `${m.signal_value}: ${flt(m.strength).toFixed(2)}`).join("; ");
    const showStr = shows.map((s: any) => s.signal_value).join("; ");
    const creatorStr = creators.map((c: any) => c.signal_value).join("; ");

    const flavorNotes = Array.isArray(dna.flavor_notes) ? dna.flavor_notes.join("; ") : (dna.flavor_notes || "");
    const dnaFavGenres = Array.isArray(dna.favorite_genres) ? dna.favorite_genres.join("; ") : (dna.favorite_genres || "");

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
      .filter(([, e]) => e.rating !== null && e.rating >= 3)
      .map(([key, e]) => ({ title: key.split("|")[0], rating: e.rating! }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 8)
      .map(x => x.title)
      .join("; ");

    const avgRating = rstat.total > 0 ? (rstat.sum / rstat.total).toFixed(1) : "";
    const triviaAccuracy = gstat.trivia_attempts > 0
      ? `${Math.round((gstat.trivia_correct / gstat.trivia_attempts) * 100)}%`
      : "";

    // List breakdown columns
    const watched = listBreak["Watched"] || listBreak["Already Watched"] || 0;
    const wantToWatch = listBreak["Want to Watch"] || listBreak["Watchlist"] || 0;
    const watching = listBreak["Watching"] || listBreak["Currently Watching"] || 0;
    const reading = listBreak["Reading"] || listBreak["Currently Reading"] || 0;
    const wantToRead = listBreak["Want to Read"] || 0;
    const haveRead = listBreak["Have Read"] || listBreak["Read"] || 0;
    const dnf = listBreak["Did Not Finish"] || listBreak["DNF"] || 0;
    const favorites = listBreak["Favorites"] || listBreak["Favourite"] || 0;

    return {
      anon_id: uid,
      joined_at: (u.created_at || "").slice(0, 10),
      is_admin: u.is_admin ? "yes" : "",
      // DNA profile
      dna_archetype: dna.label || "",
      dna_tagline: dna.tagline || "",
      dna_flavor_notes: flavorNotes,
      dna_favorite_genres: dnaFavGenres,
      // Genre signals
      claimed_genres: claimedStr,
      behavioral_genres: behavioralStr,
      genre_signal_count: genres.length,
      // Library genres — genres of the actual titles they track (from media_genres)
      library_genres: Object.entries(userLibraryGenres[uid] || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 15)
        .map(([g, c]) => `${g}: ${c}`).join("; "),
      top_library_genre: Object.entries(userLibraryGenres[uid] || {})
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "",
      // Media type
      top_media_type: mts[0]?.signal_value || "",
      media_type_breakdown: mtStr,
      // Shows + creators they gravitate toward
      top_shows_engaged: showStr,
      top_creators_engaged: creatorStr,
      // Tracking summary
      total_items_tracked: Object.keys(items).length,
      lists_used: Array.from(allLists).sort().join("; "),
      watched_count: watched,
      want_to_watch_count: wantToWatch,
      currently_watching_count: watching,
      reading_count: reading,
      want_to_read_count: wantToRead,
      have_read_count: haveRead,
      did_not_finish_count: dnf,
      favorites_count: favorites,
      // Ratings
      total_rated: rstat.total,
      avg_rating: avgRating,
      low_ratings_count: rstat.low,
      low_rated_items: rstat.lowTitles.slice(0, 5).join("; "),
      top_rated_items: allRated,
      // Top items by type
      top_tv: topTitles("tv"),
      top_movies: topTitles("movie"),
      top_books: topTitles("book"),
      top_music: topTitles("music"),
      top_podcasts: topTitles("podcast"),
      // Game engagement
      trivia_attempts: gstat.trivia_attempts,
      trivia_correct: gstat.trivia_correct,
      trivia_accuracy: triviaAccuracy,
      trivia_points: gstat.trivia_points,
      poll_votes: gstat.poll_votes,
      dna_moments_answered: momentCounts[uid] || 0,
      // Engagement frequency
      last_active: streak.last_login || "",
      current_streak: streak.current_streak || 0,
      longest_streak: streak.longest_streak || 0,
      // Social behavior
      feed_posts_written: social.posts,
      room_posts_written: social.room_posts,
      total_posts_written: totalPosts,
      total_likes_received: social.likes_received,
      total_comments_received: social.comments_received,
      social_engagement_level: engagementLevel,
      // Room membership
      rooms_joined: (userRooms[uid] || []).join("; "),
      rooms_joined_count: (userRooms[uid] || []).length,
      most_active_room: (() => {
        const roomCounts = userRoomPostCounts[uid] || {};
        const topRoomId = Object.entries(roomCounts).sort(([, a], [, b]) => b - a)[0]?.[0];
        return topRoomId ? (roomNameMap[topRoomId] || "") : "";
      })(),
    };
  });

  const fields = [
    "anon_id", "joined_at", "is_admin",
    "dna_archetype", "dna_tagline", "dna_flavor_notes", "dna_favorite_genres",
    "claimed_genres", "behavioral_genres", "genre_signal_count",
    "library_genres", "top_library_genre",
    "top_media_type", "media_type_breakdown",
    "top_shows_engaged", "top_creators_engaged",
    "total_items_tracked", "lists_used",
    "watched_count", "want_to_watch_count", "currently_watching_count",
    "reading_count", "want_to_read_count", "have_read_count",
    "did_not_finish_count", "favorites_count",
    "total_rated", "avg_rating",
    "low_ratings_count", "low_rated_items",
    "top_rated_items",
    "top_tv", "top_movies", "top_books", "top_music", "top_podcasts",
    "trivia_attempts", "trivia_correct", "trivia_accuracy", "trivia_points",
    "poll_votes", "dna_moments_answered",
    "last_active", "current_streak", "longest_streak",
    "feed_posts_written", "room_posts_written", "total_posts_written",
    "total_likes_received", "total_comments_received", "social_engagement_level",
    "rooms_joined", "rooms_joined_count", "most_active_room",
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

  // All list items with creator field
  const { data: listItems } = await supabase
    .from("list_items")
    .select("user_id, title, creator, media_type, external_id, external_source, list_id, created_at")
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

  // Genres per title from the shared media_genres cache (keyed by source+id)
  const { data: genreRows } = await supabase
    .from("media_genres")
    .select("external_source, external_id, canonical_genres");
  const genreMap: Record<string, string[]> = {};
  (genreRows || []).forEach((g: any) => {
    genreMap[`${g.external_source}::${g.external_id}`] = g.canonical_genres || [];
  });

  // One row per user × item, collecting all lists for that item
  const userItems: Record<string, Record<string, {
    lists: string[];
    rating: number | null;
    media_type: string;
    external_source: string;
    creator: string;
    added_at: string;
  }>> = {};

  (listItems || []).forEach((item: any) => {
    const uid = item.user_id;
    if (!uid || !realUserIds.has(uid)) return;
    const key = `${item.title}|||${item.external_id || ""}|||${item.media_type || ""}`;
    if (!userItems[uid]) userItems[uid] = {};
    if (!userItems[uid][key]) {
      userItems[uid][key] = {
        lists: [],
        rating: null,
        media_type: item.media_type || "",
        external_source: item.external_source || "",
        creator: item.creator || "",
        added_at: (item.created_at || "").slice(0, 10),
      };
    }
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
      const title = key.split("|||")[0];
      const externalId = key.split("|||")[1];
      const genres = (genreMap[`${entry.external_source}::${externalId}`] || []).join("; ");
      const rating = entry.rating;
      const sentiment = rating === null ? "unrated"
        : rating >= 4 ? "liked"
        : rating <= 2 ? "disliked"
        : "neutral";

      const types: string[] = ["tracked"];
      if (rating !== null) {
        types.push("rated");
        if (rating >= 4) types.push("rated_high");
        if (rating <= 2) types.push("rated_low");
      }
      if (entry.lists.includes("Did Not Finish") || entry.lists.includes("DNF")) types.push("did_not_finish");
      if (entry.lists.includes("Favorites") || entry.lists.includes("Favourite")) types.push("favorited");

      rows.push({
        anon_id: uid,
        media_title: title,
        creator: entry.creator,
        media_type: entry.media_type,
        genres,
        external_source: entry.external_source,
        rating: rating ?? "",
        sentiment,
        lists: entry.lists.join("; "),
        engagement_types: types.join("; "),
        added_at: entry.added_at,
      });
    });
  });

  const fields = [
    "anon_id", "media_title", "creator", "media_type", "genres", "external_source",
    "rating", "sentiment", "lists", "engagement_types", "added_at",
  ];
  const today = new Date().toISOString().slice(0, 10);
  downloadCSV(`consumed_media_detail_${today}.csv`, rows, fields);
  return rows.length;
}

async function buildPollResponsesExport() {
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .or("is_persona.is.null,is_persona.eq.false");
  const realUserIds = new Set((users || []).map((u: any) => u.id));

  // All poll pools
  const { data: pollPools } = await supabase
    .from("prediction_pools")
    .select("id, title, category, show_tag, media_external_source")
    .eq("type", "poll");

  const pollMap: Record<string, any> = {};
  (pollPools || []).forEach((p: any) => { pollMap[p.id] = p; });
  const pollIds = Object.keys(pollMap);

  if (pollIds.length === 0) return 0;

  // All user responses to polls
  const { data: responses } = await supabase
    .from("user_predictions")
    .select("user_id, pool_id, prediction, created_at")
    .in("pool_id", pollIds);

  const rows: any[] = [];
  (responses || []).forEach((r: any) => {
    if (!realUserIds.has(r.user_id)) return;
    const pool = pollMap[r.pool_id];
    if (!pool) return;

    const mediaSource = pool.media_external_source || "";
    const mediaType =
      mediaSource === "tmdb" ? (pool.category === "movie" ? "movie" : "tv")
      : mediaSource === "spotify" || mediaSource === "itunes" ? "music"
      : mediaSource === "openlibrary" ? "book"
      : pool.category || "";

    rows.push({
      anon_id: r.user_id,
      poll_question: pool.title || "",
      their_answer: r.prediction || "",
      show_tag: pool.show_tag || "",
      category: pool.category || "",
      media_type: mediaType,
      responded_at: (r.created_at || "").slice(0, 10),
    });
  });

  // Sort by show_tag then poll question for easy reading
  rows.sort((a, b) =>
    (a.show_tag || "").localeCompare(b.show_tag || "") ||
    (a.poll_question || "").localeCompare(b.poll_question || "")
  );

  const fields = [
    "anon_id", "poll_question", "their_answer",
    "show_tag", "category", "media_type", "responded_at",
  ];
  const today = new Date().toISOString().slice(0, 10);
  downloadCSV(`consumed_poll_responses_${today}.csv`, rows, fields);
  return rows.length;
}

async function buildRoomEngagementExport() {
  // Real users only
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .or("is_persona.is.null,is_persona.eq.false");
  const realUserIds = new Set((users || []).map((u: any) => u.id));

  // Official rooms
  const { data: officialRooms } = await supabase
    .from("pools")
    .select("id, name, room_category, media_type, series_tag")
    .eq("is_official", true);

  if (!officialRooms || officialRooms.length === 0) return 0;

  const roomMap: Record<string, any> = {};
  (officialRooms || []).forEach((r: any) => { roomMap[r.id] = r; });
  const roomIds = Object.keys(roomMap);

  // Members of official rooms
  const { data: members } = await supabase
    .from("pool_members")
    .select("pool_id, user_id, role, joined_at")
    .in("pool_id", roomIds);

  // Room takes (discussion posts) per user per room
  const { data: takes } = await supabase
    .from("room_takes")
    .select("user_id, room_id, upvotes");

  const takesMap: Record<string, Record<string, { count: number; upvotes: number }>> = {};
  (takes || []).forEach((t: any) => {
    if (!takesMap[t.user_id]) takesMap[t.user_id] = {};
    if (!takesMap[t.user_id][t.room_id]) takesMap[t.user_id][t.room_id] = { count: 0, upvotes: 0 };
    takesMap[t.user_id][t.room_id].count++;
    takesMap[t.user_id][t.room_id].upvotes += t.upvotes || 0;
  });

  // Room take replies per user per room (need take→room mapping)
  const takeRoomMap: Record<string, string> = {};
  (takes || []).forEach((t: any) => { takeRoomMap[t.id] = t.room_id; });

  const { data: allTakesWithId } = await supabase
    .from("room_takes")
    .select("id, room_id");
  const takeIdToRoom: Record<string, string> = {};
  (allTakesWithId || []).forEach((t: any) => { takeIdToRoom[t.id] = t.room_id; });

  const { data: replies } = await supabase
    .from("room_take_replies")
    .select("user_id, take_id");

  const repliesMap: Record<string, Record<string, number>> = {};
  (replies || []).forEach((r: any) => {
    const roomId = takeIdToRoom[r.take_id];
    if (!roomId) return;
    if (!repliesMap[r.user_id]) repliesMap[r.user_id] = {};
    repliesMap[r.user_id][roomId] = (repliesMap[r.user_id][roomId] || 0) + 1;
  });

  // Room take votes per user per room
  const { data: votes } = await supabase
    .from("room_take_votes")
    .select("user_id, take_id");

  const votesMap: Record<string, Record<string, number>> = {};
  (votes || []).forEach((v: any) => {
    const roomId = takeIdToRoom[v.take_id];
    if (!roomId) return;
    if (!votesMap[v.user_id]) votesMap[v.user_id] = {};
    votesMap[v.user_id][roomId] = (votesMap[v.user_id][roomId] || 0) + 1;
  });

  const rows: any[] = [];
  (members || []).forEach((m: any) => {
    if (!realUserIds.has(m.user_id)) return;
    const room = roomMap[m.pool_id];
    if (!room) return;

    const rid = m.pool_id;
    const uid = m.user_id;
    const takeData = (takesMap[uid] || {})[rid] || { count: 0, upvotes: 0 };
    const replyCount = (repliesMap[uid] || {})[rid] || 0;
    const voteCount = (votesMap[uid] || {})[rid] || 0;
    const isActive = takeData.count > 0 || replyCount > 0 || voteCount > 0;

    rows.push({
      anon_id: uid,
      room_name: room.name || "",
      room_category: room.room_category || "",
      room_media_type: room.media_type || "",
      joined_at: (m.joined_at || "").slice(0, 10),
      role: m.role || "member",
      takes_posted: takeData.count,
      replies_posted: replyCount,
      votes_cast: voteCount,
      total_upvotes_received: takeData.upvotes,
      is_active: isActive ? "yes" : "no",
    });
  });

  // Sort by room then by takes_posted desc
  rows.sort((a, b) =>
    (a.room_name || "").localeCompare(b.room_name || "") ||
    b.takes_posted - a.takes_posted
  );

  const fields = [
    "anon_id", "room_name", "room_category", "room_media_type",
    "joined_at", "role",
    "takes_posted", "replies_posted", "votes_cast",
    "total_upvotes_received", "is_active",
  ];
  const today = new Date().toISOString().slice(0, 10);
  downloadCSV(`consumed_room_engagement_${today}.csv`, rows, fields);
  return rows.length;
}

async function buildTodaysPlayExport() {
  // Real users only
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .or("is_persona.is.null,is_persona.eq.false");
  const realUserIds = new Set((users || []).map((u: any) => u.id));

  // All Today's Play questions (prediction_pools where featured_date is set)
  const { data: featuredPools } = await supabase
    .from("prediction_pools")
    .select("id, title, type, show_tag, category, featured_date, options, correct_answer")
    .not("featured_date", "is", null)
    .order("featured_date", { ascending: false });

  if (!featuredPools || featuredPools.length === 0) return 0;

  const poolMap: Record<string, any> = {};
  (featuredPools || []).forEach((p: any) => { poolMap[p.id] = p; });
  const poolIds = Object.keys(poolMap);

  // All responses to these questions
  const { data: responses } = await supabase
    .from("user_predictions")
    .select("user_id, pool_id, prediction, points_earned, created_at")
    .in("pool_id", poolIds);

  // DNA profiles for archetype labels
  const respondentIds = [...new Set((responses || []).map((r: any) => r.user_id))];
  const { data: dnaProfiles } = respondentIds.length > 0
    ? await supabase
        .from("dna_profiles")
        .select("user_id, label, favorite_genres")
        .in("user_id", respondentIds)
    : { data: [] };

  const dnaMap: Record<string, any> = {};
  (dnaProfiles || []).forEach((d: any) => { dnaMap[d.user_id] = d; });

  const rows: any[] = [];
  (responses || []).forEach((r: any) => {
    if (!realUserIds.has(r.user_id)) return;
    const pool = poolMap[r.pool_id];
    if (!pool) return;

    const dna = dnaMap[r.user_id];
    const isTrivia = pool.type === "trivia";
    const isCorrect = isTrivia
      ? (r.points_earned > 0 ? "yes" : "no")
      : "";

    const topGenres = dna?.favorite_genres
      ? (Array.isArray(dna.favorite_genres) ? dna.favorite_genres : JSON.parse(dna.favorite_genres)).slice(0, 4).join(" | ")
      : "";

    rows.push({
      featured_date: pool.featured_date || "",
      question_type: pool.type || "",
      question: pool.title || "",
      show_tag: pool.show_tag || "",
      category: pool.category || "",
      anon_id: r.user_id,
      dna_archetype: dna?.label || "",
      top_genres: topGenres,
      their_answer: r.prediction || "",
      correct: isCorrect,
      points_earned: r.points_earned ?? "",
      answered_at: (r.created_at || "").slice(0, 10),
    });
  });

  // Sort by date desc then question
  rows.sort((a, b) =>
    (b.featured_date || "").localeCompare(a.featured_date || "") ||
    (a.question || "").localeCompare(b.question || "")
  );

  const fields = [
    "featured_date", "question_type", "question", "show_tag", "category",
    "anon_id", "dna_archetype", "top_genres",
    "their_answer", "correct", "points_earned", "answered_at",
  ];
  const today = new Date().toISOString().slice(0, 10);
  downloadCSV(`consumed_todays_play_responses_${today}.csv`, rows, fields);
  return rows.length;
}

export default function AdminExportsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [masterLoading, setMasterLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pollLoading, setPollLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [todaysPlayLoading, setTodaysPlayLoading] = useState(false);
  const [masterCount, setMasterCount] = useState<number | null>(null);
  const [detailCount, setDetailCount] = useState<number | null>(null);
  const [pollCount, setPollCount] = useState<number | null>(null);
  const [roomCount, setRoomCount] = useState<number | null>(null);
  const [todaysPlayCount, setTodaysPlayCount] = useState<number | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);

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

  const handlePolls = async () => {
    setPollLoading(true);
    setPollCount(null);
    try {
      const count = await buildPollResponsesExport();
      setPollCount(count);
    } finally {
      setPollLoading(false);
    }
  };

  const handleRooms = async () => {
    setRoomLoading(true);
    setRoomCount(null);
    try {
      const count = await buildRoomEngagementExport();
      setRoomCount(count);
    } finally {
      setRoomLoading(false);
    }
  };

  const handleTodaysPlay = async () => {
    setTodaysPlayLoading(true);
    setTodaysPlayCount(null);
    try {
      const count = await buildTodaysPlayExport();
      setTodaysPlayCount(count);
    } finally {
      setTodaysPlayLoading(false);
    }
  };

  const handleBackfillGenres = async () => {
    setBackfillLoading(true);
    setBackfillStatus("Starting…");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setBackfillStatus("Not signed in"); return; }
      let totalResolved = 0;
      for (let i = 0; i < 20; i++) {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backfill-genres`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ limit: 250 }),
        });
        const result = await resp.json();
        if (!resp.ok) { setBackfillStatus(`Error: ${result.error || resp.status}`); return; }
        totalResolved += (result.resolved_with_genres || 0) + (result.resolved_empty || 0);
        if (!result.remaining || result.remaining <= 0) {
          setBackfillStatus(`Done — ${totalResolved} titles resolved this run, nothing left to backfill.`);
          return;
        }
        setBackfillStatus(`${totalResolved} resolved so far, ${result.remaining} remaining…`);
      }
      setBackfillStatus(`Paused after 20 batches (${totalResolved} resolved). Click again to continue.`);
    } catch (e: any) {
      setBackfillStatus(`Error: ${e.message}`);
    } finally {
      setBackfillLoading(false);
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
                <p className="text-sm text-gray-400 leading-snug mb-2">
                  One row per user. Every behavioral dimension in one place.
                </p>
                <ul className="text-xs text-gray-500 space-y-0.5 mb-4 list-disc list-inside">
                  <li>DNA archetype, tagline, flavor notes</li>
                  <li>Claimed genres (from polls) + behavioral genre signals with strength scores</li>
                  <li>Library genres — the actual genres of the titles they track, ranked by count</li>
                  <li>Media type breakdown (TV / movie / book / music / podcast)</li>
                  <li>Top shows + creators they engage with most</li>
                  <li>Tracking counts per list type (Watched, Want to Watch, DNF, Favorites, etc.)</li>
                  <li>Ratings summary + explicit dislikes (items rated 1–2★)</li>
                  <li>Top rated items per media category</li>
                  <li>Trivia attempts, accuracy %, poll votes, DNA moments answered</li>
                </ul>
                <p className="text-xs text-purple-300/70 mb-4">~170 rows · fully anonymous (UUID only, no names or email)</p>
                <button
                  onClick={handleMaster}
                  disabled={masterLoading}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {masterLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
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
                <p className="text-sm text-gray-400 leading-snug mb-2">
                  One row per user × media item. Their complete media behavior, item by item.
                </p>
                <ul className="text-xs text-gray-500 space-y-0.5 mb-4 list-disc list-inside">
                  <li>Every tracked item with title + creator</li>
                  <li>The item's genres (from the media_genres cache)</li>
                  <li>Which list(s) it's on (Watched, Want to Watch, Did Not Finish, Favorites, etc.)</li>
                  <li>Rating + sentiment label (liked / neutral / disliked / unrated)</li>
                  <li>Engagement type flags (tracked, rated, rated_high, rated_low, did_not_finish, favorited)</li>
                  <li>When they added it</li>
                </ul>
                <p className="text-xs text-teal-300/70 mb-4">~700+ rows · join to Master on <code className="text-teal-200">anon_id</code></p>
                <button
                  onClick={handleDetail}
                  disabled={detailLoading}
                  className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {detailLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {detailLoading ? "Building export…" : "Download consumed_media_detail.csv"}
                </button>
                {detailCount !== null && (
                  <p className="text-xs text-green-400 mt-2">✓ Downloaded {detailCount} rows</p>
                )}
              </div>
            </div>
          </div>

          {/* Poll Responses Export */}
          <div className="bg-gradient-to-br from-amber-900/40 to-amber-800/20 border border-amber-700/40 rounded-2xl p-6">
            <div className="flex items-start gap-5">
              <div className="bg-amber-900/50 rounded-xl p-3 flex-shrink-0">
                <BarChart2 size={24} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white mb-1">Poll Responses Export</p>
                <p className="text-sm text-gray-400 leading-snug mb-2">
                  One row per user × poll answered. What opinion they expressed, on which question, about which show or category.
                </p>
                <ul className="text-xs text-gray-500 space-y-0.5 mb-4 list-disc list-inside">
                  <li>The exact poll question</li>
                  <li>What they chose as their answer</li>
                  <li>Show tag + category (Paradise, Music, TV, etc.)</li>
                  <li>Media type (tv / movie / music / book)</li>
                  <li>When they responded</li>
                </ul>
                <p className="text-xs text-amber-300/70 mb-4">One row per response · join to Master on <code className="text-amber-200">anon_id</code></p>
                <button
                  onClick={handlePolls}
                  disabled={pollLoading}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {pollLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {pollLoading ? "Building export…" : "Download consumed_poll_responses.csv"}
                </button>
                {pollCount !== null && (
                  <p className="text-xs text-green-400 mt-2">✓ Downloaded {pollCount} responses</p>
                )}
              </div>
            </div>
          </div>

          {/* Room Engagement Export */}
          <div className="bg-gradient-to-br from-sky-900/40 to-sky-800/20 border border-sky-700/40 rounded-2xl p-6">
            <div className="flex items-start gap-5">
              <div className="bg-sky-900/50 rounded-xl p-3 flex-shrink-0">
                <FileText size={24} className="text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white mb-1">Room Engagement Export</p>
                <p className="text-sm text-gray-400 leading-snug mb-2">
                  One row per user × room they've joined. Who's in which room, how active they are, and how their content lands.
                </p>
                <ul className="text-xs text-gray-500 space-y-0.5 mb-4 list-disc list-inside">
                  <li>Room name, category (media / genre / platform), and media type</li>
                  <li>When they joined + their role (host or member)</li>
                  <li>Takes (posts) written in that room</li>
                  <li>Replies written + votes cast on others' takes</li>
                  <li>Total upvotes their takes have received</li>
                  <li>Active flag — yes if they've posted, replied, or voted at least once</li>
                </ul>
                <p className="text-xs text-sky-300/70 mb-4">One row per user × room · join to Master on <code className="text-sky-200">anon_id</code></p>
                <button
                  onClick={handleRooms}
                  disabled={roomLoading}
                  className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {roomLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {roomLoading ? "Building export…" : "Download consumed_room_engagement.csv"}
                </button>
                {roomCount !== null && (
                  <p className="text-xs text-green-400 mt-2">✓ Downloaded {roomCount} rows</p>
                )}
              </div>
            </div>
          </div>

          {/* Today's Play Responses Export */}
          <div className="bg-gradient-to-br from-teal-900/40 to-emerald-800/20 border border-teal-700/40 rounded-2xl p-6">
            <div className="flex items-start gap-5">
              <div className="bg-teal-900/50 rounded-xl p-3 flex-shrink-0">
                <BarChart2 size={24} className="text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white mb-1">Today's Play Responses</p>
                <p className="text-sm text-gray-400 leading-snug mb-2">
                  One row per user × featured daily question answered. Covers all three types — trivia, opinion polls, and predictions — filtered to featured daily content only.
                </p>
                <ul className="text-xs text-gray-500 space-y-0.5 mb-4 list-disc list-inside">
                  <li>Featured date + question type (trivia / poll / predict)</li>
                  <li>The exact question + show tag + category</li>
                  <li>What they answered</li>
                  <li>Whether they got it right (trivia only) + points earned</li>
                  <li>Their DNA archetype + top genres — so you can see who engaged with what</li>
                </ul>
                <p className="text-xs text-teal-300/70 mb-4">One row per response · join to Master on <code className="text-teal-200">anon_id</code></p>
                <button
                  onClick={handleTodaysPlay}
                  disabled={todaysPlayLoading}
                  className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {todaysPlayLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {todaysPlayLoading ? "Building export…" : "Download consumed_todays_play_responses.csv"}
                </button>
                {todaysPlayCount !== null && (
                  <p className="text-xs text-green-400 mt-2">✓ Downloaded {todaysPlayCount} responses</p>
                )}
              </div>
            </div>
          </div>

          {/* Genre Backfill utility */}
          <div className="bg-gradient-to-br from-indigo-900/40 to-indigo-800/20 border border-indigo-700/40 rounded-2xl p-6">
            <div className="flex items-start gap-5">
              <div className="bg-indigo-900/50 rounded-xl p-3 flex-shrink-0">
                <BarChart2 size={24} className="text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white mb-1">Backfill Genre Cache</p>
                <p className="text-sm text-gray-400 leading-snug mb-4">
                  Resolves and caches genres for every tracked title and every play item's linked media. Run this so genre rooms (Horror, Mystery, Fantasy, etc.) can automatically pick up trivia and votes about matching titles. Safe to re-run anytime.
                </p>
                <button
                  onClick={handleBackfillGenres}
                  disabled={backfillLoading}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {backfillLoading ? <Loader2 size={14} className="animate-spin" /> : <BarChart2 size={14} />}
                  {backfillLoading ? "Backfilling…" : "Run genre backfill"}
                </button>
                {backfillStatus && (
                  <p className="text-xs text-indigo-300 mt-2">{backfillStatus}</p>
                )}
              </div>
            </div>
          </div>

          {/* How to use */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 mt-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">How to use these files</p>
            <div className="space-y-2 text-sm text-gray-400">
              <p>Both files share the same <span className="text-white font-medium">anon_id</span> — a consistent anonymous ID per user across both downloads.</p>
              <p><span className="text-white font-medium">Full picture:</span> Master tells you who a user is (DNA archetype, genre affinities, engagement level). Detail tells you exactly what they've watched, read, rated, and abandoned, item by item.</p>
              <p><span className="text-white font-medium">Google Sheets:</span> Import both files, then use <code className="text-purple-300 text-xs">VLOOKUP(A2, 'Master'!A:Z, col, false)</code> to enrich the detail rows with profile data.</p>
              <p><span className="text-white font-medium">Pivot tables:</span> Filter Master by <code className="text-purple-300 text-xs">top_media_type</code>, <code className="text-purple-300 text-xs">dna_archetype</code>, or <code className="text-purple-300 text-xs">top_shows_engaged</code>. Filter Detail by <code className="text-purple-300 text-xs">sentiment</code> or <code className="text-purple-300 text-xs">lists</code>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
