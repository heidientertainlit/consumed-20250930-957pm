import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders } from '../_shared/cors.ts'

interface Database {
  public: {
    Tables: {
      lists: {
        Row: {
          id: string
          user_id: string
          title: string
          media_type: string | null
          created_at: string | null
          is_private: boolean | null
          is_pinned: boolean | null
          share_id: string | null
          updated_at: string | null
          visibility: string | null
          is_default: boolean | null
          is_public: boolean | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          media_type?: string | null
          created_at?: string | null
          is_private?: boolean | null
          is_pinned?: boolean | null
          share_id?: string | null
          updated_at?: string | null
          visibility?: string | null
          is_default?: boolean | null
          is_public?: boolean | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          media_type?: string | null
          created_at?: string | null
          is_private?: boolean | null
          is_pinned?: boolean | null
          share_id?: string | null
          updated_at?: string | null
          visibility?: string | null
          is_default?: boolean | null
          is_public?: boolean | null
        }
      }
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key for RLS bypass when needed
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const method = req.method
    const url = new URL(req.url)
    const listId = url.searchParams.get('listId')

    switch (method) {
      case 'GET':
        if (listId) {
          // Get specific list
          const { data: list, error } = await supabaseClient
            .from('lists')
            .select('*')
            .eq('id', listId)
            .single()

          if (error) {
            return new Response(
              JSON.stringify({ error: 'List not found' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          return new Response(
            JSON.stringify(list),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          // Get user's lists + public lists
          const { data: lists, error } = await supabaseClient
            .from('lists')
            .select('*')
            .or(`user_id.eq.${user.id},visibility.eq.public`)
            .order('created_at', { ascending: false })

          if (error) {
            return new Response(
              JSON.stringify({ error: 'Failed to fetch lists' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          return new Response(
            JSON.stringify(lists),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

      case 'POST':
        // Create new list
        const createData = await req.json()
        
        const { data: newList, error: createError } = await supabaseClient
          .from('lists')
          .insert({
            user_id: user.id,
            title: createData.title,
            media_type: createData.media_type || null,
            visibility: createData.visibility || 'private',
            is_private: createData.visibility !== 'public',
            is_public: createData.visibility === 'public',
            is_pinned: false,
            is_default: false
          })
          .select()
          .single()

        if (createError) {
          return new Response(
            JSON.stringify({ error: 'Failed to create list', details: createError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify(newList),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'PUT':
        // Update list
        if (!listId) {
          return new Response(
            JSON.stringify({ error: 'List ID required for update' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const updateData = await req.json()
        
        const { data: updatedList, error: updateError } = await supabaseClient
          .from('lists')
          .update({
            title: updateData.title,
            media_type: updateData.media_type,
            visibility: updateData.visibility,
            is_private: updateData.visibility !== 'public',
            is_public: updateData.visibility === 'public',
            is_pinned: updateData.is_pinned,
            updated_at: new Date().toISOString()
          })
          .eq('id', listId)
          .eq('user_id', user.id) // Only allow updating own lists
          .select()
          .single()

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Failed to update list' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify(updatedList),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'DELETE':
        // Delete list
        if (!listId) {
          return new Response(
            JSON.stringify({ error: 'List ID required for deletion' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error: deleteError } = await supabaseClient
          .from('lists')
          .delete()
          .eq('id', listId)
          .eq('user_id', user.id) // Only allow deleting own lists

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: 'Failed to delete list' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error in manage-lists function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})