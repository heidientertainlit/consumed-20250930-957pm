import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { title, visibility, items } = await req.json();

    if (!title || title.trim().length === 0) {
      return new Response(JSON.stringify({
        error: 'List title is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (title.trim().length > 50) {
      return new Response(JSON.stringify({
        error: 'List title must be 50 characters or less'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isPrivate = visibility === 'private';

    const { data: newList, error: createError } = await supabase
      .from('lists')
      .insert({
        title: title.trim(),
        user_id: user.id,
        is_private: isPrivate
      })
      .select('id, title, user_id, is_private')
      .single();

    if (createError) {
      console.error('Error creating list:', createError);
      return new Response(JSON.stringify({
        error: 'Failed to create list: ' + createError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Successfully created custom list:', newList);

    let addedItems: any[] = [];
    if (items && Array.isArray(items) && items.length > 0) {
      const itemsToInsert = items.map((item: any) => ({
        list_id: newList.id,
        user_id: user.id,
        title: item.title,
        media_type: item.mediaType || item.media_type,
        creator: item.creator,
        image_url: item.imageUrl || item.image_url,
        external_id: item.externalId || item.external_id,
        external_source: item.externalSource || item.external_source,
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from('list_items')
        .insert(itemsToInsert)
        .select();

      if (itemsError) {
        console.error('Error adding items to list:', itemsError);
      } else {
        addedItems = insertedItems || [];
        console.log(`Added ${addedItems.length} items to list`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      list: newList,
      itemsAdded: addedItems.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error: ' + (error as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
