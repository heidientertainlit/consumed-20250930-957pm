import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();

    // --- Suggest topics action: AI generates pool topic ideas ---
    if (body.action === 'suggest_topics') {
      const { categoryFilter = '' } = body;

      // Fetch existing pool show_tags to avoid suggesting duplicates
      const { data: existingPools } = await supabaseAdmin
        .from('challenge_pools')
        .select('show_tag, title');
      const existingTitles = (existingPools || []).map((p: any) => p.title).join(', ');
      const avoidClause = existingTitles
        ? `Do NOT suggest any of these — they already exist as pools: ${existingTitles}.`
        : '';

      const categoryClause = categoryFilter && categoryFilter !== 'all'
        ? `Only suggest topics in the category: ${categoryFilter}.`
        : 'Mix categories: TV Shows, Movies, Music, Books, Pop Culture.';

      const prompt = `You are a trivia expert creating pool topics for Consumed, an entertainment fan platform. Generate 8 popular trivia pool ideas — shows, movies, book series, musicians, or pop culture franchises that have a dedicated, passionate fanbase and enough depth to support 36 trivia questions.

${categoryClause}
${avoidClause}

For each suggestion, provide:
- title: The exact name (e.g. "Breaking Bad", "Taylor Swift", "The Hunger Games")
- category: one of "TV Shows", "Movies", "Music", "Books", "Pop Culture"
- description: A punchy 1-sentence tagline for the pool (e.g. "How well do you know the meth empire?")
- topic_context: A 1-2 sentence brief for the AI question generator (key seasons/albums/characters/lore to cover)
- emoji: A single relevant emoji

Return ONLY a valid JSON array of 8 objects with these exact keys. No markdown, no explanation.`;

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 2000,
          temperature: 0.9,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!openaiResponse.ok) {
        const errText = await openaiResponse.text();
        return new Response(JSON.stringify({ error: `OpenAI error: ${errText}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const openaiData = await openaiResponse.json();
      const rawText = openaiData.choices?.[0]?.message?.content || '';
      let suggestions: any[] = [];
      try {
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to parse suggestions', raw: rawText.slice(0, 300) }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, suggestions }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Save action: persist pool + questions to DB ---
    if (body.action === 'save') {
      const { pool, questions } = body;
      if (!pool || !questions) {
        return new Response(JSON.stringify({ error: 'Missing pool or questions' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: poolRow, error: poolError } = await supabaseAdmin
        .from('challenge_pools')
        .insert({
          show_tag: pool.show_tag,
          title: pool.title,
          description: pool.description,
          category: pool.category,
          poster_url: pool.poster_url || null,
          fallback_emoji: pool.fallback_emoji || '🎮',
          accent_color: pool.accent_color || '#7c3aed',
          is_active: true,
        })
        .select('id')
        .single();

      if (poolError) {
        return new Response(JSON.stringify({ error: poolError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const poolId = poolRow.id;
      const questionRows = [];
      for (const diff of ['easy', 'medium', 'hard']) {
        const qs = questions[diff] || [];
        qs.forEach((q: any, i: number) => {
          questionRows.push({
            pool_id: poolId,
            difficulty: diff,
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            sort_order: i,
          });
        });
      }

      const { error: qError } = await supabaseAdmin.from('challenge_questions').insert(questionRows);
      if (qError) {
        await supabaseAdmin.from('challenge_pools').delete().eq('id', poolId);
        return new Response(JSON.stringify({ error: qError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, pool_id: poolId }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Append questions to existing pool ---
    if (body.action === 'append_questions') {
      const { pool_id, questions } = body;
      if (!pool_id || !questions) {
        return new Response(JSON.stringify({ error: 'Missing pool_id or questions' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get current max sort_order per difficulty so we append after existing
      const { data: existing } = await supabaseAdmin
        .from('challenge_questions')
        .select('difficulty, sort_order')
        .eq('pool_id', pool_id);

      const maxOrder: Record<string, number> = { easy: -1, medium: -1, hard: -1 };
      for (const row of existing || []) {
        if (row.difficulty in maxOrder && row.sort_order > maxOrder[row.difficulty]) {
          maxOrder[row.difficulty] = row.sort_order;
        }
      }

      const questionRows = [];
      for (const diff of ['easy', 'medium', 'hard']) {
        const qs = questions[diff] || [];
        qs.forEach((q: any, i: number) => {
          questionRows.push({
            pool_id,
            difficulty: diff,
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            sort_order: maxOrder[diff] + 1 + i,
          });
        });
      }

      const { error: qError } = await supabaseAdmin.from('challenge_questions').insert(questionRows);
      if (qError) {
        return new Response(JSON.stringify({ error: qError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, added: questionRows.length }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Delete action ---
    if (body.action === 'delete') {
      const { pool_id } = body;
      if (!pool_id) {
        return new Response(JSON.stringify({ error: 'Missing pool_id' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { error } = await supabaseAdmin.from('challenge_pools').delete().eq('id', pool_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Generate action: AI generates 36 questions ---
    const { poolName, topic, category = 'TV Shows' } = body;
    if (!poolName || !topic) {
      return new Response(JSON.stringify({ error: 'Missing poolName or topic' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `You are an expert trivia writer for Consumed, an entertainment fan platform. You create structured trivia question sets for specific shows, movies, book series, or music artists. Questions must be accurate, engaging, and well-calibrated by difficulty.`;

    const userPrompt = `Create a complete trivia challenge for: "${poolName}"

Topic context: ${topic}
Category: ${category}

Generate exactly 36 questions — 12 easy, 12 medium, 12 hard.

DIFFICULTY CALIBRATION:
- Easy (12): Mainstream knowledge any casual fan would know. Main characters, basic plot points, iconic quotes, famous scenes.
- Medium (12): For engaged fans. Supporting characters, specific episode/movie details, behind-the-scenes facts, specific years.
- Hard (12): Deep fandom knowledge. Minor details, production trivia, obscure references, specific numbers/dates, rarely-known facts.

QUESTION RULES:
- Each question has exactly 4 options
- Exactly 1 correct answer per question
- Wrong answers must be plausible (not obviously wrong)
- Question text should be a complete, clear sentence or question
- No trick questions — the correct answer should be unambiguous

Return ONLY valid JSON in this exact structure:
{
  "easy": [
    { "question_text": "...", "options": ["Option A", "Option B", "Option C", "Option D"], "correct_answer": "Option A" },
    ...12 items
  ],
  "medium": [...12 items],
  "hard": [...12 items]
}

No markdown, no code blocks, no explanation. Just the JSON object.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 6000,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      return new Response(JSON.stringify({ error: `OpenAI error: ${errText}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const openaiData = await openaiResponse.json();
    const rawText = openaiData.choices?.[0]?.message?.content || '';

    let questions: any = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      questions = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (parseErr) {
      return new Response(JSON.stringify({ error: `JSON parse error: ${parseErr}`, raw: rawText.slice(0, 500) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const easyCount = (questions.easy || []).length;
    const mediumCount = (questions.medium || []).length;
    const hardCount = (questions.hard || []).length;

    return new Response(JSON.stringify({
      success: true,
      questions,
      counts: { easy: easyCount, medium: mediumCount, hard: hardCount },
      total: easyCount + mediumCount + hardCount,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
