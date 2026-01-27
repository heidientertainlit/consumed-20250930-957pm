-- Fix missing poster for Sinners in Best Picture category
UPDATE awards_nominees 
SET poster_url = 'https://image.tmdb.org/t/p/w500/qTvFWCGeGXgBRaINLY1zqgTPSpn.jpg'
WHERE id = 'nom-osc26-bp-1';
