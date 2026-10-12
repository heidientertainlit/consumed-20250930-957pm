import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { loadUSCharts } from "../supabase/functions/_shared/us-media-charts";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Preview runs the exact same chart collectors as the Edge Function without
// silently changing the live Supabase backend during local development.
if (process.env.NODE_ENV === "development") {
  let cached: Awaited<ReturnType<typeof loadUSCharts>> | undefined;
  let pending: Promise<Awaited<ReturnType<typeof loadUSCharts>>> | undefined;
  app.get("/api/us-trending-charts", async (_req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const ttl = cached?.source_status.streaming === "available" ? 86400000 : 3600000;
      if (!cached || cached.generated_at.slice(0, 10) !== today || Date.now() - Date.parse(cached.generated_at) >= ttl) {
        if (!pending) {
          pending = loadUSCharts({
            flixKey: process.env.FLIXPATROL_API_KEY, tmdbKey: process.env.TMDB_API_KEY,
            nytKey: process.env.NYT_API_KEY,
          }).finally(() => { pending = undefined; });
        }
        cached = await pending;
      }
      res.json(cached);
    } catch {
      res.status(502).json({ error: "Could not load US charts.", items: [] });
    }
  });
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
