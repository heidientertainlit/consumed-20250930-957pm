import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Stamps baseline template polls onto a room the first time its Play tab is
// opened, so every room has a few polls even before real content exists.
// Templates live in room_poll_templates ({room} placeholder).
// Stamped polls carry partner_tag = normalized room key, which keeps them out
// of the global feed carousels (those filter partner_tag IS NULL) while
// RoomPlay's tag matching picks them up.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const BASELINE_COUNT = 3;

const norm = (s: unknown) => String(s ?? '').toLowerCase().trim();

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
    const room_name = cap(body?.room_name, 200);
    const series_tag = cap(body?.series_tag, 200);
    if (!room_name) {
      return new Response(JSON.stringify({ error: 'room_name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    // partner_tag must be contained in the normalized room name for RoomPlay to match
    const roomKey = norm(series_tag) || norm(room_name);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: existing, error: existErr } = await admin
      .from('prediction_pools')
      .select('id, title')
      .eq('partner_tag', roomKey)
      .eq('type', 'vote')
      .eq('origin_type', 'consumed')
      .eq('status', 'open');
    if (existErr) throw existErr;
    if ((existing?.length || 0) >= BASELINE_COUNT) {
      return new Response(JSON.stringify({ created: 0, existing: existing!.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: templates, error: tmplErr } = await admin
      .from('room_poll_templates')
      .select('id, template_title, options')
      .eq('active', true);
    if (tmplErr) throw tmplErr;
    if (!templates || templates.length === 0) {
      return new Response(JSON.stringify({ created: 0, existing: existing?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const sorted = templates.slice().sort((a: any, b: any) => a.id.localeCompare(b.id));
    const start = hashStr(roomKey) % sorted.length;
    const picked: any[] = [];
    for (let i = 0; i < sorted.length && picked.length < BASELINE_COUNT; i++) {
      picked.push(sorted[(start + i) % sorted.length]);
    }

    const existingSet = new Set((existing || []).map((r: any) => r.title));
    const rows = picked
      .map((t: any) => ({
        id: crypto.randomUUID(), // prediction_pools has no default id
        title: String(t.template_title).replaceAll('{room}', room_name),
        type: 'vote',
        status: 'open',
        category: 'entertainment',
        icon: 'vote',
        options: t.options,
        points_reward: 10,
        origin_type: 'consumed',
        partner_tag: roomKey,
        show_tag: room_name,
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
    console.error('ensure-room-polls error:', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
