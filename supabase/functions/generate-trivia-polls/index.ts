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

    const {
      contentType = 'mixed',
      count = 10,
      mediaType = 'mixed',
      focusTopic = '',
      partnerTag = '',
      difficulty = 'medium',
    } = await req.json();

    // Fetch recent rejections to teach GPT what to avoid
    const { data: recentRejections } = await supabaseAdmin
      .from('trivia_poll_drafts')
      .select('title, rejection_reason, content_type')
      .eq('status', 'rejected')
      .not('rejection_reason', 'is', null)
      .order('created_at', { ascending: false })
      .limit(8);

    const rejectionBlock = recentRejections && recentRejections.length > 0
      ? `\n\nRECENT REJECTIONS — learn from these and do NOT repeat:\n` +
        recentRejections.map((r: any, i: number) =>
          `${i + 1}. [${r.content_type}] "${r.title}" — Reason: ${r.rejection_reason}`
        ).join('\n')
      : '';

    const mediaFocus = focusTopic
      ? `Focus heavily on: "${focusTopic}"`
      : mediaType === 'mixed'
        ? 'Use this media mix: 40% TV, 30% Movies, 20% Books, 10% Music/other'
        : `Focus on: ${mediaType} content`;

    const typeInstructions: Record<string, string> = {
      trivia: `Generate TRIVIA questions only. Use these high-engagement templates:
- "What year did X premiere/release?"
- "Who played [character] in [show/movie]?"
- "Who created/wrote/directed [title]?"
- "Who won [award] in [year]?"
- "Which movie/show is this quote from?"
- "Finish the lyric/line: [partial quote]"
- "Which of these released first?"
- "What is the real name of [character/alias]?"
Each must have exactly 4 options with one correct answer. Vary difficulty from easy pop culture to deeper fandom.`,

      poll: `Generate POLL questions only — opinion-based, no correct answer. Use these addictive templates:
- "Which one are you picking right now?" (pick between 2 shows/movies)
- "This says a lot about you… Your comfort show is:"
- "Hot take — be honest:" (provocative opinion)
- "Everyone has one — which camp are you in?"
- "Which one hurts more?" (emotional pull)
- "Who's actually the best?" (controversial ranking)
- "Best era of [genre/franchise]?"
- "You either get it or you don't — this show is:"
Make them feel personal, slightly dramatic, shareable. 2-4 options.`,

      featured_play: `Generate FEATURED PLAY content — the main daily event. Mix of:
- Light predictions (no resolution needed): "Does this go viral?", "Will [show] get renewed?"
- Big cultural polls: "Everyone's watching this right now:"
- "Pick your side" moments: "You're either Team X or Team Y"
- "Call it" takes: "This show will be remembered as:"
- Cultural moment reactions: "This is the show of the summer:"
These do NOT need a correct answer. They should feel like the biggest conversation of the day. 2-4 options.`,

      dna_moment: `Generate DNA MOMENT questions — casual, conversational, binary identity questions that reveal how someone really consumes entertainment. These should feel like something you'd see in a fun quiz, NOT a formal survey.

VOICE RULES for DNA moments:
- BAD: "Do you prefer reading books or watching movies?" (formal, clinical)
- GOOD: "What do you consume more — books or movies?" (casual, direct)
- BAD: "Are you someone who finishes shows even if you don't enjoy them?"
- GOOD: "Do you finish shows you're not feeling?"
- BAD: "Do you prefer to watch television with others or alone?"
- GOOD: "Solo watching or watch parties — which are you?"

CATEGORIES to cover (vary across the batch):
- Consumption habits: "Binge all at once or slow burn it?" / "Do you read reviews before or after?"
- Taste identity: "Subtitles on or off?" / "Do you trust your own taste?"
- Social habits: "Do you need someone to watch with?" / "Do you talk during movies?"
- Content loyalty: "Do you finish shows you're not feeling?" / "Do you rewatch your favorites?"
- Format preferences: "Audio book or physical?" / "Cinema or streaming?"

Each must have exactly 2 options — short, punchy (e.g., "All at once" / "One episode at a time"). Make them feel addictive and slightly exposing.`,

      mixed: `Generate a MIXED batch of TRIVIA and POLLS only (no featured plays, no DNA moments — those are generated separately).
Aim for: 55% trivia, 45% polls.
Trivia: exactly 4 options, 1 correct answer. Use fun templates (who played, what year, finish the line, which came first, etc.)
Polls: 2-4 options, no correct answer. Emotional, identity-driven, debate-worthy. Personal and slightly dramatic.`,
    };

    const systemPrompt = `You are a world-class entertainment content creator for Consumed, a social platform where fans actively engage with movies, TV, books, and music. You generate content that drives daily participation, feels culturally relevant, and is instantly shareable.

Your content must be:
- Immediately recognizable (mainstream + cult favorites)
- Fast to answer (no research needed for most users)
- Emotionally engaging (identity, nostalgia, debate)
- Accurate (real titles, real actors, real years)${rejectionBlock}`;

    const userPrompt = `Generate exactly ${count} pieces of entertainment content.

CONTENT TYPE: ${typeInstructions[contentType] || typeInstructions.mixed}

MEDIA FOCUS: ${mediaFocus}
${difficulty !== 'medium' ? `DIFFICULTY BIAS: ${difficulty === 'easy' ? 'Lean toward mainstream, widely-known content' : 'Include deeper cuts and fandom knowledge'}` : ''}

Return ONLY a valid JSON array. Each item must have these exact fields:
- content_type: "trivia" | "poll" | "featured_play" | "dna_moment"
- title: the question text (compelling, concise)
- options: array of strings (answer choices — 4 for trivia, 2-4 for polls/featured, exactly 2 for dna_moment)
- correct_answer: string (trivia only — must exactly match one option) or null
- category: "TV" | "Movies" | "Books" | "Music" | "Pop Culture"
- show_tag: specific show/franchise name if applicable (e.g. "Stranger Things", "Taylor Swift") or null
- media_type: "tv" | "movie" | "book" | "music" | null
- difficulty: "easy" | "medium" | "chaotic"
- template_type: short label like "who_played", "what_year", "finish_the_line", "pick_side", "comfort_show", "dna_habit", etc.
- rotation_type: "evergreen" | "trending" | "seasonal"
- ai_notes: one sentence explaining why this will drive high engagement

Return ONLY the JSON array. No markdown, no explanation, no code blocks.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 4096,
        temperature: 0.85,
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

    let items: any[] = [];
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      items = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (parseErr) {
      return new Response(JSON.stringify({ error: `JSON parse error: ${parseErr}`, raw: rawText.slice(0, 500) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: 'GPT returned 0 items', raw: rawText.slice(0, 500) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const drafts: any[] = [];
    const errors: string[] = [];

    for (const item of items) {
      const draft = {
        content_type: item.content_type || contentType,
        title: item.title || '',
        options: item.options || [],
        correct_answer: item.correct_answer || null,
        category: item.category || 'Pop Culture',
        show_tag: item.show_tag || null,
        media_type: item.media_type || null,
        difficulty: item.difficulty || difficulty,
        points_reward: item.content_type === 'trivia' ? 10 : item.content_type === 'featured_play' ? 20 : item.content_type === 'dna_moment' ? 5 : 2,
        partner_tag: partnerTag || null,
        template_type: item.template_type || null,
        rotation_type: item.rotation_type || 'evergreen',
        ai_notes: item.ai_notes || null,
        status: 'draft',
      };

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('trivia_poll_drafts')
        .insert(draft)
        .select('id')
        .single();

      if (insertError) {
        errors.push(`Insert error: ${insertError.message}`);
      } else {
        drafts.push({ ...draft, id: inserted.id });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      generated: drafts.length,
      drafts,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', detail: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
