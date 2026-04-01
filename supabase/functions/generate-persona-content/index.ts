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

    const { personaIds, postsPerPersona = 2 } = await req.json();

    if (!personaIds || !Array.isArray(personaIds) || personaIds.length === 0) {
      return new Response(JSON.stringify({ error: 'personaIds array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: personas, error: personaError } = await supabaseAdmin
      .from('users')
      .select('id, user_name, display_name, persona_config')
      .in('id', personaIds)
      .eq('is_persona', true);

    if (personaError || !personas || personas.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid personas found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const allDrafts: any[] = [];

    for (const persona of personas) {
      const config = persona.persona_config as any;
      if (!config) continue;

      const styleExamples = (config.style_examples || [])
        .map((ex: any) => `[${ex.type}]: ${ex.content}`)
        .join('\n\n');

      const prompt = `You are ${persona.display_name} (@${persona.user_name}), a real person posting on a social entertainment platform called Consumed.

PERSONALITY:
- Bio: ${config.bio}
- Tone: ${config.tone}
- Interests: ${(config.interests || []).join(', ')}
- Preferred media: ${(config.media_types || []).join(', ')}
- Favorites: ${(config.favorite_media || []).join(', ')}
- Posting style: ${config.posting_style}
- Activity level: ${config.activity_level}

WRITING STYLE EXAMPLES (match this voice exactly):
${styleExamples}

TASK: Generate ${postsPerPersona} distinct social posts this person would authentically write right now. Posts should be about specific real media (movies, TV shows, books, podcasts, music, or games) that fit their taste.

For each post return a JSON object with these exact fields:
- post_type: one of "thought", "hot_take", "review" (use "review" when there's a rating)
- content: the post text (no hashtags, no emojis unless they fit the persona's style naturally, match their voice exactly)
- rating: a number 1-10 with one decimal (e.g. 8.5) if the post is a review/rating, otherwise null
- media_title: exact title of the media being discussed
- media_type: one of "movie", "tv", "book", "podcast", "music", "game"
- media_creator: director, author, artist, or show creator (if known)
- ai_notes: one sentence explaining why this fits the persona

Return ONLY a JSON array of ${postsPerPersona} post objects. No other text.`;

      try {
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (!anthropicResponse.ok) {
          const errText = await anthropicResponse.text();
          console.error('Anthropic error for', persona.user_name, errText);
          continue;
        }

        const anthropicData = await anthropicResponse.json();
        const rawText = anthropicData.content?.[0]?.text || '';

        let posts: any[] = [];
        try {
          const jsonMatch = rawText.match(/\[[\s\S]*\]/);
          posts = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch (parseErr) {
          console.error('Parse error for', persona.user_name, parseErr, rawText);
          continue;
        }

        for (const post of posts) {
          const draft = {
            persona_user_id: persona.id,
            post_type: post.post_type || 'thought',
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
            console.error('Insert error:', insertError);
          } else {
            allDrafts.push({ ...draft, id: inserted.id, persona_user_name: persona.user_name, persona_display_name: persona.display_name });
          }
        }
      } catch (err) {
        console.error('Error processing persona', persona.user_name, err);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      generated: allDrafts.length,
      drafts: allDrafts,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
