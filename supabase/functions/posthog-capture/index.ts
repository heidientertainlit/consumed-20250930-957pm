import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handlePostHogCaptureRequest,
  type PostHogCaptureHandlerDependencies,
} from "../_shared/posthog-capture-handler.ts";
import { loadLiveUser } from "../_shared/provider-ingestion-guard.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  : null;

const configuredOrigins = [
  "https://app.consumedapp.com",
  "https://www.consumedapp.com",
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  ...(Deno.env.get("REPLIT_DEV_DOMAIN")
    ? [`https://${Deno.env.get("REPLIT_DEV_DOMAIN")}`]
    : []),
  ...(Deno.env.get("POSTHOG_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
].map((origin) => origin.replace(/\/+$/, ""));

const deps: PostHogCaptureHandlerDependencies = {
  allowedOrigins: configuredOrigins,
  captureHost: Deno.env.get("POSTHOG_CAPTURE_HOST") ||
    "https://us.i.posthog.com",
  // POSTHOG_CAPTURE_TOKEN is the replacement server-only name.  The existing
  // POSTHOG_API_KEY remains an explicit legacy fallback during staged
  // rotation; remove it after the replacement is confirmed.
  captureToken: Deno.env.get("POSTHOG_CAPTURE_TOKEN") ||
    Deno.env.get("POSTHOG_API_KEY") || "",
  guestSecret: Deno.env.get("POSTHOG_GUEST_HMAC_SECRET") || "",
  authenticateBearer: async (token) => {
    if (!admin) return null;
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (error || !user?.id) return null;
    return { id: user.id, email: user.email };
  },
  loadLiveAccount: async (userId) => {
    if (!admin) return { status: "error" as const };
    const live = await loadLiveUser(admin, userId, "id,email");
    if (!live.allowed) {
      return {
        status: live.reason === "account_lookup_failed" ? "error" as const : "missing" as const,
      };
    }
    const { data: tombstone, error } = await admin
      .from("deleted_account_tombstones")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { status: "error" as const };
    if (tombstone?.user_id === userId) return { status: "missing" as const };
    return {
      status: "live" as const,
      id: live.user.id,
      email: live.user.email || null,
    };
  },
};

function routeFromRequest(req: Request): string | undefined {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const marker = "/posthog-capture";
  const markerIndex = path.lastIndexOf(marker);
  if (markerIndex < 0) return "__unknown__";
  const suffix = path.slice(markerIndex + marker.length).replace(/^\/+/, "");
  return suffix || undefined;
}

Deno.serve((req) => {
  return handlePostHogCaptureRequest(req, routeFromRequest(req), deps);
});
