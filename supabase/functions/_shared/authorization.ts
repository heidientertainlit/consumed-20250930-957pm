import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AuthorizationResult =
  | { authorized: true; caller: "service" | "admin"; userId?: string }
  | { authorized: false; status: 401 | 403; error: string };

function bearerToken(req: Request): string {
  const authorization = req.headers.get("Authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export function authorizeServiceRole(req: Request): AuthorizationResult {
  const token = bearerToken(req);
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!token) {
    return { authorized: false, status: 401, error: "Missing authorization header" };
  }
  if (!serviceRoleKey || token !== serviceRoleKey) {
    return { authorized: false, status: 403, error: "Forbidden" };
  }

  return { authorized: true, caller: "service" };
}

export async function authorizeAdminOrService(req: Request): Promise<AuthorizationResult> {
  const token = bearerToken(req);
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!token) {
    return { authorized: false, status: 401, error: "Missing authorization header" };
  }
  if (serviceRoleKey && token === serviceRoleKey) {
    return { authorized: true, caller: "service" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return { authorized: false, status: 401, error: "Unauthorized" };
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
  if (authError || !user) {
    return { authorized: false, status: 401, error: "Unauthorized" };
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.is_admin) {
    return { authorized: false, status: 403, error: "Forbidden: admin only" };
  }

  return { authorized: true, caller: "admin", userId: user.id };
}