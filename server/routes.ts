import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConsumptionLogSchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function registerRoutes(app: Express): Promise<Server> {

  // Get user
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });


  // Get user's consumption logs
  app.get("/api/users/:userId/consumption", async (req, res) => {
    try {
      const logs = await storage.getConsumptionLogs(req.params.userId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch consumption logs" });
    }
  });

  // Create consumption log
  app.post("/api/consumption", async (req, res) => {
    try {
      const logData = insertConsumptionLogSchema.parse({
        ...req.body,
        userId: "user-1", // Mock user for now
        consumedAt: req.body.consumedAt ? new Date(req.body.consumedAt) : new Date(),
      });

      const log = await storage.createConsumptionLog(logData);
      res.status(201).json(log);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid consumption log data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create consumption log" });
    }
  });

  // Get user's consumption stats
  app.get("/api/users/:userId/consumption/stats", async (req, res) => {
    try {
      const stats = await storage.getUserConsumptionStats(req.params.userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch consumption stats" });
    }
  });

  // Get activity feed (all consumption logs)
  app.get("/api/consumption/feed", async (req, res) => {
    try {
      const feed = await storage.getActivityFeed();
      res.json(feed);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activity feed" });
    }
  });

  // Get personalized recommendations
  app.get("/api/users/:userId/recommendations", async (req, res) => {
    try {
      const logs = await storage.getConsumptionLogs(req.params.userId);
      
      // For now, return curated recommendations based on consumption history
      // TODO: Re-enable AI recommendations when OpenAI API is stable
      const recommendations = logs.length === 0 ? [
        {
          id: "rec-1",
          title: "The Bear",
          category: "tv",
          description: "A young chef from the fine dining world returns to Chicago to run his family's sandwich shop.",
          reason: "Popular comedy-drama that's perfect for getting started"
        },
        {
          id: "rec-2",
          title: "Dune",
          category: "books",
          description: "Epic science fiction novel about politics, religion, and power on a desert planet.",
          reason: "Essential sci-fi reading that's influenced countless other works"
        },
        {
          id: "rec-3",
          title: "Everything Everywhere All at Once",
          category: "movies",
          description: "A multiverse adventure about family, identity, and everything bagels.",
          reason: "Award-winning film that blends humor with profound themes"
        }
      ] : [
        {
          id: "rec-4",
          title: "House of the Dragon",
          category: "tv", 
          description: "Prequel to Game of Thrones following the Targaryen civil war.",
          reason: "Based on your viewing history, you might enjoy this epic fantasy series"
        },
        {
          id: "rec-5",
          title: "Project Hail Mary",
          category: "books",
          description: "A lone astronaut must save humanity in this sci-fi thriller.",
          reason: "Perfect follow-up to your recent reading preferences"
        },
        {
          id: "rec-6",
          title: "The Banshees of Inisherin",
          category: "movies",
          description: "Dark comedy about friendship on a remote Irish island.",
          reason: "Matches your taste for character-driven stories"
        }
      ];
      
      return res.json(recommendations);
    } catch (error) {
      console.error('Recommendations error:', error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
