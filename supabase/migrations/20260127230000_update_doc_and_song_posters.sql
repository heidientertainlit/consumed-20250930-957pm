-- Update Documentary Feature Film posters from TMDB
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w300/gultnK0rYs4xLLYhxQ9ZnvPfVAn.jpg' WHERE title = 'The Alabama Solution';
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w300/5AFbcDGT78cLZTyHTSDBohczjuO.jpg' WHERE title = 'Come See Me in the Good Light';
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w300/qefjf5TeM0uRzrFU2c4xYt6ew9z.jpg' WHERE title = 'Cutting Through Rocks';
UPDATE awards_nominees SET poster_url = 'https://image.tmdb.org/t/p/w300/aXCEnrqecvPXohuptN0JRgIvkDj.jpg' WHERE title = 'Mr. Nobody Against Putin';

-- Update Best Original Song posters with Spotify album art
UPDATE awards_nominees SET poster_url = 'https://i.scdn.co/image/ab67616d0000b2739c02516bfeca4ec9a9f1fcd7' WHERE name LIKE '%Diane Warren%';
UPDATE awards_nominees SET poster_url = 'https://i.scdn.co/image/ab67616d0000b2731cf7cd782eb7dc75a8d181fc' WHERE name LIKE '%EJAE%';
