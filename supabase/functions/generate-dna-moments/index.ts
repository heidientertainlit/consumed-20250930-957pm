import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const CATEGORY_SYSTEM = `
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
Return ONLY a valid JSON array — no prose, no markdown.
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

    const body = await req.json().catch(() => ({}));
    const category: string = body.category || 'consumption_style';
    const count: number = Math.min(Math.max(parseInt(body.count || '5'), 1), 10);
    const displayType: string = body.display_type || 'feed';

    // Fetch existing questions to avoid duplicates
    const { data: existing } = await supabaseAdmin
      .from('dna_moments')
      .select('question_text')
      .limit(200);
    const existingTexts = (existing || []).map((e: any) => e.question_text.toLowerCase());

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

    const categoryLabel = category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const existingSample = existingTexts.slice(0, 30).join('\n');

    const prompt = `Generate ${count} NEW Entertainment DNA questions for the category: "${categoryLabel}".

EXISTING questions to avoid repeating (do not duplicate these or anything similar):
${existingSample || '(none yet)'}

Return a JSON array of exactly ${count} objects with this structure:
[
  {
    "question_text": "Short punchy question?",
    "option_a": "First answer type",
    "option_b": "Second answer type",
    "category": "${category}"
  }
]

Rules:
- Each question must be genuinely different from existing ones
- Both options should feel like a real "that's me" answer for different people
- No "it depends" or neutral options
- Keep questions and answers SHORT and punchy
- The question should reveal something about behavior, not just preference
`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: CATEGORY_SYSTEM },
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

    // Support both array and {questions: [...]} format from json_object mode
    const questions: any[] = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.data || Object.values(parsed)[0] || []);

    if (!questions.length) throw new Error('No questions generated');

    // Filter out any that match existing questions
    const unique = questions.filter((q: any) =>
      q.question_text && !existingTexts.includes(q.question_text.toLowerCase())
    );

    // Insert into dna_moments
    const toInsert = unique.map((q: any) => ({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      category: q.category || category,
      is_active: true,
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
