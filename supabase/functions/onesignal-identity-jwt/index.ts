import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createOneSignalIdentityJwtHandler,
  oneSignalIdentityCorsHeaders,
} from "../_shared/onesignal-identity-endpoint.ts";
import { issueOneSignalJwt } from "../_shared/onesignal-identity.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const appId = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
const privateKeyPem =
  Deno.env.get("ONESIGNAL_IDENTITY_VERIFICATION_PRIVATE_KEY") ?? "";
const tombstoneRpc = Deno.env.get("ONESIGNAL_IDENTITY_TOMBSTONE_RPC")?.trim() ?? "";

const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const handler = createOneSignalIdentityJwtHandler({
  authenticate: async (accessToken) => {
    if (!admin) throw new Error("Supabase service role is not configured");
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(accessToken);
    if (error || !user) return null;
    return user.id;
  },
  loadLiveUser: async (userId) => {
    if (!admin) throw new Error("Supabase service role is not configured");
    const { data, error } = await admin
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    return error ? { error } : data;
  },
  ...(tombstoneRpc
    ? {
        checkDeletedTombstone: async (userId: string) => {
          if (!admin) throw new Error("Supabase service role is not configured");
          const { data, error } = await admin.rpc(tombstoneRpc, {
            p_user_id: userId,
          });
          if (error) throw error;
          // The safe RPC must return a boolean. Ambiguous output is denied by
          // the endpoint's catch path rather than treated as "not deleted".
          if (typeof data !== "boolean") {
            throw new Error("Tombstone RPC returned an invalid result");
          }
          return data;
        },
      }
    : {}),
  issue: (userId) =>
    issueOneSignalJwt({
      userId,
      appId,
      privateKeyPem,
      ttlSeconds: 120,
    }),
});

serve((request) => handler(request));

export { handler, oneSignalIdentityCorsHeaders };