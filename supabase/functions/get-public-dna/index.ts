
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("get-public-dna function hit!", req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create service role client to bypass RLS for public DNA access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse URL parameters
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');

    console.log("Parameters:", { userId });

    if (!userId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required parameter: user_id' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch DNA profile by user_id
    const { data: profileData, error: profileError } = await supabase
      .from("dna_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profileError) {
      console.error("DNA profile not found:", { profileError, userId });
      return new Response(JSON.stringify({ 
        error: 'DNA Profile not found',
        details: profileError?.message || 'No profile data returned'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch user info
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("user_name, display_name")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("User not found:", { userError, userId });
      return new Response(JSON.stringify({ 
        error: 'User not found',
        details: userError?.message || 'No user data returned'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("DNA profile and user found for:", userId);

    // Combine the data
    const dnaProfile = {
      ...profileData,
      users: userData
    };

    return new Response(JSON.stringify({
      dna_profile: dnaProfile
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error: ' + error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
