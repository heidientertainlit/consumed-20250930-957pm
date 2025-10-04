import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { pollsDb } from "./polls-db";
// Removed unnecessary imports - simplified for minimal backend

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

  // Removed: Create consumption log - Now handled by Supabase track-media edge function

  // Get user's consumption stats
  app.get("/api/users/:userId/consumption/stats", async (req, res) => {
    try {
      const stats = await storage.getUserConsumptionStats(req.params.userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch consumption stats" });
    }
  });

  // Removed: Get activity feed - Not used by frontend

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

  // Removed: Get Entertainment DNA survey questions - Not used by frontend


  // Temporary route to return correct lists until Supabase edge function is deployed
  app.get("/api/user-lists-with-media", async (req, res) => {
    try {
      // Return the correct 4 standard lists structure that matches Supabase
      const listsData = {
        lists: [
          {
            id: 'all',
            title: 'All',
            description: 'All tracked media items',
            items: []
          },
          {
            id: 'currently',
            title: 'Currently',
            description: 'What you\'re consuming right now',
            items: []
          },
          {
            id: 'queue',
            title: 'Queue',
            description: 'Media you want to consume later',
            items: []
          },
          {
            id: 'finished',
            title: 'Finished',
            description: 'Media you\'ve completed',
            items: []
          },
          {
            id: 'dnf',
            title: 'Did Not Finish',
            description: 'Media you started but didn\'t complete',
            items: []
          }
        ]
      };
      res.json(listsData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user lists" });
    }
  });

  // Polls API endpoints
  
  // Get active polls
  app.get("/api/polls", async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const polls = await pollsDb.getActivePolls(userId);
      res.json(polls);
    } catch (error) {
      console.error('Fetch polls error:', error);
      res.status(500).json({ message: "Failed to fetch polls" });
    }
  });

  // Submit a vote for a poll
  app.post("/api/polls/:pollId/vote", async (req, res) => {
    try {
      const { pollId } = req.params;
      const { optionId, userId } = req.body;

      if (!optionId || !userId) {
        return res.status(400).json({ message: "optionId and userId are required" });
      }

      // Verify that the option belongs to this poll
      const optionValid = await pollsDb.verifyOptionBelongsToPoll(parseInt(optionId), parseInt(pollId));
      if (!optionValid) {
        return res.status(400).json({ message: "Invalid option for this poll" });
      }

      // Check if user already voted
      const existingVote = await pollsDb.getUserPollResponse(parseInt(pollId), userId);
      if (existingVote) {
        return res.status(400).json({ message: "You have already voted in this poll" });
      }

      // Submit the vote
      await pollsDb.createPollResponse({
        pollId: parseInt(pollId),
        optionId: parseInt(optionId),
        userId
      });

      // Award points for poll participation
      const poll = await pollsDb.getPollWithResults(parseInt(pollId));
      const pointsToAward = poll.points_reward || 5;
      
      // Update user points (add to all_time points)
      await sql`
        INSERT INTO user_points (user_id, category, points)
        VALUES (${userId}, 'all_time', ${pointsToAward})
        ON CONFLICT (user_id, category)
        DO UPDATE SET points = user_points.points + ${pointsToAward}
      `;

      res.json({ ...poll, pointsAwarded: pointsToAward });
    } catch (error) {
      console.error('Vote submission error:', error);
      res.status(500).json({ message: "Failed to submit vote" });
    }
  });

  // Create a new poll (admin only)
  app.post("/api/polls", async (req, res) => {
    try {
      // TODO: Add proper admin authentication check
      // For now, this endpoint should only be called by admin users
      // Consider using req.headers.authorization to verify admin status
      const { question, type, sponsorName, sponsorLogoUrl, sponsorCtaUrl, pointsReward, expiresAt, options } = req.body;

      if (!question || !type || !options || !Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ message: "Invalid poll data. Question, type, and at least 2 options are required" });
      }

      const pollId = await pollsDb.createPoll({
        question,
        type,
        sponsorName: sponsorName || null,
        sponsorLogoUrl: sponsorLogoUrl || null,
        sponsorCtaUrl: sponsorCtaUrl || null,
        status: 'active',
        pointsReward: pointsReward || 5,
        expiresAt: expiresAt || null,
        createdBy: null
      }, options);

      const poll = await pollsDb.getPollWithResults(pollId);
      res.json(poll);
    } catch (error) {
      console.error('Create poll error:', error);
      res.status(500).json({ message: "Failed to create poll" });
    }
  });

  // Update poll status (admin only)
  app.patch("/api/polls/:pollId", async (req, res) => {
    try {
      // TODO: Add proper admin authentication check
      // For now, this endpoint should only be called by admin users
      // Consider using req.headers.authorization to verify admin status
      const { pollId } = req.params;
      const { status } = req.body;

      if (!status || !['draft', 'active', 'archived'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'draft', 'active', or 'archived'" });
      }

      await pollsDb.updatePollStatus(parseInt(pollId), status);
      const poll = await pollsDb.getPollWithResults(parseInt(pollId));
      
      res.json(poll);
    } catch (error) {
      console.error('Update poll error:', error);
      res.status(500).json({ message: "Failed to update poll" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
