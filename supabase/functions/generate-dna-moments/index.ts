import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const ALL_CATEGORIES = [
  'consumption_style',
  'discovery_behavior',
  'taste_identity',
  'commitment_style',
  'social_behavior',
  'genre_tv_film',
  'genre_books',
  'genre_music',
  'genre_podcasts',
  'genre_gaming',
  'media_identity',
  'media_crossover',
];

const CATEGORY_LABELS: Record<string, string> = {
  consumption_style: 'Consumption Style',
  discovery_behavior: 'Discovery Behavior',
  taste_identity: 'Taste Identity',
  commitment_style: 'Commitment Style',
  social_behavior: 'Social Behavior',
  genre_tv_film: 'TV & Film',
  genre_books: 'Books',
  genre_music: 'Music',
  genre_podcasts: 'Podcasts',
  genre_gaming: 'Gaming',
  media_identity: 'Media Identity',
  media_crossover: 'Media Crossover',
};

const SYSTEM_PROMPT = `
You are writing Entertainment DNA questions for the Consumed app — a social entertainment platform.

The rules every question MUST pass:
1. Would someone go "ugh that's literally me" when they see their answer?
2. Does it tell you something you couldn't get from a streaming account?
3. Would a brand pay to know the answer at scale?

Question format: short, punchy, binary or two-sided. No neutral middle option.
Always frame as two opposing types/behaviors — never "it depends" answers.

Categories and their purpose:
- consumption_style: How they actually watch (valuable to streamers)
- discovery_behavior: How they find new content (your data moat)
- taste_identity: Their self-perception of taste (great for social sharing)
- commitment_style: How they commit to / drop content (behavioral gold)
- social_behavior: Word-of-mouth and social patterns (brand value)
- genre_tv_film: TV & Film genre identity
- genre_books: Book genre and format identity
- genre_music: Music consumption identity
- genre_podcasts: Podcast behavior
- genre_gaming: Gaming identity
- media_identity: Who they are across ALL media
- media_crossover: Cross-media behavior (the real data moat)

Example questions:
- "Binge it all or make it last?" A: "All at once, no question" B: "I drag it out on purpose"
- "Trust reviews or trust your own gut?" A: "Reviews help me decide" B: "I go in blind"
- "Critically acclaimed or widely loved?" A: "Critically acclaimed" B: "Widely loved"
- "Read the book AND watch the show — or pick one?" A: "Both every time" B: "Always pick one"

Keep option A and option B short (2-8 words max). Questions should be 5-15 words max.
Return ONLY a valid JSON object — no prose, no markdown.
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // All operations on this function are admin-only
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));

    // ── Admin CRUD actions (create / update / delete) ──
    const action: string | undefined = body.action;
    const badRequest = (msg: string) =>
      new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Field validators shared by create + update. Return a cleaned value or throw a string error.
    const DISPLAY_TYPES = ['feed', 'featured', 'both'];
    const cleanText = (v: unknown, field: string, required: boolean, max = 500): string | null => {
      if (v === null || v === undefined || v === '') {
        if (required) throw `${field} is required`;
        return null;
      }
      if (typeof v !== 'string') throw `${field} must be a string`;
      const t = v.trim();
      if (!t) { if (required) throw `${field} cannot be blank`; return null; }
      if (t.length > max) throw `${field} is too long (max ${max} chars)`;
      return t;
    };
    const validators: Record<string, (v: unknown) => unknown> = {
      question_text: (v) => cleanText(v, 'question_text', true),
      option_a: (v) => cleanText(v, 'option_a', true, 120),
      option_b: (v) => cleanText(v, 'option_b', true, 120),
      option_c: (v) => cleanText(v, 'option_c', false, 120),
      option_d: (v) => cleanText(v, 'option_d', false, 120),
      option_e: (v) => cleanText(v, 'option_e', false, 120),
      is_multi_select: (v) => { if (typeof v !== 'boolean') throw 'is_multi_select must be true or false'; return v; },
      is_active: (v) => { if (typeof v !== 'boolean') throw 'is_active must be true or false'; return v; },
      category: (v) => { if (typeof v !== 'string' || !ALL_CATEGORIES.includes(v)) throw `category must be one of: ${ALL_CATEGORIES.join(', ')}`; return v; },
      display_type: (v) => { if (typeof v !== 'string' || !DISPLAY_TYPES.includes(v)) throw `display_type must be one of: ${DISPLAY_TYPES.join(', ')}`; return v; },
      display_date: (v) => {
        if (v === null) return null;
        if (typeof v !== 'string' || isNaN(Date.parse(v))) throw 'display_date must be a valid ISO date or null';
        return new Date(v).toISOString();
      },
    };

    if (action === 'create') {
      const q = body.question || {};
      const row: Record<string, unknown> = {};
      try {
        row.question_text = validators.question_text(q.question_text);
        row.option_a = validators.option_a(q.option_a);
        row.option_b = validators.option_b(q.option_b);
        row.option_c = validators.option_c(q.option_c ?? null);
        row.option_d = validators.option_d(q.option_d ?? null);
        row.option_e = validators.option_e(q.option_e ?? null);
        row.is_multi_select = validators.is_multi_select(q.is_multi_select ?? false);
        row.is_active = validators.is_active(q.is_active ?? false);
        row.category = validators.category(q.category ?? 'consumption_style');
        row.display_type = validators.display_type(q.display_type ?? 'feed');
      } catch (msg) {
        return badRequest(String(msg));
      }
      const { data: created, error: createError } = await supabaseAdmin
        .from('dna_moments')
        .insert(row)
        .select()
        .single();
      if (createError) throw createError;
      return new Response(JSON.stringify({ success: true, question: created }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (action === 'update') {
      const updates: Record<string, unknown> = {};
      try {
        for (const [key, validate] of Object.entries(validators)) {
          if (key in (body.updates || {})) updates[key] = validate(body.updates[key]);
        }
      } catch (msg) {
        return badRequest(String(msg));
      }
      if (!body.id || typeof body.id !== 'string' || Object.keys(updates).length === 0) {
        return badRequest('id and at least one valid update field are required');
      }
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('dna_moments')
        .update(updates)
        .eq('id', body.id)
        .select()
        .single();
      if (updateError) throw updateError;
      return new Response(JSON.stringify({ success: true, question: updated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (action === 'delete') {
      if (!body.id) {
        return new Response(JSON.stringify({ error: 'id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { error: deleteError } = await supabaseAdmin.from('dna_moments').delete().eq('id', body.id);
      if (deleteError) throw deleteError;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Default: AI generation ──
    const count: number = Math.min(Math.max(parseInt(body.count || '5'), 1), 10);
    const displayType: string = body.display_type || 'feed';
    // If a specific category was passed (legacy / future), use it; otherwise auto-balance
    const specificCategory: string | null = body.category && body.category !== 'mixed' ? body.category : null;

    // Fetch existing questions to avoid duplicates
    const { data: existing } = await supabaseAdmin
      .from('dna_moments')
      .select('question_text, category')
      .limit(300);
    const existingTexts = (existing || []).map((e: any) => e.question_text.toLowerCase());

    // Count how many questions exist per category so we can tell the AI what's underrepresented
    const categoryCounts: Record<string, number> = {};
    (existing || []).forEach((e: any) => {
      categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
    });
    const sortedCategories = [...ALL_CATEGORIES].sort((a, b) => (categoryCounts[a] || 0) - (categoryCounts[b] || 0));

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

    const existingSample = existingTexts.slice(0, 40).join('\n');

    let prompt: string;

    if (specificCategory) {
      // Single-category mode (legacy support)
      const categoryLabel = CATEGORY_LABELS[specificCategory] || specificCategory;
      prompt = `Generate ${count} NEW Entertainment DNA questions for the category: "${categoryLabel}" (category key: "${specificCategory}").

EXISTING questions to avoid repeating:
${existingSample || '(none yet)'}

Return a JSON object: { "questions": [ { "question_text": "...", "option_a": "...", "option_b": "...", "category": "${specificCategory}" }, ... ] }

Rules:
- Each question must be genuinely different from existing ones
- Both options should feel like a real "that's me" answer for different people
- No "it depends" or neutral options
- Keep questions and answers SHORT and punchy`;
    } else {
      // Auto-balanced mode — spread across underrepresented categories
      const targetCategories = sortedCategories.slice(0, Math.min(count, ALL_CATEGORIES.length));
      const categoryBreakdown = targetCategories
        .map(c => `- ${CATEGORY_LABELS[c]} (key: "${c}", existing: ${categoryCounts[c] || 0})`)
        .join('\n');

      prompt = `Generate exactly ${count} NEW Entertainment DNA questions spread across these categories (prioritised by which have fewest questions):

${categoryBreakdown}

Assign at least 1 question to each category listed above. Spread evenly.

EXISTING questions to avoid repeating:
${existingSample || '(none yet)'}

Return a JSON object: { "questions": [ { "question_text": "...", "option_a": "...", "option_b": "...", "category": "<category_key>" }, ... ] }

Rules:
- Each question must be genuinely different from existing ones
- Both options should feel like a real "that's me" answer for different people  
- No "it depends" or neutral options
- Keep questions and answers SHORT and punchy
- The "category" field must be one of the exact category keys listed above`;
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature: 0.85,
        response_format: { type: 'json_object' }
      })
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const openaiData = await openaiRes.json();
    const rawContent = openaiData.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    const questions: any[] = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.data || Object.values(parsed)[0] || []);
    if (!questions.length) throw new Error('No questions generated');

    // Filter duplicates and validate categories
    const unique = questions.filter((q: any) =>
      q.question_text &&
      !existingTexts.includes(q.question_text.toLowerCase()) &&
      (specificCategory ? q.category === specificCategory : ALL_CATEGORIES.includes(q.category))
    );

    // Generated questions go in as drafts (is_active: false) so admin can review before publishing
    const toInsert = unique.map((q: any) => ({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      category: q.category || (specificCategory ?? 'consumption_style'),
      is_active: false,
      display_type: displayType,
    }));

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('dna_moments')
      .insert(toInsert)
      .select();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, generated: inserted?.length || 0, questions: inserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('generate-dna-moments error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
