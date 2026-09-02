import { handleLeaderboardShareRequest } from "../server/leaderboard-share.js";

export default async function handler(req: any, res: any) {
  try {
    return await handleLeaderboardShareRequest(req, res);
  } catch (error) {
    console.error("[leaderboard share]", error);
    return res.status(500).json({ error: "Could not create leaderboard share" });
  }
}