import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const AVATAR_BUCKET = "avatars";
const STORAGE_PAGE_SIZE = 100;
const STORAGE_REMOVE_BATCH_SIZE = 100;
const MAX_STORAGE_DEPTH = 10;

type StorageEntry = {
  id?: string | null;
  name?: string;
  metadata?: Record<string, unknown> | null;
};

function isSafeUserAvatarPath(path: string, userId: string): boolean {
  const prefix = `${userId}/`;
  return (
    path.startsWith(prefix) &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").includes("..")
  );
}

function avatarPathFromPublicUrl(
  value: unknown,
  userId: string,
  supabaseUrl: string,
): string | null {
  if (typeof value !== "string" || !value) return null;

  try {
    const url = new URL(value);
    if (url.origin !== new URL(supabaseUrl).origin) return null;

    const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;

    const objectPath = decodeURIComponent(
      url.pathname.slice(markerIndex + marker.length),
    );
    return isSafeUserAvatarPath(objectPath, userId) ? objectPath : null;
  } catch {
    return null;
  }
}

async function listUserAvatarPaths(
  admin: any,
  userId: string,
): Promise<string[]> {
  const paths = new Set<string>();
  const prefixes: Array<{ prefix: string; depth: number }> = [
    { prefix: userId, depth: 0 },
  ];

  while (prefixes.length > 0) {
    const current = prefixes.pop()!;
    let offset = 0;

    while (true) {
      const { data, error } = await admin.storage
        .from(AVATAR_BUCKET)
        .list(current.prefix, {
          limit: STORAGE_PAGE_SIZE,
          offset,
          sortBy: { column: "name", order: "asc" },
        });

      if (error) {
        throw new Error("Unable to enumerate avatar files");
      }

      const entries = (data || []) as StorageEntry[];
      for (const entry of entries) {
        if (!entry.name) {
          throw new Error("Avatar listing returned an invalid object");
        }

        const objectPath = `${current.prefix}/${entry.name}`;
        if (!isSafeUserAvatarPath(objectPath, userId)) {
          throw new Error("Avatar listing returned an unsafe object path");
        }

        const isFolder = !entry.id && !entry.metadata;
        if (isFolder) {
          if (current.depth >= MAX_STORAGE_DEPTH) {
            throw new Error("Avatar folder nesting is too deep");
          }
          prefixes.push({ prefix: objectPath, depth: current.depth + 1 });
        } else {
          paths.add(objectPath);
        }
      }

      if (entries.length < STORAGE_PAGE_SIZE) break;
      offset += entries.length;
    }
  }

  return [...paths];
}

async function removeUserAvatars(
  admin: any,
  userId: string,
  fallbackPaths: Array<string | null>,
) {
  const paths = new Set(await listUserAvatarPaths(admin, userId));
  for (const fallbackPath of fallbackPaths) {
    if (fallbackPath && isSafeUserAvatarPath(fallbackPath, userId)) {
      paths.add(fallbackPath);
    }
  }

  const allPaths = [...paths];
  for (let index = 0; index < allPaths.length; index += STORAGE_REMOVE_BATCH_SIZE) {
    const batch = allPaths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE);
    const { error } = await admin.storage.from(AVATAR_BUCKET).remove(batch);
    if (error) {
      throw new Error("Unable to remove avatar files");
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Account deletion is not configured");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("avatar")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error("Unable to prepare account deletion");
    }

    await removeUserAvatars(admin, user.id, [
      avatarPathFromPublicUrl(profile?.avatar, user.id, supabaseUrl),
      avatarPathFromPublicUrl(
        user.user_metadata?.avatar_url,
        user.id,
        supabaseUrl,
      ),
    ]);

    const { error: deletionError } = await admin.rpc(
      "delete_account_transaction",
      { p_user_id: user.id },
    );

    if (deletionError) {
      // If the RPC committed but its response was interrupted, do not tell the
      // user deletion failed when the Auth account is already gone.
      const {
        data: { user: remainingUser },
      } = await admin.auth.admin.getUserById(user.id);
      if (!remainingUser) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: jsonHeaders,
        });
      }
      throw new Error("Unable to delete account data");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error(
      "Delete account failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return new Response(
      JSON.stringify({
        error: "Account deletion failed. Please try again.",
      }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});