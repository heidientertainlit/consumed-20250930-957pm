import { ResearchError, validateResearchInput, runResearch, type ResearchServices } from "./content-research.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
export function researchHandler(deps: {
  authorize(req: Request): Promise<{ authorized: boolean; caller?: string; userId?: string; status?: number }>;
  limit(userId: string, action: string): Promise<boolean>;
  services(req: Request): ResearchServices;
}) {
  return async (req: Request) => {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (req.method === "OPTIONS") return json({});
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    try {
      const auth = await deps.authorize(req);
      if (!auth.authorized) return json({ error: "Admin sign-in required" }, auth.status || 403);
      if (auth.caller !== "admin" || !auth.userId) return json({ error: "A human admin session is required" }, 403);
      if (Number(req.headers.get("content-length") || 0) > 16000) return json({ error: "Request too large" }, 413);
      const raw = await req.text();
      if (raw.length > 16000) return json({ error: "Request too large" }, 413);
      let body;
      try { body = JSON.parse(raw); } catch { throw new ResearchError("A JSON request body is required"); }
      const input = validateResearchInput(body);
      if (!await deps.limit(auth.userId, input.action)) return new Response(JSON.stringify({ error: "Research request limit reached. Try again in an hour." }), { status: 429, headers: { ...headers, "Retry-After": "3600" } });
      return json(await runResearch(input, deps.services(req)));
    } catch (error) {
      return json({ error: error instanceof ResearchError ? error.message : "Research is unavailable. Please retry." }, error instanceof ResearchError ? error.status : 503);
    }
  };
}
