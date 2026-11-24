import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createListReadGate } from "../../../shared/list-read-access.ts";

export { verifiedListViewer } from "../../../shared/list-read-access.ts";

export function listReadScope(caller: ReturnType<typeof createClient>, viewerId: string | null) {
  let service: ReturnType<typeof createClient> | undefined;
  return createListReadGate(caller, () => service ??= createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  ), viewerId, Deno.env.get("LIST_ACCESS_ENFORCEMENT"));
}
