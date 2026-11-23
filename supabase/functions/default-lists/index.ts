// Retired deployed-only writer. Do not recreate per-media or Queue system lists.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(req => new Response(req.method === "OPTIONS" ? "ok" : JSON.stringify({
  error: "This legacy list-creation route is retired. Use the five standard lists.",
}), {
  status: req.method === "OPTIONS" ? 200 : 410,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  },
}));
