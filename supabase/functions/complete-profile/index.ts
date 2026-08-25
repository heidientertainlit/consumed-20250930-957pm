import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const normalizeUsername = (value: unknown) =>
  String(value || "").trim().replace(/^@+/, "").toLowerCase();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    );
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user?.email) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const username = normalizeUsername(body.username);
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return json({ error: "Username must be 3-20 characters using only letters, numbers, and underscores." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: conflict, error: conflictError } = await admin
      .from("users")
      .select("id")
      .ilike("user_name", username)
      .neq("id", user.id)
      .limit(1)
      .maybeSingle();
    if (conflictError) throw conflictError;
    if (conflict) return json({ available: false, error: "That username is already taken." }, 409);
    if (body.action === "check") return json({ available: true });

    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    if (!firstName || !lastName || firstName.length > 50 || lastName.length > 50) {
      return json({ error: "First and last name are required and must be 50 characters or fewer." }, 400);
    }

    const displayName = `${firstName} ${lastName}`.trim();
    const profileFields = {
      user_name: username,
      first_name: firstName,
      last_name: lastName,
      display_name: displayName,
      identity_confirmed_at: new Date().toISOString(),
    };
    const { data: existingProfile, error: lookupError } = await admin
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const profileResult = existingProfile
      ? await admin.from("users").update(profileFields).eq("id", user.id)
      : await admin.from("users").insert({
          id: user.id,
          email: user.email,
          ...profileFields,
        });
    if (profileResult.error) {
      if (profileResult.error.code === "23505") {
        return json({ available: false, error: "That username is already taken." }, 409);
      }
      throw profileResult.error;
    }

    const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        first_name: firstName,
        last_name: lastName,
        user_name: username,
        display_name: displayName,
      },
    });
    if (metadataError) {
      console.error("[complete-profile metadata sync]", metadataError);
    }

    return json({
      available: true,
      metadata_synced: !metadataError,
      profile: {
        first_name: firstName,
        last_name: lastName,
        user_name: username,
      },
    });
  } catch (error) {
    console.error("[complete-profile]", error);
    return json({ error: "We couldn't save your profile. Please try again." }, 500);
  }
});