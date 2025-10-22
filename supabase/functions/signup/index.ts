import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role to bypass RLS
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { userId, email, firstName, lastName, username } = await req.json()

    // Create user in custom users table
    const { error: dbError } = await supabaseClient
      .from('users')
      .upsert({
        id: userId,
        email: email,
        user_name: username,
        first_name: firstName,
        last_name: lastName,
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      })

    if (dbError) {
      console.error('Failed to create user in database:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to create user profile', details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create system lists immediately for new user
    const systemLists = [
      { title: 'Currently', is_default: true, is_private: false },
      { title: 'Queue', is_default: true, is_private: false },
      { title: 'Finished', is_default: true, is_private: false },
      { title: 'Did Not Finish', is_default: true, is_private: false },
      { title: 'Favorites', is_default: true, is_private: false },
    ]

    for (const list of systemLists) {
      const { error: listError } = await supabaseClient
        .from('lists')
        .insert({
          user_id: userId,
          title: list.title,
          is_default: list.is_default,
          is_private: list.is_private,
        })
      
      // Ignore duplicate key errors (23505) - list might already exist
      if (listError && listError.code !== '23505') {
        console.error(`Failed to create ${list.title} list:`, listError)
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Signup function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
