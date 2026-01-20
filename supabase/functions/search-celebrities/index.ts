import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') || '1e5f6b8fd5c07f4f0eefbe8df62020dc';

const CURATED_ACTRESSES = [
  { id: '1245', name: 'Scarlett Johansson' },
  { id: '90633', name: 'Gal Gadot' },
  { id: '1397778', name: 'Zendaya' },
  { id: '1356210', name: 'Jenna Ortega' },
  { id: '224513', name: 'Lupita Nyong\'o' },
  { id: '1903', name: 'Anne Hathaway' },
  { id: '6885', name: 'Charlize Theron' },
  { id: '17018', name: 'Priyanka Chopra Jonas' },
  { id: '72129', name: 'Jennifer Lawrence' },
  { id: '8691', name: 'Zoe Saldana' },
  { id: '2324', name: 'Halle Berry' },
  { id: '5081', name: 'Emily Blunt' },
  { id: '9780', name: 'Viola Davis' },
  { id: '1620', name: 'Michelle Yeoh' },
  { id: '1373737', name: 'Florence Pugh' },
  { id: '1625558', name: 'Awkwafina' },
  { id: '1734451', name: 'Sydney Sweeney' },
  { id: '18050', name: 'Constance Wu' },
  { id: '82104', name: 'Regina King' },
  { id: '54882', name: 'Gemma Chan' },
  { id: '59174', name: 'Mindy Kaling' },
  { id: '20904', name: 'Kerry Washington' },
  { id: '17647', name: 'Sandra Oh' },
  { id: '1253', name: 'Salma Hayek' },
  { id: '116315', name: 'Ana de Armas' }
];

const CURATED_ACTORS = [
  { id: '17419', name: 'Bryan Cranston' },
  { id: '976', name: 'Jason Statham' },
  { id: '73457', name: 'Chris Hemsworth' },
  { id: '1136406', name: 'Tom Holland' },
  { id: '172069', name: 'Chadwick Boseman' },
  { id: '16483', name: 'Sylvester Stallone' },
  { id: '2888', name: 'Will Smith' },
  { id: '17605', name: 'Idris Elba' },
  { id: '6384', name: 'Keanu Reeves' },
  { id: '500', name: 'Tom Cruise' },
  { id: '3223', name: 'Robert Downey Jr.' },
  { id: '1892', name: 'Matt Damon' },
  { id: '72466', name: 'Dev Patel' },
  { id: '1100', name: 'Arnold Schwarzenegger' },
  { id: '31', name: 'Tom Hanks' },
  { id: '12835', name: 'Riz Ahmed' },
  { id: '17276', name: 'John Cho' },
  { id: '776', name: 'John Boyega' },
  { id: '1253360', name: 'Pedro Pascal' },
  { id: '1190668', name: 'Timothée Chalamet' },
  { id: '234352', name: 'Simu Liu' },
  { id: '587506', name: 'Kumail Nanjiani' },
  { id: '17604', name: 'Daniel Kaluuya' },
  { id: '10859', name: 'Ryan Reynolds' },
  { id: '1269', name: 'Kevin Hart' }
];

async function fetchCelebrityDetails(ids: { id: string, name: string }[]) {
  const results = await Promise.all(
    ids.slice(0, 25).map(async ({ id, name }) => {
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/person/${id}?api_key=${TMDB_API_KEY}`
        );
        const person = await response.json();
        if (person.profile_path) {
          return {
            id: String(person.id),
            name: person.name,
            image: `https://image.tmdb.org/t/p/w185${person.profile_path}`,
            known_for: '',
            popularity: person.popularity || 50
          };
        }
        return null;
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, popular, gender } = await req.json();
    
    if (query) {
      const url = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`;
      const response = await fetch(url);
      const data = await response.json();
      const genderFilter = gender === 'male' ? 2 : gender === 'female' ? 1 : null;

      const celebrities = (data.results || [])
        .filter((person: any) => person.profile_path && (!genderFilter || person.gender === genderFilter))
        .slice(0, 25)
        .map((person: any) => ({
          id: String(person.id),
          name: person.name,
          image: `https://image.tmdb.org/t/p/w185${person.profile_path}`,
          known_for: person.known_for?.map((k: any) => k.title || k.name).slice(0, 2).join(', ') || '',
          popularity: person.popularity
        }));

      return new Response(JSON.stringify({ celebrities }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (gender === 'female') {
      const celebrities = await fetchCelebrityDetails(CURATED_ACTRESSES);
      return new Response(JSON.stringify({ celebrities }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (gender === 'male') {
      const celebrities = await fetchCelebrityDetails(CURATED_ACTORS);
      return new Response(JSON.stringify({ celebrities }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const allCurated = [...CURATED_ACTRESSES.slice(0, 12), ...CURATED_ACTORS.slice(0, 13)];
    const celebrities = await fetchCelebrityDetails(allCurated);
    return new Response(JSON.stringify({ celebrities }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Celebrity search error:', error);
    return new Response(JSON.stringify({ error: 'Search failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
