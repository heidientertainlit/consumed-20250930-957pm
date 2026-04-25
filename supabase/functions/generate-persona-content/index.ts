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

    const { personaIds, postsPerPersona = 2, useTrending = false } = await req.json();

    if (!personaIds || !Array.isArray(personaIds) || personaIds.length === 0) {
      return new Response(JSON.stringify({ error: 'personaIds array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Fetch trending content once, share across all personas ──
    let trendingContext = '';
    if (useTrending) {
      try {
        const tmdbKey = Deno.env.get('TMDB_API_KEY') || '';
        const googleBooksKey = Deno.env.get('GOOGLE_BOOKS_API_KEY') || '';
        const trendingTitles: string[] = [];

        // TMDB trending TV + movies this week
        if (tmdbKey) {
          try {
            const [tvRes, movieRes] = await Promise.all([
              fetch(`https://api.themoviedb.org/3/trending/tv/week?api_key=${tmdbKey}`),
              fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${tmdbKey}`),
            ]);
            if (tvRes.ok) {
              const d = await tvRes.json();
              ((d.results || []) as any[]).slice(0, 10).forEach((s: any, i: number) => {
                if (s.name) trendingTitles.push(`${s.name} [TV, #${i + 1} trending]`);
              });
            }
            if (movieRes.ok) {
              const d = await movieRes.json();
              ((d.results || []) as any[]).slice(0, 8).forEach((m: any, i: number) => {
                if (m.title) trendingTitles.push(`${m.title} [Movie, #${i + 1} trending]`);
              });
            }
          } catch (_) {}
        }

        // Open Library trending books this week (free, no key)
        try {
          const olRes = await fetch('https://openlibrary.org/trending/weekly.json?limit=10', {
            headers: { 'User-Agent': 'Consumed-App/1.0' },
          });
          if (olRes.ok) {
            const d = await olRes.json();
            ((d.works || []) as any[]).slice(0, 8).forEach((w: any, i: number) => {
              if (w.title) trendingTitles.push(`${w.title} [Book, #${i + 1} trending]`);
            });
          }
        } catch (_) {}

        // Google Books: recent popular fiction (free key)
        if (googleBooksKey) {
          try {
            const gbRes = await fetch(
              `https://www.googleapis.com/books/v1/volumes?q=subject:fiction&orderBy=newest&maxResults=6&key=${googleBooksKey}`
            );
            if (gbRes.ok) {
              const d = await gbRes.json();
              ((d.items || []) as any[]).slice(0, 5).forEach((item: any) => {
                const title = item.volumeInfo?.title;
                if (title) trendingTitles.push(`${title} [Book, new release]`);
              });
            }
          } catch (_) {}
        }

        if (trendingTitles.length > 0) {
          trendingContext = `\n\nTRENDING THIS WEEK — at least half of your posts should be personal reactions to something from this list (pick whatever fits your taste best):\n${trendingTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nThe other posts can be about anything that fits your personality.`;
        }
      } catch (_) {
        // Trending fetch is best-effort — don't block generation
      }
    }

    const { data: personas, error: personaError } = await supabaseAdmin
      .from('users')
      .select('id, user_name, display_name, persona_config')
      .in('id', personaIds)
      .eq('is_persona', true);

    if (personaError || !personas || personas.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid personas found', detail: personaError?.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const allDrafts: any[] = [];
    const errors: string[] = [];

    for (const persona of personas) {
      const config = persona.persona_config as any;
      if (!config) {
        errors.push(`${persona.user_name}: no persona_config`);
        continue;
      }

      const styleExamples = (config.style_examples || [])
        .map((ex: any) => `[${ex.type}]: ${ex.content}`)
        .join('\n\n');

      // Fetch recent rejected drafts for this persona that have feedback
      const { data: recentRejections } = await supabaseAdmin
        .from('persona_post_drafts')
        .select('content, rejection_reason')
        .eq('persona_user_id', persona.id)
        .eq('status', 'rejected')
        .not('rejection_reason', 'is', null)
        .order('rejected_at', { ascending: false })
        .limit(5);

      const rejectionBlock = recentRejections && recentRejections.length > 0
        ? `\n\nRECENT REJECTIONS — learn from these and do NOT repeat these mistakes:\n` +
          recentRejections.map((r: any, i: number) =>
            `Rejected post ${i + 1}: "${r.content.slice(0, 120)}..."\nFeedback: ${r.rejection_reason}`
          ).join('\n\n')
        : '';

      const systemPrompt = `You are ${persona.display_name} (@${persona.user_name}), a real person posting on a social entertainment platform called Consumed.

PERSONALITY:
- Bio: ${config.bio}
- Tone: ${config.tone}
- Interests: ${(config.interests || []).join(', ')}
- Preferred media: ${(config.media_types || []).join(', ')}
- Favorites: ${(config.favorite_media || []).join(', ')}
- Posting style: ${config.posting_style}
- Activity level: ${config.activity_level}

WRITING STYLE EXAMPLES (match this voice exactly):
${styleExamples}${rejectionBlock}`;

      const userPrompt = `Generate ${postsPerPersona} distinct social posts this person would authentically write right now. Posts should be about specific real media (movies, TV shows, books, podcasts, music, or games) that fit their taste.${trendingContext}

CRITICAL STYLE RULES — read carefully:
- Write HUMAN REACTIONS, not descriptions. Posts must be personal opinions, feelings, or takes — never a plot summary or factual overview.
- BAD example (NEVER do this): "The Witcher 3: Wild Hunt is an open-world RPG developed by CD Projekt Red. The game features a rich storyline and detailed world."
- GOOD example: "Still thinking about the Bloody Baron quest three years later. That game wrecked me."
- BAD example: "Oppenheimer is a biographical thriller about J. Robert Oppenheimer and the Manhattan Project directed by Christopher Nolan."
- GOOD example: "Nolan somehow made a 3-hour physics lecture the most stressful thing I've watched all year."
- Posts must feel like something you'd type in 30 seconds — impulsive, opinionated, conversational
- First-person voice only. Use "I", "me", "my" naturally
- Vary the topics across posts — don't repeat the same show or movie
- Write entirely in this person's authentic voice — do NOT copy or paraphrase any existing reviews, Reddit posts, or published criticism
- Reference factually accurate details: correct actor names, real plot points, actual directors/authors/artists
- NEVER put any score or rating inside the post text. No "9/10", "4.5 stars", "8 out of 10", "9 stars out of 10", or ANY numerical rating in the content field. Ratings go ONLY in the separate "rating" JSON field.

For each post return a JSON object with these exact fields:
- post_type: always use "review" regardless of whether a rating is included. NEVER use "thought" or "hot_take".
- content: the post text — NO ratings, NO scores, NO stars mentioned. Just the reaction in their voice.
- rating: a number on a 5-STAR scale from 0.5 to 5.0 in 0.5 increments (e.g. 3.5, 4.0, 4.5, 5.0). MAXIMUM is 5.0. NEVER use 6, 7, 8, 9, or 10. If the post is not a review, use null.
- media_title: exact title of the media being discussed
- media_type: one of "movie", "tv", "book", "podcast", "music", "game"
- media_creator: director, author, artist, or show creator name (if known)
- ai_notes: one sentence explaining why this fits the persona

Return ONLY a JSON array of ${postsPerPersona} post objects. No other text.`;

      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            max_tokens: 2048,
            temperature: 0.9,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
        });

        if (!openaiResponse.ok) {
          const errText = await openaiResponse.text();
          const errMsg = `${persona.user_name}: OpenAI API error ${openaiResponse.status} - ${errText}`;
          console.error(errMsg);
          errors.push(errMsg);
          continue;
        }

        const openaiData = await openaiResponse.json();
        const rawText = openaiData.choices?.[0]?.message?.content || '';

        if (!rawText) {
          const errMsg = `${persona.user_name}: empty response from OpenAI`;
          console.error(errMsg);
          errors.push(errMsg);
          continue;
        }

        let posts: any[] = [];
        try {
          const jsonMatch = rawText.match(/\[[\s\S]*\]/);
          posts = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
          if (posts.length === 0) {
            errors.push(`${persona.user_name}: parsed 0 posts from: ${rawText.substring(0, 200)}`);
          }
        } catch (parseErr) {
          const errMsg = `${persona.user_name}: JSON parse error - ${parseErr} - raw: ${rawText.substring(0, 200)}`;
          console.error(errMsg);
          errors.push(errMsg);
          continue;
        }

        for (const post of posts) {
          const draft = {
            persona_user_id: persona.id,
            post_type: (post.post_type === 'thought' || !post.post_type) ? 'review' : post.post_type,
            content: post.content || '',
            rating: post.rating || null,
            media_title: post.media_title || null,
            media_type: post.media_type || null,
            media_creator: post.media_creator || null,
            ai_notes: post.ai_notes || null,
            status: 'draft',
          };

          const { data: inserted, error: insertError } = await supabaseAdmin
            .from('persona_post_drafts')
            .insert(draft)
            .select('id')
            .single();

          if (insertError) {
            const errMsg = `${persona.user_name}: insert error - ${insertError.message}`;
            console.error(errMsg);
            errors.push(errMsg);
          } else {
            allDrafts.push({ ...draft, id: inserted.id, persona_user_name: persona.user_name, persona_display_name: persona.display_name });
          }
        }
      } catch (err) {
        const errMsg = `${persona.user_name}: unexpected error - ${err}`;
        console.error(errMsg);
        errors.push(errMsg);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      generated: allDrafts.length,
      drafts: allDrafts,
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
