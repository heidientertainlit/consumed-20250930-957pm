// Make redirect URLs dynamic based on environment
let page = `${Deno.env.get('APP_URL') || 'https://b8e97142-1e2f-4984-85d7-841fe132d810-00-374h314pc4rux.picard.replit.dev'}/`;

// Function to handle invite sharing
async function handleShareInvite(request: Request): Promise<Response> {
  const { id, userId } = await request.json();

  // Make redirect URLs dynamic based on environment
  let page = `${Deno.env.get('APP_URL') || 'https://b8e97142-1e2f-4984-85d7-841fe132d810-00-374h314pc4rux.picard.replit.dev'}/list/${id}?user=${userId}`;

  const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/share-invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page }),
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}

// Function to handle game sharing
async function handleShareGame(request: Request): Promise<Response> {
  const { id } = await request.json();

  // Make game redirect URLs dynamic
  let page = `${Deno.env.get('APP_URL') || 'https://b8e97142-1e2f-4984-85d7-841fe132d810-00-374h314pc4rux.picard.replit.dev'}/play#${id}`;

  const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/share-game", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page }),
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}

// Example of a router or main handler that might use these functions
// This is a hypothetical example based on the context.
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/share-invite") {
      return handleShareInvite(request);
    } else if (pathname === "/share-game") {
      return handleShareGame(request);
    } else {
      // Handle other routes or return a 404
      return new Response("Not Found", { status: 404 });
    }
  },
};