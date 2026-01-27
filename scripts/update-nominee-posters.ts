import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
}

async function searchTMDB(title: string, year?: number): Promise<string | null> {
  try {
    const searchTypes = ['movie', 'tv'];
    
    for (const type of searchTypes) {
      const params = new URLSearchParams({
        api_key: TMDB_API_KEY,
        query: title,
        ...(year && { year: year.toString() })
      });
      
      const response = await fetch(`${TMDB_BASE_URL}/search/${type}?${params}`);
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const result = data.results[0] as TMDBSearchResult;
        if (result.poster_path) {
          return `https://image.tmdb.org/t/p/w300${result.poster_path}`;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching TMDB for "${title}":`, error);
    return null;
  }
}

async function updateNominePosters() {
  console.log("Fetching nominees without posters...");
  
  const { data: nominees, error } = await supabase
    .from("awards_nominees")
    .select("id, name, movie_title, poster_url")
    .or("poster_url.is.null,poster_url.eq.");
  
  if (error) {
    console.error("Error fetching nominees:", error);
    return;
  }
  
  console.log(`Found ${nominees?.length || 0} nominees without posters`);
  
  let updated = 0;
  let failed = 0;
  
  for (const nominee of nominees || []) {
    const searchTitle = nominee.movie_title || nominee.name;
    console.log(`Searching for: ${searchTitle}`);
    
    const posterUrl = await searchTMDB(searchTitle);
    
    if (posterUrl) {
      const { error: updateError } = await supabase
        .from("awards_nominees")
        .update({ poster_url: posterUrl })
        .eq("id", nominee.id);
      
      if (updateError) {
        console.error(`Failed to update ${nominee.name}:`, updateError);
        failed++;
      } else {
        console.log(`✓ Updated: ${nominee.name} -> ${posterUrl}`);
        updated++;
      }
    } else {
      console.log(`✗ No poster found for: ${searchTitle}`);
      failed++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`);
}

updateNominePosters();
