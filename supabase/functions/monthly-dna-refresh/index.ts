import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';

  // Only callable with service role key
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader.replace('Bearer ', '') !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Get all real (non-persona) users who have completed the DNA survey
  const { data: users, error } = await supabase
    .from('edna_responses')
    .select('user_id')
    .then(async ({ data, error }) => {
      if (error || !data) return { data: null, error };
      // Deduplicate user_ids
      const uniqueIds = [...new Set(data.map((r: any) => r.user_id))];
      // Filter out persona users
      const { data: personas } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('is_persona', true);
      const personaIds = new Set((personas || []).map((p: any) => p.user_id));
      return {
        data: uniqueIds.filter(id => !personaIds.has(id)).map(id => ({ user_id: id })),
        error: null
      };
    });

  if (error || !users) {
    return new Response(JSON.stringify({ error: 'Failed to fetch users', details: error }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const results = { success: 0, failed: 0, errors: [] as string[] };
  const generateUrl = `${supabaseUrl}/functions/v1/generate-dna-profile-v2`;

  for (const { user_id } of users) {
    try {
      const resp = await fetch(generateUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id })
      });

      if (resp.ok) {
        results.success++;
      } else {
        const body = await resp.text();
        results.failed++;
        results.errors.push(`${user_id}: ${resp.status} ${body.slice(0, 100)}`);
      }
    } catch (e: any) {
      results.failed++;
      results.errors.push(`${user_id}: ${e.message}`);
    }

    // Small delay to avoid hammering OpenAI
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`Monthly DNA refresh complete: ${results.success} succeeded, ${results.failed} failed`);

  return new Response(JSON.stringify({
    message: 'Monthly DNA refresh complete',
    total: users.length,
    ...results
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
