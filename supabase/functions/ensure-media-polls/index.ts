import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Stamps baseline template polls onto a media title the first time its Play tab
// is opened, so every media detail page has at least a few polls to vote on.
// Templates live in the media_poll_templates table ({title} placeholder).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const BASELINE_COUNT = 3;

// Simple deterministic hash so each title always gets the same templates
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Require a signed-in user
    const authed = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user }, error: userError } = await authed.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const cap = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n).trim() : '');
    const external_id = cap(body?.external_id, 100);
    const external_source = cap(body?.external_source, 50);
    const title = cap(body?.title, 300);
    const media_type = cap(body?.media_type, 30) || null;
    if (!external_id || !external_source || !title) {
      return new Response(JSON.stringify({ error: 'external_id, external_source and title are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Already has baseline polls? (consumed-origin vote pools tied to this title)
    const { data: existing, error: existErr } = await admin
      .from('prediction_pools')
      .select('id')
      .eq('media_external_id', external_id)
      .eq('media_external_source', external_source)
      .eq('type', 'vote')
      .eq('origin_type', 'consumed')
      .eq('status', 'open')
      .limit(BASELINE_COUNT);
    if (existErr) throw existErr;
    if ((existing?.length || 0) >= BASELINE_COUNT) {
      return new Response(JSON.stringify({ created: 0, existing: existing!.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: templates, error: tmplErr } = await admin
      .from('media_poll_templates')
      .select('id, template_title, options')
      .eq('active', true);
    if (tmplErr) throw tmplErr;
    if (!templates || templates.length === 0) {
      return new Response(JSON.stringify({ created: 0, existing: existing?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Deterministic pick: rotate through templates based on the title's hash
    const sorted = templates.slice().sort((a: any, b: any) => a.id.localeCompare(b.id));
    const start = hashStr(`${external_source}:${external_id}`) % sorted.length;
    const picked: any[] = [];
    for (let i = 0; i < sorted.length && picked.length < BASELINE_COUNT; i++) {
      picked.push(sorted[(start + i) % sorted.length]);
    }

    // Avoid duplicating a template already stamped (match on rendered title)
    const { data: existingTitles } = await admin
      .from('prediction_pools')
      .select('title')
      .eq('media_external_id', external_id)
      .eq('media_external_source', external_source);
    const existingSet = new Set((existingTitles || []).map((r: any) => r.title));

    const rows = picked
      .map((t: any) => ({
        title: String(t.template_title).replaceAll('{title}', title),
        type: 'vote',
        status: 'open',
        category: media_type === 'book' ? 'books' : media_type === 'tv' ? 'tv' : media_type === 'movie' ? 'movies' : 'entertainment',
        icon: 'vote',
        options: t.options,
        points_reward: 10,
        origin_type: 'consumed',
        media_title: title,
        media_external_id: external_id,
        media_external_source: external_source,
        media_type,
      }))
      .filter((r) => !existingSet.has(r.title))
      .slice(0, Math.max(0, BASELINE_COUNT - (existing?.length || 0)));

    let created = 0;
    if (rows.length > 0) {
      const { error: insErr } = await admin.from('prediction_pools').insert(rows);
      if (insErr) throw insErr;
      created = rows.length;
    }

    return new Response(JSON.stringify({ created, existing: existing?.length || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('ensure-media-polls error:', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
