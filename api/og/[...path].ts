import express from "express";
import { createClient } from "@supabase/supabase-js";
import { registerOpenGraphRoutes } from "../../server/open-graph";

const app = express();
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

registerOpenGraphRoutes(app, createClient(supabaseUrl, supabaseKey));

app.use((_req, res) => {
  res.status(404).end();
});

export default function handler(req: any, res: any) {
  const incoming = new URL(req.url || "/", "https://app.consumedapp.com");
  const previewPath = incoming.pathname.replace(/^\/api\/og/, "") || "/";

  req.url = `${previewPath}${incoming.search}`;
  delete req._parsedUrl;
  delete req._parsedOriginalUrl;

  return app(req, res);
}