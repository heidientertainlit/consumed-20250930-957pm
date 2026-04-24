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

      // Guard: trivia MUST have a show_tag — if it's missing the question has no context
      if (poolData.type === 'trivia' && !poolData.show_tag) {
        return new Response(JSON.stringify({
          error: 'Cannot publish trivia without a show_tag. Every trivia question must be tied to a specific show, movie, album, or franchise.',
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Always ensure media_tags is populated — fall back to [show_tag] if not set
      if (!poolData.media_tags && poolData.show_tag) {
        poolData.media_tags = [poolData.show_tag];
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
        Array.from(existingTitles).slice(0, 250).map((t, i) => `${i + 1}. ${t}`).join('\n')
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
- "What was the working title / original name of [title]?"
- "Which actor was originally cast as [character] before [actor] took the role?"
- "What is the name of [character]'s hometown / ship / company / band?"
- "In [movie], what does [character] order at the diner / write on the note / say as their last line?"
- "Which of these sequels came THIRD in the series?"
- "Who composed the score for [movie]?"
- "What year did [director] win their first Oscar?"
Each must have exactly 4 options with one correct answer.

DIFFICULTY RULES — enforce these strictly:
- At least 40% of movie trivia questions must be MEDIUM or CHAOTIC difficulty (specific details, behind-the-scenes facts, character full names, sequel order, casting history, Oscar history, production trivia).
- Easy questions are fine for TV and Pop Culture but Movie trivia should skew harder.
- Avoid asking "Who starred in The Avengers / The Dark Knight / Titanic" type questions — these are over-exposed. If you do use a blockbuster, ask something non-obvious about it (original casting, deleted scene fact, behind-the-scenes detail).

MOVIE DIVERSITY RULES — enforce these strictly:
- Spread across MULTIPLE eras: 1960s–1980s classics, 1990s gems, 2000s cult hits, 2010s blockbusters, 2020s releases. Do NOT cluster in one decade.
- Spread across MULTIPLE genres: horror, sci-fi, drama, romantic comedy, animated, documentary, foreign language, indie, action, thriller.
- Spread across MULTIPLE countries and studios — don't only pull from Marvel/Disney/WB. Include A24, Pixar, Paramount, international films.
- If you generated questions about a specific movie or franchise recently (see DO NOT REPEAT list), skip it entirely and pick a fresh title.
- NEVER generate more than 1 question per movie in a single batch.
- Avoid over-indexing on: Marvel, DC, Star Wars, Harry Potter, Fast & Furious, Avengers, The Dark Knight, Titanic, Jurassic Park — if they appear in the existing list, skip them. If they don't, you may use them ONCE max.`,

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
Polls: 2-4 options, no correct answer. Emotional, identity-driven, debate-worthy. Personal and slightly dramatic.

MOVIE TRIVIA DIVERSITY — apply to all trivia in this batch:
- Spread across eras (1960s–2020s), genres (horror, sci-fi, drama, rom-com, animated, indie, foreign), and studios (A24, Pixar, Blumhouse, international, not just Marvel/Disney/WB).
- At least 40% of movie trivia must be MEDIUM or CHAOTIC difficulty — behind-the-scenes, casting history, production facts, sequel order, character details.
- NEVER generate more than 1 question about the same movie in a single batch.
- If a title appears in the DO NOT REPEAT list, skip it entirely.`,
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
- category "Pop Culture" = viral internet moments, celebrity news & tabloid drama, fashion/brand crazes, cultural crossover events, award show drama, memes — "The Conversation, not The Craft". If the question is about a specific show's plot, it's "TV". If it's about a movie's details, it's "Movies". If it's about who won a pop culture feud or what brand went viral, it's "Pop Culture".
- category "Podcasts" = podcast shows, hosts, episodes, podcast culture ONLY. ANY question about a podcast (Serial, My Favorite Murder, Hidden Brain, Crime Junkie, etc.) MUST use category "Podcasts" and media_type "podcast". NEVER use "TV" for podcasts.
- category "Gaming" = video games, game characters, gaming culture, esports ONLY. ANY question about a video game (Super Mario, Zelda, Call of Duty, etc.) MUST use category "Gaming" and media_type "game". NEVER use "Pop Culture" or "TV" for gaming.
- "It's a Small World" is a Disney RIDE SONG — category: "Music", media_type: "music". NOT a book.
- If a "finish the lyric/line" question is about a song or theme song, it MUST be Music. If it's about dialogue from a movie, category is Movies. If it's about dialogue from a show, category is TV.
- Never ask "From which book?" when the lyric/quote is from a song or movie.

ANSWER POSITION RULE (trivia only): The correct answer must NOT always be the first option. Deliberately randomize which position (A/B/C/D) holds the correct answer across questions. Aim for an even spread — roughly equal numbers of questions where the correct answer is 1st, 2nd, 3rd, or 4th in the options array. Never put the correct answer in the same position for consecutive questions.

Return ONLY a valid JSON array. Each item must have these exact fields:
- content_type: "trivia" | "poll" | "featured_play" | "dna_moment"
- title: the question text (compelling, concise). CRITICAL: whenever the question is about a specific movie, TV show, book, album, artist, or franchise, the title MUST include the name inline for context — e.g. "In The Shawshank Redemption, what item does Andy use to escape?" or "In Breaking Bad, what does Walter White's alias stand for?" or "On Taylor Swift's Folklore, which song samples another artist?". Never write a question that requires knowing the subject without stating it — players need the context to answer.
- options: array of strings (answer choices — 4 for trivia, 2-4 for polls/featured, exactly 2 for dna_moment)
- correct_answer: string (trivia only — must exactly match one option) or null
- category: "TV" | "Movies" | "Books" | "Music" | "Pop Culture" | "Podcasts" | "Gaming"
- show_tag: REQUIRED for trivia — the PRIMARY media item this question is about (e.g. "Stranger Things", "Taylor Swift", "The Dark Knight"). NEVER null for trivia. For polls/dna_moment/featured_play: set if question references a specific title, otherwise null. When a question compares two items, set show_tag to the one the question is more "about" (or the first mentioned).
- media_tags: array of ALL media titles referenced in this question. For single-media questions: ["Stranger Things"]. For comparisons or multi-media questions: ["Breaking Bad", "The Wire"] or ["Taylor Swift", "Beyoncé"]. REQUIRED for trivia — must always contain at least show_tag. For polls that compare two shows/movies/artists, list all of them. Never an empty array.
- media_type: "tv" | "movie" | "book" | "music" | "podcast" | "game" | null
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
        temperature: 0.92,
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

    // ── Deterministic category guardian — runs after AI generation, cannot be hallucinated ──
    // This is the permanent fix for AI mislabeling (e.g. podcasts tagged as TV).
    // Rules are based on media_type (most reliable) then keyword patterns in title/show_tag.
    // This runs BEFORE QC so QC can still catch other issues, and AFTER dedup so it applies to all items.
    const PODCAST_SHOWS = new Set([
      'serial', 'crime junkie', 'my favorite murder', 'hidden brain', 'stuff you should know',
      'the daily', 'armchair expert', 'call her daddy', 'this american life', 'how i built this',
      'conan obrien needs a friend', 'smartless', 'radiolab', 'freakonomics', 'npr', 'pod save america',
      'fresh air', 'revisionist history', 'ologies', 'stuff they dont want you to know',
      'last podcast on the left', 'true crime garage', 'sword and scale', 'up and vanished',
      'dr death', 'dirty john', 'your own backyard', 'cold', 'casefile', 'morbid',
    ]);
    const GAME_TITLES = new Set([
      'super mario', 'zelda', 'pokemon', 'minecraft', 'fortnite', 'call of duty', 'halo',
      'the last of us', 'god of war', 'grand theft auto', 'gta', 'red dead redemption',
      'world of warcraft', 'league of legends', 'overwatch', 'apex legends', 'valorant',
      'animal crossing', 'among us', 'cyberpunk', 'elden ring', 'doom', 'pac-man',
      'tetris', 'street fighter', 'mortal kombat', 'resident evil', 'final fantasy',
      'assassins creed', 'the sims', 'battlefield', 'counter-strike', 'half-life',
    ]);
    function deterministicCategory(item: any): string | null {
      const title = (item.title || '').toLowerCase();
      const showTag = (item.show_tag || '').toLowerCase();
      const mediaType = (item.media_type || '').toLowerCase(); // draft-level field only, not in prediction_pools

      // media_type is the most reliable signal — trust it first
      if (mediaType === 'podcast') return 'Podcasts';
      if (mediaType === 'game') return 'Gaming';

      // Keyword match: podcast indicators in the question title
      if (title.includes('podcast') || title.includes(' pod ') || title.includes(' pods ')) {
        return 'Podcasts';
      }

      // Known podcast show names in show_tag or title
      for (const show of PODCAST_SHOWS) {
        if (showTag.includes(show) || title.includes(show)) {
          return 'Podcasts';
        }
      }

      // Known game titles in show_tag or title
      for (const game of GAME_TITLES) {
        if (showTag.includes(game) || title.includes(game)) {
          return 'Gaming';
        }
      }

      // "video game" phrase anywhere
      if (title.includes('video game') || showTag.includes('video game')) {
        return 'Gaming';
      }

      return null; // no override needed — trust AI's category
    }

    for (const item of items) {
      const corrected = deterministicCategory(item);
      if (corrected) {
        item.category = corrected;
      }
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
   - "Podcasts" = podcast shows, episodes, hosts — NEVER mislabel as "TV". If the question mentions a podcast show, category MUST be "Podcasts".
   - "Gaming" = video games, game characters, gaming culture, esports only — NEVER mislabel as "Pop Culture" or "TV".
   - Fix the category if it's wrong.
3. MEDIA TYPE ACCURACY: Does media_type match? (song/lyric → "music", book → "book", TV show → "tv", film → "movie", podcast → "podcast", video game → "game")
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

    // ── Final category whitelist — runs after QC, catches anything AI/QC still got wrong ──
    const ALLOWED_CATEGORIES = new Set([
      'Books', 'Movies', 'TV', 'TV / Reality', 'True Crime',
      'Music', 'Sports', 'Podcasts', 'Pop Culture', 'Gaming',
    ]);
    const CATEGORY_ALIASES: Record<string, string> = {
      podcast: 'Podcasts', podcasts: 'Podcasts',
      gaming: 'Gaming', games: 'Gaming', game: 'Gaming',
      music: 'Music',
      movies: 'Movies', movie: 'Movies',
      tv: 'TV', television: 'TV', 'tv shows': 'TV',
      books: 'Books', book: 'Books',
      'pop culture': 'Pop Culture',
      sports: 'Sports', sport: 'Sports',
      'true crime': 'True Crime',
      'tv / reality': 'TV / Reality', reality: 'TV / Reality',
    };
    function safeCategory(raw: string | null | undefined): string {
      if (!raw) return 'Pop Culture';
      if (ALLOWED_CATEGORIES.has(raw)) return raw;
      const alias = CATEGORY_ALIASES[raw.toLowerCase().trim()];
      if (alias) return alias;
      return 'Pop Culture'; // hard fallback — never let unknown values reach the DB
    }

    const drafts: any[] = [];
    const errors: string[] = [];
    let showTagDropped = 0;

    // ── show_tag resolver ──────────────────────────────────────────────────────
    // The AI prompt requires show_tag for trivia, but as a belt-and-suspenders
    // fallback we auto-extract it from the question title when the AI omits it.
    // The prompt enforces titles like "In The Shawshank Redemption, what item..."
    // so patterns below reliably capture the media title.
    function extractShowTag(title: string): string | null {
      if (!title) return null;
      // "In [Title], ..." / "In [Title]: ..."
      let m = title.match(/^In\s+(.+?)[,:][\s]/i);
      if (m && m[1].length >= 2) return m[1].trim();
      // "On [Artist]'s [Album], ..." or "On [Title], ..."
      m = title.match(/^On\s+(.+?),\s/i);
      if (m && m[1].length >= 2) return m[1].trim();
      // "...in [Title]?" — end of sentence
      m = title.match(/\bin\s+([A-Z][A-Za-z0-9 :'\-&\.]{2,60})\?/);
      if (m) return m[1].trim();
      // "...from [Title]?"
      m = title.match(/\bfrom\s+([A-Z][A-Za-z0-9 :'\-&\.]{2,60})\?/);
      if (m) return m[1].trim();
      // Single-quoted title: 'The Matrix'
      m = title.match(/['\u2018\u2019]([A-Z][^'\u2018\u2019]{1,60})['\u2018\u2019]/);
      if (m) return m[1].trim();
      return null;
    }

    // Resolve show_tag + media_tags on every trivia item before saving
    const resolvedItems = dedupedItems.map(item => {
      const isTrivia = (item.content_type || contentType) === 'trivia';

      // Step 1: ensure show_tag is set (extract from title if AI omitted it)
      let showTag = item.show_tag || null;
      if (isTrivia && !showTag) {
        const extracted = extractShowTag(item.title || '');
        if (extracted) {
          console.log(`Auto-extracted show_tag "${extracted}" from title: "${(item.title || '').substring(0, 80)}"`);
          showTag = extracted;
        }
      }

      // Step 2: build media_tags array — must contain all referenced media titles
      // If AI provided media_tags, validate it; otherwise build from show_tag
      let mediaTags: string[] | null = null;
      if (Array.isArray(item.media_tags) && item.media_tags.length > 0) {
        // Deduplicate and ensure show_tag is always in the array
        const tagSet = new Set<string>(item.media_tags.map((t: any) => String(t).trim()).filter(Boolean));
        if (showTag) tagSet.add(showTag);
        mediaTags = Array.from(tagSet);
      } else if (showTag) {
        mediaTags = [showTag];
      }

      return { ...item, show_tag: showTag, media_tags: mediaTags };
    });

    // Guard: drop any trivia still missing show_tag after extraction attempt
    const validatedItems = resolvedItems.filter(item => {
      if ((item.content_type || contentType) === 'trivia' && !item.show_tag) {
        showTagDropped++;
        console.warn(`Dropped trivia (no show_tag, extraction failed): "${(item.title || '').substring(0, 80)}"`);
        return false;
      }
      return true;
    });

    for (const item of validatedItems) {
      const draft = {
        content_type: item.content_type || contentType,
        title: item.title || '',
        options: item.options || [],
        correct_answer: item.correct_answer || null,
        category: safeCategory(item.category),
        show_tag: item.show_tag || null,
        media_tags: item.media_tags || null,
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
      showTagDropped: showTagDropped > 0 ? showTagDropped : undefined,
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
