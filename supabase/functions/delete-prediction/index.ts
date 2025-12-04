import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    )

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { pool_id } = await req.json()
    if (!pool_id) {
      return new Response(JSON.stringify({ error: 'Missing pool_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Use admin client to delete prediction (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          }
        }
      }
    )

    // Get app user from email to compare with origin_user_id
    const { data: appUser, error: appUserError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single()

    if (appUserError || !appUser) {
      console.error('Failed to get app user:', appUserError)
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user owns the prediction
    const { data: prediction, error: fetchError } = await supabaseAdmin
      .from('prediction_pools')
      .select('id, origin_user_id')
      .eq('id', pool_id)
      .single()

    if (fetchError || !prediction) {
      return new Response(JSON.stringify({ error: 'Prediction not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Compare with app user ID, not auth user ID
    if (prediction.origin_user_id !== appUser.id) {
      return new Response(JSON.stringify({ error: 'Not authorized to delete this prediction' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Also delete associated social posts that reference this prediction
    const { error: socialPostError } = await supabaseAdmin
      .from('social_posts')
      .delete()
      .eq('prediction_pool_id', pool_id)

    if (socialPostError) {
      console.error('Error deleting social posts:', socialPostError)
      // Continue anyway - the main prediction pool delete is more important
    }

    // Delete the prediction
    const { error: deleteError } = await supabaseAdmin
      .from('prediction_pools')
      .delete()
      .eq('id', pool_id)
      .eq('origin_user_id', appUser.id)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return new Response(JSON.stringify({ error: 'Failed to delete prediction' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true, deleted_pool_id: pool_id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
