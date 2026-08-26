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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const { data: existingProfile, error: lookupError } = await admin
      .from("users")
      .select("id, first_name, last_name, user_name, identity_confirmed_at")
      .eq("id", user.id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (body.action === "confirm-existing") {
      const existingUsername = normalizeUsername(existingProfile?.user_name);
      const firstName = String(existingProfile?.first_name || "").trim();
      const lastName = String(existingProfile?.last_name || "").trim();
      if (
        !existingProfile
        || !firstName
        || !lastName
        || !/^[a-z0-9_]{3,20}$/.test(existingUsername)
      ) {
        return json({ error: "Your profile is missing required identity details." }, 422);
      }
      if (!existingProfile.identity_confirmed_at) {
        const { error: confirmationError } = await admin
          .from("users")
          .update({ identity_confirmed_at: new Date().toISOString() })
          .eq("id", user.id);
        if (confirmationError) throw confirmationError;
      }
      return json({
        available: true,
        profile: {
          first_name: firstName,
          last_name: lastName,
          user_name: existingUsername,
          identity_confirmed_at: existingProfile.identity_confirmed_at || new Date().toISOString(),
        },
      });
    }

    const username = normalizeUsername(body.username);
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return json({ error: "Username must be 3-20 characters using only letters, numbers, and underscores." }, 400);
    }
    if (
      existingProfile?.identity_confirmed_at
      && normalizeUsername(existingProfile.user_name) !== username
    ) {
      return json({ error: "Usernames cannot be changed after profile setup." }, 400);
    }

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
        identity_confirmed_at: profileFields.identity_confirmed_at,
      },
    });
  } catch (error) {
    console.error("[complete-profile]", error);
    return json({ error: "We couldn't save your profile. Please try again." }, 500);
  }
});