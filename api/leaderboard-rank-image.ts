import { handleLeaderboardRankImageRequest } from "../server/leaderboard-rank-image.js";

export default async function handler(req: any, res: any) {
  try {
    return await handleLeaderboardRankImageRequest(req, res);
  } catch (error) {
    console.error("[leaderboard rank image]", error);
    return res.status(500).json({ error: "Could not create leaderboard image" });
  }
}