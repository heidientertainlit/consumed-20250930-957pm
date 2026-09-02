import { createHmac, timingSafeEqual } from "crypto";

export type LeaderboardSharePayload = {
  version: 1;
  userId: string;
  displayName: string;
  rank: number;
  categoryId: string;
  categoryLabel: string;
  period: "weekly" | "monthly" | "all_time";
  tab: "engagement" | "consumption" | "games";
  board?: string;
  createdAt: number;
};

const CATEGORY_DETAILS: Record<string, { categoryLabel: string; tab: LeaderboardSharePayload["tab"] }> = {
  overall: { categoryLabel: "Top Engagers", tab: "engagement" },
  total_consumption: { categoryLabel: "Total Consumption", tab: "consumption" },
  books: { categoryLabel: "Books", tab: "consumption" },
  movies: { categoryLabel: "Movies", tab: "consumption" },
  tv: { categoryLabel: "TV", tab: "consumption" },
  music: { categoryLabel: "Music", tab: "consumption" },
  podcasts: { categoryLabel: "Podcasts", tab: "consumption" },
  games: { categoryLabel: "Games", tab: "consumption" },
  youtube: { categoryLabel: "YouTube", tab: "consumption" },
  trivia: { categoryLabel: "Trivia", tab: "games" },
  polls: { categoryLabel: "Polls", tab: "games" },
};

function signingSecret() {
  return process.env.SESSION_SECRET || "";
}

function sign(encodedPayload: string) {
  return createHmac("sha256", signingSecret()).update(encodedPayload).digest("base64url");
}

function categoryDetails(rawCategoryId: unknown) {
  if (typeof rawCategoryId !== "string") return null;
  if (CATEGORY_DETAILS[rawCategoryId]) {
    return { categoryId: rawCategoryId, ...CATEGORY_DETAILS[rawCategoryId] };
  }
  if (/^genre:[a-z0-9][a-z0-9 -]{0,30}$/i.test(rawCategoryId)) {
    const genre = rawCategoryId.slice("genre:".length).trim();
    return {
      categoryId: `genre:${genre.toLowerCase()}`,
      categoryLabel: `Top Engagers · ${genre.charAt(0).toUpperCase()}${genre.slice(1)}`,
      tab: "engagement" as const,
      board: genre.toLowerCase(),
    };
  }
  return null;
}

function entriesForCategory(data: any, categoryId: string): any[] {
  if (categoryId.startsWith("genre:")) {
    const genre = categoryId.slice("genre:".length);
    const board = data?.categories?.genre_engagers?.find(
      (candidate: any) => String(candidate?.genre || "").toLowerCase() === genre,
    );
    return Array.isArray(board?.entries) ? board.entries : [];
  }
  const entries = data?.categories?.[categoryId];
  return Array.isArray(entries) ? entries : [];
}

export function verifyLeaderboardShareToken(token: string): LeaderboardSharePayload | null {
  const secret = signingSecret();
  if (!secret || typeof token !== "string") return null;
  const [encodedPayload, suppliedSignature, extra] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extra) return null;

  const expectedSignature = sign(encodedPayload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    const category = categoryDetails(payload?.categoryId);
    if (
      payload?.version !== 1
      || !/^[0-9a-f-]{36}$/i.test(payload?.userId || "")
      || typeof payload?.displayName !== "string"
      || !Number.isInteger(payload?.rank)
      || payload.rank < 1
      || payload.rank > 10000
      || !category
      || !["weekly", "monthly", "all_time"].includes(payload?.period)
      || payload?.tab !== category.tab
      || payload?.board !== category.board
      || !Number.isFinite(payload?.createdAt)
    ) {
      return null;
    }
    return {
      ...payload,
      categoryId: category.categoryId,
      categoryLabel: category.categoryLabel,
    } as LeaderboardSharePayload;
  } catch {
    return null;
  }
}

export async function handleLeaderboardShareRequest(req: any, res: any) {
  const requestOrigin = typeof req.headers?.origin === "string" ? req.headers.origin : "";
  const rawBase = process.env.VITE_APP_URL || "https://app.consumedapp.com";
  const appBase = (rawBase.startsWith("http") ? rawBase : `https://${rawBase}`).replace(/\/$/, "");
  const developmentShareBase = process.env.NODE_ENV !== "production"
    && /^https?:\/\/[^/]+$/i.test(requestOrigin)
    ? requestOrigin
    : "";
  const shareBase = developmentShareBase || appBase;
  const allowedOrigins = new Set([
    appBase,
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",
  ]);
  if (allowedOrigins.has(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    const token = typeof req.query?.token === "string" ? req.query.token : "";
    const payload = verifyLeaderboardShareToken(token);
    res.setHeader("Cache-Control", "private, no-store");
    return payload
      ? res.status(200).json(payload)
      : res.status(400).json({ error: "Invalid leaderboard share link" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = signingSecret();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const authorization = req.headers?.authorization;
  if (!secret || !supabaseUrl) {
    return res.status(500).json({ error: "Leaderboard sharing is not configured" });
  }
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  let body: any;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ error: "Invalid request body" });
  }
  const category = categoryDetails(body.categoryId);
  const period = ["weekly", "monthly", "all_time"].includes(body.period) ? body.period : null;
  if (!category || !period) {
    return res.status(400).json({ error: "Invalid leaderboard selection" });
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/get-leaderboards?category=all&scope=global&period=${period}`,
    {
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
    },
  );
  if (!response.ok) {
    return res.status(response.status === 401 ? 401 : 502).json({ error: "Could not verify leaderboard rank" });
  }

  const leaderboardData = await response.json();
  const entry = entriesForCategory(leaderboardData, category.categoryId).find(
    (candidate: any) => candidate?.user_id === leaderboardData?.currentUserId,
  );
  if (!entry || !Number.isInteger(entry.rank) || entry.rank < 1) {
    return res.status(404).json({ error: "Your rank is not currently shareable" });
  }

  const payload: LeaderboardSharePayload = {
    version: 1,
    userId: leaderboardData.currentUserId,
    displayName: String(entry.display_name || entry.username || "A friend").slice(0, 35),
    rank: entry.rank,
    categoryId: category.categoryId,
    categoryLabel: category.categoryLabel,
    period,
    tab: category.tab,
    ...(category.board ? { board: category.board } : {}),
    createdAt: Date.now(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const token = `${encodedPayload}.${sign(encodedPayload)}`;
  const viewParams = new URLSearchParams({
    share: token,
    tab: payload.tab,
    period: payload.period,
    ...(payload.board ? { board: payload.board } : {}),
  });

  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({
    url: `${shareBase}/leaderboard?${viewParams.toString()}`,
    share: payload,
  });
}