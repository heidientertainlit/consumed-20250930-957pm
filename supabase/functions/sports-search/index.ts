
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
    const body = await req.json();
    const { query, sport_type, date_range } = body;
    
    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];

    // ESPN API - Free tier with good coverage
    try {
      const sportMappings = {
        'football': 'football/nfl',
        'basketball': 'basketball/nba', 
        'baseball': 'baseball/mlb',
        'hockey': 'hockey/nhl',
        'soccer': 'soccer/eng.1',
        'tennis': 'tennis/atp',
        'golf': 'golf/pga'
      };

      const sportsToSearch = sport_type ? [sportMappings[sport_type]] : Object.values(sportMappings);

      for (const sport of sportsToSearch) {
        if (!sport) continue;
        
        // Get recent games/events
        const espnResponse = await fetch(`http://site.api.espn.com/apis/site/v2/sports/${sport}/scoreboard`);
        if (espnResponse.ok) {
          const espnData = await espnResponse.json();
          
          espnData.events?.forEach((game) => {
            const homeTeam = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')?.team;
            const awayTeam = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')?.team;
            
            if (!homeTeam || !awayTeam) return;
            
            const gameTitle = `${awayTeam.displayName} @ ${homeTeam.displayName}`;
            const searchText = `${gameTitle} ${homeTeam.name} ${awayTeam.name}`.toLowerCase();
            
            if (searchText.includes(query.toLowerCase())) {
              const homeScore = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')?.score;
              const awayScore = game.competitions?.[0]?.competitors?.find(c => c.homeAway === 'away')?.score;
              
              results.push({
                title: gameTitle,
                type: 'sports',
                creator: `${sport.split('/')[1].toUpperCase()} • ${game.season?.type?.name || 'Season'}`,
                image: homeTeam.logo || awayTeam.logo || '',
                external_id: game.id,
                external_source: 'espn',
                description: `${game.status?.type?.detail || 'Scheduled'} • ${new Date(game.date).toLocaleDateString()}${homeScore && awayScore ? ` • ${awayScore}-${homeScore}` : ''}`,
                game_date: game.date,
                status: game.status?.type?.name,
                home_team: homeTeam.displayName,
                away_team: awayTeam.displayName,
                home_score: homeScore,
                away_score: awayScore,
                sport_league: sport.split('/')[1].toUpperCase()
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('ESPN API error:', error);
    }

    // The Sports DB API - Free community database
    try {
      if (query.length > 2) {
        const sportsDbResponse = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=${encodeURIComponent(query)}`);
        if (sportsDbResponse.ok) {
          const sportsDbData = await sportsDbResponse.json();
          sportsDbData.event?.slice(0, 5).forEach((event) => {
            results.push({
              title: event.strEvent,
              type: 'sports',
              creator: `${event.strSport} • ${event.strLeague}`,
              image: event.strThumb || event.strPoster || '',
              external_id: event.idEvent,
              external_source: 'thesportsdb',
              description: `${event.strVenue || ''} • ${event.dateEvent}`,
              game_date: event.dateEvent,
              home_team: event.strHomeTeam,
              away_team: event.strAwayTeam,
              sport_league: event.strLeague
            });
          });
        }
      }
    } catch (error) {
      console.error('Sports DB search error:', error);
    }

    // Remove duplicates and limit results
    const uniqueResults = results.filter((result, index, self) => 
      index === self.findIndex(r => r.external_id === result.external_id && r.external_source === result.external_source)
    ).slice(0, 15);

    return new Response(JSON.stringify({ results: uniqueResults }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Sports search error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
