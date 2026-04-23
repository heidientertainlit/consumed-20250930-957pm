import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    // --- Publish action: insert pool + mark draft published (uses service role, bypasses RLS) ---
    if (body.action === 'publish') {
      const { poolData, draftId } = body;
      if (!poolData || !draftId) {
        return new Response(JSON.stringify({ error: 'Missing poolData or draftId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { error: insertError } = await supabaseAdmin
        .from('prediction_pools')
        .insert(poolData);

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message, details: insertError.details }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from('trivia_poll_drafts')
        .update({ status: 'published', published_at: new Date().toISOString(), published_pool_id: poolData.id })
        .eq('id', draftId);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Reschedule featured plays — bulk update featured_date using service role ---
    if (body.action === 'reschedule_featured') {
      const { updates } = body; // Array of { id: string, featured_date: string }
      if (!Array.isArray(updates) || updates.length === 0) {
        return new Response(JSON.stringify({ error: 'Missing updates array' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      let succeeded = 0;
      let failed = 0;
      for (const { id, featured_date } of updates) {
        const { error } = await supabaseAdmin
          .from('prediction_pools')
          .update({ featured_date })
          .eq('id', id);
        if (error) failed++; else succeeded++;
      }
      return new Response(JSON.stringify({ succeeded, failed }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- DNA publish action: insert into dna_moments + mark draft published ---
    if (body.action === 'publish_dna') {
      const { dnaData, draftId } = body;
      if (!dnaData || !draftId) {
        return new Response(JSON.stringify({ error: 'Missing dnaData or draftId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { error: insertError } = await supabaseAdmin
        .from('dna_moments')
        .insert(dnaData);

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await supabaseAdmin
        .from('trivia_poll_drafts')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', draftId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const {
      contentType = 'mixed',
      count = 10,
      mediaType = 'mixed',
      focusTopic = '',
      partnerTag = '',
      difficulty = 'medium',
      useTrending = false,
    } = body;

    // ── 1. Fetch existing titles for dedup (prediction_pools + approved drafts) ──
    const [existingPoolsRes, existingDraftsRes] = await Promise.all([
      supabaseAdmin
        .from('prediction_pools')
        .select('title')
        .in('type', ['trivia', 'vote', 'predict'])
        .order('created_at', { ascending: false })
        .limit(300),
      supabaseAdmin
        .from('trivia_poll_drafts')
        .select('title')
        .in('status', ['approved', 'published', 'pending'])
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    const existingTitles = new Set<string>();
    const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

    for (const row of (existingPoolsRes.data || [])) {
      if (row.title) existingTitles.add(normalizeTitle(row.title));
    }
    for (const row of (existingDraftsRes.data || [])) {
      if (row.title) existingTitles.add(normalizeTitle(row.title));
    }

    const dedupBlock = existingTitles.size > 0
      ? `\n\nDO NOT REPEAT — these questions already exist in our database (do not generate anything similar):\n` +
        Array.from(existingTitles).slice(0, 150).map((t, i) => `${i + 1}. ${t}`).join('\n')
      : '';

    // ── 2. Fetch recent rejections ──
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

    // ── 3. Fetch trending titles if requested ──
    // Sources: TMDB (TV + Movies, free tier), Open Library (Books, free), Google Books (Books, free key)
    let trendingBlock = '';
    if (useTrending) {
      try {
        const tmdbKey = Deno.env.get('TMDB_API_KEY') || '';
        const googleBooksKey = Deno.env.get('GOOGLE_BOOKS_API_KEY') || '';
        const trendingTitles: string[] = [];

        // TMDB: trending TV shows and movies this week (free, no FlixPatrol needed)
        if (tmdbKey) {
          try {
            const [tvRes, movieRes] = await Promise.all([
              fetch(`https://api.themoviedb.org/3/trending/tv/week?api_key=${tmdbKey}`),
              fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${tmdbKey}`),
            ]);
            if (tvRes.ok) {
              const d = await tvRes.json();
              (d.results || []).slice(0, 10).forEach((s: any, i: number) => {
                if (s.name) trendingTitles.push(`${s.name} (Trending TV #${i + 1})`);
              });
            }
            if (movieRes.ok) {
              const d = await movieRes.json();
              (d.results || []).slice(0, 8).forEach((m: any, i: number) => {
                if (m.title) trendingTitles.push(`${m.title} (Trending Movie #${i + 1})`);
              });
            }
          } catch (_) {}
        }

        // Open Library: trending books this week (completely free, no key)
        try {
          const olRes = await fetch('https://openlibrary.org/trending/weekly.json?limit=10', {
            headers: { 'User-Agent': 'Consumed-App/1.0' },
          });
          if (olRes.ok) {
            const d = await olRes.json();
            ((d.works || []) as any[]).slice(0, 8).forEach((w: any, i: number) => {
              if (w.title) trendingTitles.push(`${w.title} (Trending Book #${i + 1})`);
            });
          }
        } catch (_) {}

        // Google Books: popular / recently published (free key)
        if (googleBooksKey) {
          try {
            const gbRes = await fetch(
              `https://www.googleapis.com/books/v1/volumes?q=subject:fiction&orderBy=newest&maxResults=8&key=${googleBooksKey}`
            );
            if (gbRes.ok) {
              const d = await gbRes.json();
              ((d.items || []) as any[]).slice(0, 6).forEach((item: any) => {
                const title = item.volumeInfo?.title;
                if (title) trendingTitles.push(`${title} (New Book)`);
              });
            }
          } catch (_) {}
        }

        if (trendingTitles.length > 0) {
          trendingBlock = `\n\nTRENDING RIGHT NOW — base your questions heavily on these titles (at least 70% of your content should be about one of these):\n` +
            trendingTitles.map((t, i) => `${i + 1}. ${t}`).join('\n');
        }
      } catch (_) {
        // Trending fetch is best-effort — don't block generation if it fails
      }
    }

    const mediaFocus = focusTopic
      ? `Focus heavily on: "${focusTopic}"`
      : useTrending
        ? 'Focus on the trending titles listed above.'
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

      featured_play: `Generate FEATURED PLAY content — the main daily call. These should look and feel like predictions but are actually opinion polls. They are speculative, trendy, culturally urgent questions about what's happening RIGHT NOW in entertainment. No correct answers — users vote based on gut, opinion, and vibes.

TONE & FORMAT:
- Frame everything as "Will X happen?", "Do you think Y?", "Is Z actually coming back?", "Who do you think will win?", "Do you believe them?"
- These should feel like hot takes and tea — the stuff fans are actually arguing about on social right now
- Reference real recent events, casting rumors, cancellations, feuds, renewals, award shows, reality TV drama
- 2 options ONLY for Yes/No format ("Yes" / "No", "I believe it" / "No way", "Team A" / "Team B")
- OR 3-4 options when there are multiple outcomes worth debating

EXAMPLE QUESTIONS (use as inspiration, not templates to copy):
- "Will Taylor Frankie Paul's season of The Bachelorette ever actually air?"
- "Do you think Beyoncé will ever drop a surprise album again?"
- "Is The Bear getting renewed for Season 4?"
- "Will Jennifer Aniston and Brad Pitt ever work together again?"
- "Do you believe Blake Lively's side of the story?"
- "Will Succession ever get a spin-off?"
- "Is Emily in Paris worth renewing for another season?"
- "Will the Eras Tour movie win an Oscar eventually?"
- "Who wins the Billboard beef — Drake or Kendrick?"
- "Is the MCU actually getting better or just pretending to?"

RULES:
- correct_answer must always be null (these are opinion polls, never trivia)
- All options short and punchy (under 6 words each)
- Must feel culturally relevant TODAY, not generic evergreen content
- Avoid anything that requires insider knowledge — these are vibe-based
- Set content_type: "featured_play" for all of them`,

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
- Accurate (real titles, real actors, real years)${rejectionBlock}${dedupBlock}${trendingBlock}`;

    const userPrompt = `Generate exactly ${count} pieces of entertainment content.

CONTENT TYPE: ${typeInstructions[contentType] || typeInstructions.mixed}

MEDIA FOCUS: ${mediaFocus}
${difficulty !== 'medium' ? `DIFFICULTY BIAS: ${difficulty === 'easy' ? 'Lean toward mainstream, widely-known content' : 'Include deeper cuts and fandom knowledge'}` : ''}

CATEGORY ACCURACY RULES — these are strict, not suggestions:
- category "Books" = ONLY actual written books (novels, memoirs, nonfiction). Songs, lyrics, movies, TV shows, and Disney rides are NEVER "Books".
- category "Music" = songs, albums, artists, lyrics, bands. "Finish the lyric" questions MUST use category "Music", not "Books".
- category "TV" = television series only. Not movies, not songs.
- category "Movies" = theatrical or streaming films only. Not TV shows.
- "It's a Small World" is a Disney RIDE SONG — category: "Music", media_type: "music". NOT a book.
- If a "finish the lyric/line" question is about a song or theme song, it MUST be Music. If it's about dialogue from a movie, category is Movies. If it's about dialogue from a show, category is TV.
- Never ask "From which book?" when the lyric/quote is from a song or movie.

ANSWER POSITION RULE (trivia only): The correct answer must NOT always be the first option. Deliberately randomize which position (A/B/C/D) holds the correct answer across questions. Aim for an even spread — roughly equal numbers of questions where the correct answer is 1st, 2nd, 3rd, or 4th in the options array. Never put the correct answer in the same position for consecutive questions.

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

    // ── Shuffle trivia options server-side so correct answer is never always first ──
    for (const item of items) {
      if (item.correct_answer && Array.isArray(item.options) && item.options.length > 1) {
        // Fisher-Yates shuffle
        const opts = [...item.options];
        for (let i = opts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [opts[i], opts[j]] = [opts[j], opts[i]];
        }
        item.options = opts;
      }
    }

    // ── Post-generation dedup: drop any item whose title too closely matches an existing one ──
    const dedupedItems = items.filter((item: any) => {
      if (!item.title) return false;
      const norm = normalizeTitle(item.title);
      if (existingTitles.has(norm)) return false;
      // also check generated batch for within-batch duplication
      existingTitles.add(norm);
      return true;
    });

    const dedupDropped = items.length - dedupedItems.length;

    // --- Full QC pass: verify correct answers AND category/wording accuracy for all items ---
    try {
      const qcPrompt = `You are a strict fact-checker and content QC reviewer for an entertainment trivia platform.

For each item below, check ALL of the following and return corrections:

1. TRIVIA CORRECT ANSWER: Is the correct_answer actually correct? If wrong, replace with the real answer (must exactly match one of the options).
2. CATEGORY ACCURACY: Does the category match what the content actually is?
   - "Books" = ONLY actual written books (novels, memoirs, nonfiction). Songs, lyrics, Disney rides, movies, TV shows are NEVER "Books".
   - "Music" = songs, albums, artists, lyrics. "Finish the lyric" questions about songs MUST be "Music".
   - "TV" = TV series only. "Movies" = films only.
   - Fix the category if it's wrong.
3. MEDIA TYPE ACCURACY: Does media_type match? (song/lyric → "music", book → "book", TV show → "tv", film → "movie")
4. QUESTION WORDING: Does the question wording match the category? If a question says "From which book?" but it's about a song, fix the wording to match (e.g., "From which song?"). If a question is incoherent or factually absurd, set flag: true.

Return ONLY a JSON array. One object per item (use the same idx). Only include fields that need changing — omit unchanged fields.

Fields you may return per object:
- idx: number (required)
- correct_answer: string (trivia only — only include if corrected)
- category: string (only include if corrected)
- media_type: string (only include if corrected)  
- title: string (only include if question wording needed fixing)
- flag: boolean (true if the item has an unfixable factual problem — leave for human review)

Items to QC:
${dedupedItems.map((q: any, i: number) => {
  const parts = [`${i}. [${q.content_type}] Category: "${q.category}" | media_type: "${q.media_type}" | "${q.title}"`];
  if (q.options?.length) parts.push(`   Options: [${q.options.join(', ')}]`);
  if (q.correct_answer) parts.push(`   Claimed answer: "${q.correct_answer}"`);
  return parts.join('\n');
}).join('\n\n')}`;

      const qcResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 2048,
          temperature: 0,
          messages: [{ role: 'user', content: qcPrompt }],
        }),
      });

      if (qcResponse.ok) {
        const qcData = await qcResponse.json();
        const qcText = qcData.choices?.[0]?.message?.content || '';
        const qcMatch = qcText.match(/\[[\s\S]*\]/);
        if (qcMatch) {
          const fixes: { idx: number; correct_answer?: string; category?: string; media_type?: string; title?: string; flag?: boolean }[] = JSON.parse(qcMatch[0]);
          for (const fix of fixes) {
            const item = dedupedItems[fix.idx];
            if (!item) continue;
            if (fix.correct_answer && item.options?.includes(fix.correct_answer)) {
              item.correct_answer = fix.correct_answer;
            }
            if (fix.category) item.category = fix.category;
            if (fix.media_type) item.media_type = fix.media_type;
            if (fix.title) item.title = fix.title;
            if (fix.flag) {
              // Mark in ai_notes so admin can spot it during review
              item.ai_notes = `⚠️ QC FLAG: Possible factual issue — review before publishing. ${item.ai_notes || ''}`.trim();
            }
          }
        }
      }
    } catch (_qcErr) {
      // QC is best-effort — don't block if it fails
    }

    const drafts: any[] = [];
    const errors: string[] = [];

    for (const item of dedupedItems) {
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
      dedupDropped: dedupDropped > 0 ? dedupDropped : undefined,
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
