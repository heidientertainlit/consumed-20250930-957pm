import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { canAccessPublicProfile, canAccessFullProfile, isProfileId, loadProfileAccess, resolveProfileViewer } from "../_shared/public-profile-access.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'private, no-store',
  'Vary': 'Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');

    if (!isProfileId(userId)) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const viewerId = await resolveProfileViewer(supabase, req.headers.get('Authorization'), Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const access = await loadProfileAccess(supabase, userId, viewerId);
    if (!canAccessPublicProfile(access)) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [{ data: profile, error: profileError }, { data: dnaProfile, error: dnaError }] = await Promise.all([
      supabase.from('public_user_profiles').select('id, display_name, user_name, avatar, first_name, last_name').eq('id', userId).maybeSingle(),
      supabase.from('dna_profiles').select('label, tagline').eq('user_id', userId).maybeSingle(),
    ]);
    if (profileError || dnaError || !profile) throw new Error('Profile unavailable');
    // This legacy invite endpoint is always a teaser. Accepted friends use the
    // canonical /user/:id page for full profile/history, not a second stats API.
    const fullAccess = canAccessFullProfile(access);
      return new Response(JSON.stringify({
        id: profile.id,
        display_name: fullAccess ? profile.display_name : profile.first_name
          ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name.charAt(0)}.` : ''}`
          : profile.user_name,
        username: profile.user_name,
        avatar_url: profile.avatar,
        dna_label: dnaProfile?.label || null,
        dna_tagline: dnaProfile?.tagline || null,
        access: 'preview',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Profile not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
