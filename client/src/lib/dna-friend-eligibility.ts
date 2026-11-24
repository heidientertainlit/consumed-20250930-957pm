import { supabase } from "@/lib/supabase";

type FriendEligibility = { friend_id: string; has_survey: boolean; tracked_items: number };

/** Do not count raw rows in a friend's library; use the comparison gate's source. */
export async function loadDnaComparisonFriends(userId: string, token: string) {
  const { data: friendships, error } = await supabase.from("friendships")
    .select("user_id,friend_id").eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  if (error) throw error;
  const ids = [...new Set((friendships || []).map(row => row.user_id === userId ? row.friend_id : row.user_id))]
    .filter(id => id && id !== userId);
  const friends = [];
  for (let start = 0; start < ids.length; start += 50) {
    const batch = ids.slice(start, start + 50);
    const { data, error: eligibilityError } = await supabase.functions.invoke<{ eligibility: FriendEligibility[] }>(
      "compare-dna-friend",
      { headers: { Authorization: `Bearer ${token}` }, body: { action: "readiness-list", friend_ids: batch } },
    );
    if (eligibilityError || !Array.isArray(data?.eligibility)) throw new Error("Could not load comparison eligibility");
    if (!data.eligibility.length) continue;
    const eligibleIds = new Map(data.eligibility.map(row => [row.friend_id, row]));
    const { data: profiles, error: profileError } = await supabase.from("public_user_profiles")
      .select("id,user_name,avatar").in("id", [...eligibleIds.keys()]);
    if (profileError) throw profileError;
    for (const profile of profiles || []) {
      const eligibility = eligibleIds.get(profile.id);
      if (!eligibility) continue;
      const count = eligibility.tracked_items;
      friends.push({
        id: profile.id, user_name: profile.user_name || "Unknown", avatar_url: profile.avatar,
        itemCount: count, hasSurvey: eligibility.has_survey, isEligible: eligibility.has_survey && count >= 10,
      });
    }
  }
  return friends;
}
