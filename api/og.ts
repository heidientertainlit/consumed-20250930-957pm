import express from "express";
import { createClient } from "@supabase/supabase-js";
import { registerOpenGraphRoutes } from "../server/open-graph";

const app = express();
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

registerOpenGraphRoutes(app, createClient(supabaseUrl, supabaseKey));

app.use((_req, res) => {
  res.status(404).end();
});

export default function handler(req: any, res: any) {
  const incoming = new URL(req.url || "/", "https://app.consumedapp.com");
  const requestedPath = incoming.searchParams.get("path") || "/";
  const previewPath = requestedPath.startsWith("/") ? requestedPath : `/${requestedPath}`;

  incoming.searchParams.delete("path");
  const query = incoming.searchParams.toString();
  req.url = `${previewPath}${query ? `?${query}` : ""}`;
  delete req._parsedUrl;
  delete req._parsedOriginalUrl;

  return app(req, res);
}