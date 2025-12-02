import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface MediaItem {
  title: string;
  mediaType: string;
  creator?: string;
  imageUrl?: string;
  notes?: string;
  listType: string;
  rating?: number;
}

// Parse Netflix CSV format
function parseNetflix(csvText: string): MediaItem[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  const items: MediaItem[] = [];
  
  // Skip header row, parse data
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(',').map(f => f.trim().replace(/^"|"$/g, ''));
    if (fields.length >= 1 && fields[0]) {
      items.push({
        title: fields[0],
        mediaType: 'tv',
        listType: 'finished'
      });
    }
  }
  
  return items;
}

// Parse Goodreads CSV format
function parseGoodreads(csvText: string): MediaItem[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  const items: MediaItem[] = [];
  
  // Find header indices - Goodreads CSV has columns like: Title, Author, My Rating, Date Read, etc.
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const titleIdx = header.indexOf('title');
  const authorIdx = header.indexOf('author');
  const ratingIdx = header.findIndex(h => h.includes('my rating') || h === 'rating');
  const dateReadIdx = header.findIndex(h => h.includes('date read'));
  const shelfIdx = header.findIndex(h => h.includes('exclusive shelf') || h === 'shelf');
  
  console.log('Goodreads headers found:', { titleIdx, authorIdx, ratingIdx, dateReadIdx, shelfIdx });
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    // Handle CSV with quotes properly (Goodreads has commas in titles)
    const fields = parseCSVLine(lines[i]);
    if (fields[titleIdx]) {
      const rating = ratingIdx >= 0 ? parseInt(fields[ratingIdx]) || 0 : 0;
      const shelf = shelfIdx >= 0 ? fields[shelfIdx]?.toLowerCase() : 'read';
      
      // Map Goodreads shelves to our list types
      let listType = 'finished';
      if (shelf === 'to-read' || shelf === 'want-to-read') {
        listType = 'want-to';
      } else if (shelf === 'currently-reading') {
        listType = 'currently';
      }
      
      items.push({
        title: fields[titleIdx],
        mediaType: 'book',
        creator: fields[authorIdx] || '',
        rating: rating,
        listType: listType
      });
    }
  }
  
  console.log(`Goodreads: Parsed ${items.length} books, ${items.filter(i => i.rating && i.rating > 0).length} with ratings`);
  return items;
}

// Helper to parse CSV line with proper quote handling
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim().replace(/^"|"$/g, ''));
  
  return fields;
}

// Parse Letterboxd CSV format
function parseLetterboxd(csvText: string): MediaItem[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  const items: MediaItem[] = [];
  
  // Letterboxd exports have metadata rows before the actual data
  // Find the row that starts with "Position,Name,Year" which is the real header
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('position') && lower.includes('name') && lower.includes('year')) {
      headerIdx = i;
      break;
    }
  }
  
  if (headerIdx === -1) {
    console.log('Letterboxd: Could not find header row with Position,Name,Year');
    return items;
  }
  
  // Parse header to find column indices
  const header = lines[headerIdx].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const nameIdx = header.indexOf('name');
  const yearIdx = header.indexOf('year');
  
  console.log(`Letterboxd: Found header at line ${headerIdx}, name=${nameIdx}, year=${yearIdx}`);
  
  // Parse data rows (starting after the header)
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const fields = lines[i].split(',').map(f => f.trim().replace(/^"|"$/g, ''));
    if (fields[nameIdx] && fields[nameIdx] !== 'Name') {
      const title = fields[yearIdx] ? `${fields[nameIdx]} (${fields[yearIdx]})` : fields[nameIdx];
      items.push({
        title,
        mediaType: 'movie',
        listType: 'finished'
      });
    }
  }
  
  console.log(`Letterboxd: Parsed ${items.length} movies`);
  return items;
}

// Detect format and parse
function parseImportFile(content: string, filename: string): MediaItem[] {
  const lower = filename.toLowerCase();
  
  if (lower.includes('netflix')) {
    return parseNetflix(content);
  } else if (lower.includes('goodreads')) {
    return parseGoodreads(content);
  } else if (lower.includes('letterboxd')) {
    return parseLetterboxd(content);
  }
  
  // Try to auto-detect based on headers
  const firstLine = content.split('\n')[0].toLowerCase();
  if (firstLine.includes('title') && firstLine.includes('author')) {
    return parseGoodreads(content);
  } else if (firstLine.includes('name') && firstLine.includes('year')) {
    return parseLetterboxd(content);
  } else {
    return parseNetflix(content);
  }
}

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
          headers: { Authorization: req.headers.get('Authorization') }
        }
      }
    );

    // Get auth user (SAME AS track-media)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Import: Auth user:', user.email);

    // Look up app user by email, CREATE if doesn't exist (SAME AS track-media)
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      console.log('Import: User not found, creating new user:', user.email);
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
          display_name: user.user_metadata?.display_name || user.email.split('@')[0] || 'User',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || ''
        })
        .select('id, email, user_name')
        .single();

      if (createError) {
        console.error('Import: Failed to create user:', createError);
        return new Response(JSON.stringify({ 
          error: 'Failed to create user: ' + createError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      appUser = newUser;
      console.log('Import: Created new user:', appUser);
    } else if (appUserError) {
      console.error('Import: User lookup error:', appUserError);
      return new Response(JSON.stringify({ 
        error: 'User lookup failed: ' + appUserError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Import: Processing file:', file.name, file.type);

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    let mediaItems: MediaItem[] = [];
    
    // Handle ZIP files
    if (file.name.endsWith('.zip')) {
      try {
        // Import JSZip for proper ZIP extraction
        const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
        const zip = await JSZip.loadAsync(bytes);
        
        // Find and extract CSV files from ZIP
        const csvFiles: string[] = [];
        for (const [filename, fileData] of Object.entries(zip.files)) {
          if (filename.endsWith('.csv') && !fileData.dir) {
            const content = await fileData.async('text');
            csvFiles.push(content);
          }
        }
        
        if (csvFiles.length === 0) {
          throw new Error('No CSV files found in ZIP archive');
        }
        
        // Parse all CSV files found in ZIP
        for (const csvContent of csvFiles) {
          const items = parseImportFile(csvContent, file.name);
          mediaItems.push(...items);
        }
      } catch (zipError) {
        console.error('ZIP extraction error:', zipError);
        throw new Error('Failed to extract CSV from ZIP file: ' + zipError.message);
      }
    } else {
      // Handle CSV files
      const decoder = new TextDecoder('utf-8');
      const csvContent = decoder.decode(bytes);
      mediaItems = parseImportFile(csvContent, file.name);
    }

    console.log('Import: Parsed items:', mediaItems.length);

    if (mediaItems.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No valid items found in file. Please ensure the file contains properly formatted media data.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up system lists once (SAME PATTERN AS track-media)
    const { data: systemLists } = await supabase
      .from('lists')
      .select('id, title')
      .is('user_id', null);

    const listMapping: Record<string, string> = {};
    if (systemLists) {
      for (const list of systemLists) {
        const key = list.title.toLowerCase().replace(/\s+/g, '');
        listMapping[key] = list.id;
      }
    }

    // Insert items in batches (max 100 at a time)
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < mediaItems.length; i += batchSize) {
      const batch = mediaItems.slice(i, i + batchSize);
      
      const insertData = batch.map(item => {
        const listKey = item.listType.toLowerCase().replace(/\s+/g, '');
        const listId = listMapping[listKey] || null;
        
        return {
          list_id: listId,
          user_id: appUser.id,
          title: item.title,
          type: item.mediaType,
          media_type: item.mediaType,
          creator: item.creator || '',
          image_url: item.imageUrl || null,
          notes: item.notes || null,
          rating: item.rating || 0
        };
      });

      const { data, error } = await supabase
        .from('list_items')
        .insert(insertData)
        .select();

      if (error) {
        console.error('Import: Batch insert error:', error);
        errorCount += batch.length;
        errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
      } else {
        successCount += data?.length || 0;
      }
    }

    console.log('Import: Complete. Success:', successCount, 'Errors:', errorCount);

    return new Response(JSON.stringify({
      success: true,
      imported: successCount,
      failed: errorCount,
      total: mediaItems.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Import media error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Import failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
