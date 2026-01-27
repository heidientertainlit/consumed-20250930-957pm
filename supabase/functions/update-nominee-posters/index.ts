import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  profile_path: string | null;
}

async function searchTMDB(query: string, type: "movie" | "person"): Promise<string | null> {
  try {
    const endpoint = type === "movie" ? "search/movie" : "search/person";
    const response = await fetch(
      `${TMDB_BASE_URL}/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.results?.[0] as TMDBSearchResult;
    
    if (!result) return null;
    
    const path = type === "movie" ? result.poster_path : result.profile_path;
    return path ? `https://image.tmdb.org/t/p/w500${path}` : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Require TMDB API key to be configured
  if (!TMDB_API_KEY) {
    return new Response(
      JSON.stringify({ error: "TMDB API key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify admin authorization (check if user has admin role)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin (simple email check - adjust as needed)
    const { data: userData } = await supabaseClient
      .from("users")
      .select("is_admin")
      .eq("auth_id", user.id)
      .single();

    if (!userData?.is_admin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const eventSlug = body.event || "oscars-2026";

    // Get all nominees without poster_url for this event
    const { data: categories } = await supabaseClient
      .from("awards_categories")
      .select(`
        id,
        name,
        nominees:awards_nominees(id, name, title, poster_url)
      `)
      .eq("event_id", eventSlug);

    if (!categories) {
      return new Response(
        JSON.stringify({ error: "No categories found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updates: { id: string; name: string; poster_url: string }[] = [];
    
    for (const category of categories) {
      const nominees = category.nominees as any[];
      const isActorCategory = category.name.includes("Actor") || 
                              category.name.includes("Actress") ||
                              category.name.includes("Director");
      
      for (const nominee of nominees) {
        if (nominee.poster_url) continue; // Already has poster
        
        // For actor/director categories, search for person
        // For other categories (picture, screenplay, etc.), search for the movie
        let posterUrl: string | null = null;
        
        if (isActorCategory) {
          // Search for the person's headshot
          posterUrl = await searchTMDB(nominee.name, "person");
          
          // If no person found, try searching for the movie poster
          if (!posterUrl && nominee.title) {
            posterUrl = await searchTMDB(nominee.title, "movie");
          }
        } else {
          // Search for the movie poster
          const movieTitle = nominee.title || nominee.name;
          posterUrl = await searchTMDB(movieTitle, "movie");
        }
        
        if (posterUrl) {
          // Update the nominee's poster_url
          await supabaseClient
            .from("awards_nominees")
            .update({ poster_url: posterUrl })
            .eq("id", nominee.id);
          
          updates.push({
            id: nominee.id,
            name: nominee.name,
            poster_url: posterUrl
          });
        }
        
        // Rate limiting - wait 250ms between requests
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: updates.length,
        nominees: updates
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error updating posters:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
