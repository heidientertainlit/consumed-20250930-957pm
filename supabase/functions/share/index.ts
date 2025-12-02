
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function esc(s = "") {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;")
                  .replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "default";
  const id = url.searchParams.get("id") || "";
  const userId = url.searchParams.get("user_id") || "";

  // DB: service role for read access (public preview), no auth needed
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Defaults
  let title = "consumed";
  let desc = "Entertainment finally pays off.";
  let img = `${url.origin}/og-default.png`;
  let page = `${url.origin}/`;

  try {
    switch (type) {
      case "post": {
        const { data } = await supabase
          .from("social_posts")
          .select("id, content, media_title, media_image_url, user_id")
          .eq("id", id)
          .single();
        
        if (data) {
          // Get username
          const { data: user } = await supabase
            .from("users")
            .select("user_name, email")
            .eq("id", data.user_id)
            .single();
          
          const username = user?.user_name || user?.email?.split("@")[0] || "Someone";
          
          title = data.media_title ? `${username} shared: ${data.media_title}` : `${username}'s post on consumed`;
          desc = data.content || "Check out this entertainment update";
          img = data.media_image_url || img;
          page = `${url.origin}/feed#${data.id}`;
        }
        break;
      }
      
      case "list": {
        // Handle list sharing with user context
        if (userId) {
          const { data: user } = await supabase
            .from("users")
            .select("user_name, email")
            .eq("id", userId)
            .single();
          
          const username = user?.user_name || user?.email?.split("@")[0] || "Someone";
          
          // Map slug to title
          const slugToTitle = {
            'currently': 'Currently',
            'queue': 'Want To',
            'finished': 'Finished',
            'did-not-finish': 'Did Not Finish',
            'all': 'All'
          };
          
          const listTitle = slugToTitle[id as keyof typeof slugToTitle] || id;
          
          title = `${username}'s ${listTitle} List`;
          desc = `See what ${username} is consuming on their ${listTitle} list`;
          page = `${url.origin}/list/${id}?user=${userId}`;
        }
        break;
      }
      
      case "dna": {
        // Entertainment DNA profile sharing
        if (userId) {
          const { data: user } = await supabase
            .from("users")
            .select("user_name, email")
            .eq("id", userId)
            .single();
          
          const username = user?.user_name || user?.email?.split("@")[0] || "Someone";
          
          title = `${username}'s Entertainment DNA`;
          desc = `Discover ${username}'s entertainment personality and see what they love to watch, read, and play`;
          page = `${url.origin}/dna/${userId}`;
        }
        break;
      }
      
      case "pool": {
        const { data } = await supabase
          .from("prediction_pools")
          .select("id, title, description, category")
          .eq("id", id)
          .single();
        
        if (data) {
          title = data.title || "Prediction Game";
          desc = data.description || "Join this prediction game on consumed";
          page = `${url.origin}/play#${data.id}`;
        }
        break;
      }
      
      case "invite": {
        // General app invite
        title = "Join me on consumed!";
        desc = "Track your entertainment, make predictions, and share what you're watching, reading, and playing";
        page = `${url.origin}/`;
        break;
      }
      
      default:
        // Keep defaults
        break;
    }
  } catch (error) {
    console.error("Share function error:", error);
    // Fall back to defaults on any DB error
  }

  // Normalize absolute HTTPS image URL
  if (img && !/^https?:\/\//i.test(img)) {
    img = `${url.origin}${img.startsWith("/") ? "" : "/"}${img}`;
  }

  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>

<!-- Open Graph -->
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${esc(page)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="consumed">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">

<!-- Immediate redirect for humans -->
<meta http-equiv="refresh" content="0; url=${esc(page)}">
<script>location.replace(${JSON.stringify(page)});</script>

<noscript>
  <p>Redirecting to <a href="${esc(page)}">${esc(title)}</a>...</p>
</noscript>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=600"
    }
  });
});
