import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { imageSize } from "npm:image-size@2.0.2";

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

    const isMultipart = (req.headers.get("content-type") || "").includes("multipart/form-data");
    const formData = isMultipart ? await req.formData() : null;
    const body = isMultipart
      ? { action: String(formData?.get("action") || "") }
      : await req.json().catch(() => ({}));
    const { data: existingProfile, error: lookupError } = await admin
      .from("users")
      .select("id, first_name, last_name, user_name, avatar, identity_confirmed_at")
      .eq("id", user.id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const removeAvatarObjects = async (paths: string[]) => {
      if (paths.length === 0) return null;
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const cleanup = await admin.storage.from("avatars").remove(paths);
        lastError = cleanup.error;
        if (!lastError) break;
      }
      return lastError;
    };

    if (body.action === "upload-avatar" || body.action === "remove-avatar") {
      if (!existingProfile) return json({ error: "Profile not found." }, 404);

      const projectUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
      const avatarPrefix = `${projectUrl}/storage/v1/object/public/avatars/${user.id}/`;
      const objectPathFromUrl = (value: unknown) => {
        if (typeof value !== "string" || !value.startsWith(avatarPrefix)) return null;
        try {
          const parsed = new URL(value);
          const name = parsed.pathname.split("/").pop();
          return name ? `${user.id}/${name}` : null;
        } catch {
          return null;
        }
      };

      const previousAvatarUrl = typeof existingProfile.avatar === "string"
        ? existingProfile.avatar
        : null;
      const previousObjectPath = objectPathFromUrl(previousAvatarUrl);
      let nextAvatarUrl: string | null = null;
      let nextObjectPath: string | null = null;

      if (body.action === "upload-avatar") {
        const photo = formData?.get("photo");
        if (!(photo instanceof File)) return json({ error: "A profile photo is required." }, 400);
        if (!["image/webp", "image/jpeg"].includes(photo.type)) {
          return json({ error: "Profile photos must be JPEG or WebP." }, 400);
        }
        if (photo.size <= 0 || photo.size > 2 * 1024 * 1024) {
          return json({ error: "The processed profile photo must be 2 MB or smaller." }, 400);
        }

        const photoBytes = new Uint8Array(await photo.arrayBuffer());
        let dimensions: ReturnType<typeof imageSize>;
        try {
          dimensions = imageSize(photoBytes);
        } catch {
          return json({ error: "The uploaded file is not a valid image." }, 400);
        }
        const detectedType = dimensions.type === "jpg" ? "jpeg" : dimensions.type;
        const declaredType = photo.type.replace("image/", "");
        if (
          !["jpeg", "webp"].includes(detectedType || "")
          || detectedType !== declaredType
          || dimensions.width !== 512
          || dimensions.height !== 512
        ) {
          return json({ error: "Profile photos must be valid 512 × 512 JPEG or WebP images." }, 400);
        }

        const extension = detectedType === "webp" ? "webp" : "jpg";
        const objectName = `profile-${crypto.randomUUID()}.${extension}`;
        nextObjectPath = `${user.id}/${objectName}`;
        const { error: uploadError } = await admin.storage
          .from("avatars")
          .upload(nextObjectPath, photoBytes, {
            upsert: false,
            contentType: photo.type,
            cacheControl: "31536000",
          });
        if (uploadError) throw uploadError;

        nextAvatarUrl = `${admin.storage.from("avatars").getPublicUrl(nextObjectPath).data.publicUrl}?v=${Date.now()}`;
      }

      let updateQuery = admin
        .from("users")
        .update({ avatar: nextAvatarUrl })
        .eq("id", user.id);
      updateQuery = previousAvatarUrl
        ? updateQuery.eq("avatar", previousAvatarUrl)
        : updateQuery.is("avatar", null);
      const { data: updatedProfile, error: avatarError } = await updateQuery
        .select("id")
        .maybeSingle();

      if (avatarError || !updatedProfile) {
        if (nextObjectPath) await removeAvatarObjects([nextObjectPath]);
        if (avatarError) throw avatarError;
        return json({ error: "Your profile photo changed elsewhere. Please try again." }, 409);
      }

      if (previousObjectPath && previousObjectPath !== nextObjectPath) {
        const cleanupError = await removeAvatarObjects([previousObjectPath]);
        if (cleanupError) {
          let rollbackQuery = admin
            .from("users")
            .update({ avatar: previousAvatarUrl })
            .eq("id", user.id);
          rollbackQuery = nextAvatarUrl
            ? rollbackQuery.eq("avatar", nextAvatarUrl)
            : rollbackQuery.is("avatar", null);
          const { data: rolledBack } = await rollbackQuery.select("id").maybeSingle();
          if (rolledBack && nextObjectPath) {
            await removeAvatarObjects([nextObjectPath]);
          } else {
            await removeAvatarObjects([previousObjectPath]);
          }
          return json({ error: "We couldn't finish replacing your previous photo. Please try again." }, 503);
        }
      }

      const { data: canonicalProfile } = await admin
        .from("users")
        .select("avatar")
        .eq("id", user.id)
        .maybeSingle();
      const metadataError = canonicalProfile?.avatar === nextAvatarUrl
        ? (await admin.auth.admin.updateUserById(user.id, {
            user_metadata: {
              ...user.user_metadata,
              avatar_url: nextAvatarUrl,
            },
          })).error
        : null;
      if (metadataError) console.error("[complete-profile avatar metadata sync]", metadataError);

      return json({ avatar_url: nextAvatarUrl, metadata_synced: !metadataError });
    }

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