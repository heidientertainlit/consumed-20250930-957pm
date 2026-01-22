import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    if (body.action === 'create_daily_runs_table') {
      const { error } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS daily_runs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            run_date DATE NOT NULL UNIQUE,
            status TEXT DEFAULT 'completed',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });

      if (error) {
        const { error: checkError } = await supabaseAdmin
          .from('daily_runs')
          .select('id')
          .limit(1);
        
        if (checkError && checkError.code === '42P01') {
          return new Response(JSON.stringify({ 
            error: 'Table does not exist and could not be created. Please create it manually.',
            details: error.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({ message: 'daily_runs table ready' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      message: 'No action specified. Use action: "create_daily_runs_table" for utility operations.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
