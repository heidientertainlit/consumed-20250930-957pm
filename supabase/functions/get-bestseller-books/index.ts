import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const NYT_API_KEY = Deno.env.get('NYT_API_KEY');
    
    if (!NYT_API_KEY) {
      return new Response(JSON.stringify({ error: 'NYT API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch NYT bestseller list (combined print & e-book fiction)
    const nytResponse = await fetch(
      `https://api.nytimes.com/svc/books/v3/lists/current/combined-print-and-e-book-fiction.json?api-key=${NYT_API_KEY}`
    );
    
    if (!nytResponse.ok) {
      const errorText = await nytResponse.text();
      console.error('NYT API error:', nytResponse.status, errorText);
      throw new Error(`Failed to fetch from NY Times: ${nytResponse.status}`);
    }

    const nytData = await nytResponse.json();
    const books = nytData.results?.books || [];

    // Format book data with cover images
    const formattedBooks = books.slice(0, 10).map((book: any) => {
      let imageUrl = '';
      
      // Get cover from Open Library (free, no quota limits)
      const isbn = book.primary_isbn13 || book.primary_isbn10;
      if (isbn) {
        imageUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
      }

      return {
        id: isbn || book.rank.toString(),
        title: book.title,
        author: book.author,
        imageUrl,
        rating: undefined,
        year: undefined,
        mediaType: 'book',
        rank: book.rank,
        weeksOnList: book.weeks_on_list,
        description: book.description,
      };
    });

    return new Response(JSON.stringify(formattedBooks), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching NYT bestsellers:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch bestsellers' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
