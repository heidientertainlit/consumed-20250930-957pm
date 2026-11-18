import type { SupabaseClient } from "@supabase/supabase-js";

/** Read membership by exact provider identity and any persisted canonical alias. */
export async function loadSavedMediaListIds(
  client: Pick<SupabaseClient, "from" | "rpc">,
  userId: string,
  externalId: string,
  externalSource: string,
): Promise<string[]> {
  const [legacy, identity] = await Promise.all([
    client.from("list_items").select("list_id")
      .eq("user_id", userId)
      .eq("external_id", externalId)
      .eq("external_source", externalSource),
    client.rpc("resolve_media_canonical_id", {
      p_external_source: externalSource,
      p_external_id: externalId,
    }),
  ]);
  if (legacy.error) throw legacy.error;
  const listIds = new Set<string>((legacy.data || []).map((row: any) => row.list_id));
  // An unavailable alias resolver must not prevent exact-provider membership.
  const canonicalId = !identity.error && (
    typeof identity.data === "string"
      ? identity.data
      : identity.data?.canonical_media_id || identity.data?.canonicalMediaId
  );
  if (canonicalId) {
    const canonical = await client.from("list_items").select("list_id")
      .eq("user_id", userId).eq("canonical_media_id", canonicalId);
    if (canonical.error) throw canonical.error;
    for (const row of canonical.data || []) listIds.add(row.list_id);
  }
  return [...listIds];
}
