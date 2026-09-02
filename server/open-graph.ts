import type { Express, NextFunction, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

type OpenGraphTags = {
  title: string;
  description: string;
  image?: string | null;
  url: string;
};

type CachedTags = {
  expiresAt: number;
  tags: OpenGraphTags;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const previewCache = new Map<string, CachedTags>();

const tribeCopy: Record<string, { title: string; description: string }> = {
  overall: {
    title: "People who share your taste across entertainment",
    description: "See the shows, books, movies, and more that connect this group on Consumed.",
  },
  books: {
    title: "People who share your taste in books",
    description: "See the books that connect this group and discover what they love on Consumed.",
  },
  movies: {
    title: "People who share your taste in movies",
    description: "See the films that connect this group and discover what they love on Consumed.",
  },
  shows: {
    title: "People who share your taste in TV",
    description: "See the shows that connect this group and discover what they love on Consumed.",
  },
  music: {
    title: "People who share your taste in music",
    description: "See the artists and sounds that connect this group on Consumed.",
  },
  podcasts: {
    title: "People who share your taste in podcasts",
    description: "See the voices and ideas that connect this group on Consumed.",
  },
  games: {
    title: "People who share your taste in games",
    description: "See what this group loves to play and discover your next game on Consumed.",
  },
  youtube: {
    title: "People who share your taste on YouTube",
    description: "See the creators and rabbit holes that connect this group on Consumed.",
  },
  genres: {
    title: "People who love the same genres",
    description: "See the stories and worlds that connect this group on Consumed.",
  },
  titles: {
    title: "People who love the same titles",
    description: "See the specific favorites that connect this group on Consumed.",
  },
  ratings: {
    title: "People who rate things like you do",
    description: "See where this group's ratings align and join the conversation on Consumed.",
  },
  comfort: {
    title: "People with similar comfort favorites",
    description: "See the familiar favorites this group returns to on Consumed.",
  },
  recent: {
    title: "People who are into what you're into lately",
    description: "See what this group is tracking and discussing right now on Consumed.",
  },
  general: {
    title: "People who are into what you're into",
    description: "See what connects this taste group and discover more on Consumed.",
  },
};

function compactText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function appBase(): string {
  const configured = process.env.VITE_APP_URL || "https://app.consumedapp.com";
  const withProtocol = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
  return withProtocol.replace(/\/+$/, "");
}

function absoluteHttpUrl(value: unknown, base = appBase()): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim(), base);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function requestUrl(req: Request): string {
  return `${appBase()}${req.originalUrl}`;
}

function readIndexHtml(): string {
  const candidates = process.env.NODE_ENV === "production"
    ? [
        path.resolve(process.cwd(), "dist", "public", "index.html"),
        path.resolve(process.cwd(), "server", "public", "index.html"),
        path.resolve(process.cwd(), "client", "index.html"),
      ]
    : [
        path.resolve(process.cwd(), "client", "index.html"),
        path.resolve(process.cwd(), "dist", "public", "index.html"),
      ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return fs.readFileSync(candidate, "utf-8");
    } catch {
      // Try the next app-shell location.
    }
  }
  return "";
}

function injectOpenGraphTags(html: string, rawTags: OpenGraphTags): string {
  const fallbackImage = `${appBase()}/og-consumed-share-20260901-v3-1200x630.png`;
  const title = escapeHtml(compactText(rawTags.title, 90) || "Consumed");
  const description = escapeHtml(
    compactText(rawTags.description, 200)
      || "Track what you watch, read, and listen to. Discover what connects you on Consumed.",
  );
  const image = escapeHtml(absoluteHttpUrl(rawTags.image) || fallbackImage);
  const url = escapeHtml(absoluteHttpUrl(rawTags.url) || appBase());
  const tags = `
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${title}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Consumed" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <link rel="canonical" href="${url}" />
    <title>${title}</title>`;

  const withoutExistingMetadata = html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\b[^>]*(?:name|property)=["'](?:description|og:[^"']+|twitter:[^"']+)["'][^>]*\/?>/gi, "")
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*\/?>/gi, "");

  return withoutExistingMetadata.replace("</head>", `${tags}\n  </head>`);
}

function cached(key: string): OpenGraphTags | null {
  const item = previewCache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    previewCache.delete(key);
    return null;
  }
  return item.tags;
}

function cache(key: string, tags: OpenGraphTags): OpenGraphTags {
  if (previewCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = previewCache.keys().next().value;
    if (oldest) previewCache.delete(oldest);
  }
  previewCache.set(key, { tags, expiresAt: Date.now() + CACHE_TTL_MS });
  return tags;
}

function responseTags(
  req: Request,
  values: Omit<OpenGraphTags, "url"> & { url?: string },
): OpenGraphTags {
  return {
    ...values,
    url: values.url || requestUrl(req),
  };
}

function sendPreview(res: Response, next: NextFunction, tags: OpenGraphTags): void {
  const html = readIndexHtml() || "<!doctype html><html><head></head><body></body></html>";
  res
    .status(200)
    .set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    })
    .end(injectOpenGraphTags(html, tags));
}

async function findPublicMedia(
  supabase: SupabaseClient,
  source: string,
  externalId: string,
): Promise<{ title?: string; creator?: string; image?: string } | null> {
  const { data: listItem } = await supabase
    .from("list_items")
    .select("title,creator,image_url,lists!inner(visibility,is_private)")
    .eq("external_source", source)
    .eq("external_id", externalId)
    .eq("lists.visibility", "public")
    .eq("lists.is_private", false)
    .limit(1)
    .maybeSingle();

  if (listItem?.title) {
    return { title: listItem.title, creator: listItem.creator, image: listItem.image_url };
  }

  const { data: post } = await supabase
    .from("social_posts")
    .select("media_title,media_creator,image_url")
    .eq("media_external_source", source)
    .eq("media_external_id", externalId)
    .eq("visibility", "public")
    .not("media_title", "is", null)
    .limit(1)
    .maybeSingle();

  return post?.media_title
    ? { title: post.media_title, creator: post.media_creator, image: post.image_url }
    : null;
}

export function registerOpenGraphRoutes(app: Express, supabase: SupabaseClient): void {
  const route = (
    pathPattern: string | RegExp,
    resolve: (req: Request) => Promise<OpenGraphTags>,
  ) => {
    app.get(pathPattern, async (req, res, next) => {
      try {
        const key = req.originalUrl;
        const tags = cached(key) || cache(key, await resolve(req));
        sendPreview(res, next, tags);
      } catch {
        next();
      }
    });
  };

  route("/invite/:userId", async (req) => {
    const { data: user } = await supabase
      .from("users")
      .select("display_name,user_name")
      .eq("id", req.params.userId)
      .maybeSingle();
    const name = compactText(user?.display_name || user?.user_name, 45) || "your friend";
    return responseTags(req, {
      title: "What’s your Entertainment DNA?",
      description: `Join ${name} on Consumed to see what everyone’s watching, reading, and listening to — and compare your Entertainment DNA.`,
    });
  });

  route("/u/:userId", async (req) => {
    const { data: user } = await supabase
      .from("users")
      .select("display_name,user_name,avatar")
      .eq("id", req.params.userId)
      .maybeSingle();
    const name = compactText(user?.display_name || user?.user_name, 45) || "A Consumed member";
    return responseTags(req, {
      title: `${name}'s entertainment profile`,
      description: `See what ${name} is watching, reading, and listening to—and compare your taste on Consumed.`,
      image: user?.avatar,
    });
  });

  const poolHandler = async (req: Request): Promise<OpenGraphTags> => {
    const { data: pool } = await supabase
      .from("pools")
      .select("title,description")
      .eq("invite_code", req.params.code)
      .maybeSingle();
    const title = compactText(pool?.title, 60) || "a prediction room";
    return responseTags(req, {
      title: `Join ${title} on Consumed`,
      description: compactText(pool?.description, 150) || "Make your picks, compare answers, and play with friends on Consumed.",
    });
  };
  route("/pool/join/:code", poolHandler);
  route("/room/join/:code", poolHandler);

  route("/post/:id", async (req) => {
    const { data: post } = await supabase
      .from("social_posts")
      .select("user_id,post_type,rating,media_title,media_creator,image_url,visibility")
      .eq("id", req.params.id)
      .eq("visibility", "public")
      .maybeSingle();

    if (!post) {
      return responseTags(req, {
        title: "See this take on Consumed",
        description: "Read the take and join the conversation on Consumed.",
      });
    }

    const { data: user } = await supabase
      .from("users")
      .select("display_name,user_name")
      .eq("id", post.user_id)
      .maybeSingle();
    const name = compactText(user?.display_name || user?.user_name, 40) || "Someone";
    const mediaTitle = compactText(post.media_title, 60);
    const headline = mediaTitle
      ? `${name} shared a take on ${mediaTitle}`
      : `${name} shared a take`;

    return responseTags(req, {
      title: headline,
      description: "See the full take and join the conversation on Consumed.",
      image: post.image_url,
    });
  });

  const mediaHandler = async (req: Request): Promise<OpenGraphTags> => {
    const source = req.params.source;
    const externalId = req.params.prefix
      ? `${req.params.prefix}/${req.params.id}`
      : req.params.id;
    const media = await findPublicMedia(supabase, source, externalId);
    const title = compactText(media?.title, 65);
    const creator = compactText(media?.creator, 55);
    return responseTags(req, {
      title: title || "Discover this title on Consumed",
      description: title
        ? `See ratings, takes, and taste context for ${title}${creator ? ` by ${creator}` : ""} on Consumed.`
        : "See ratings, takes, and taste context—and decide whether it belongs on your list.",
      image: media?.image,
    });
  };
  route("/media/:type/:source/:id", mediaHandler);
  route("/media/:type/:source/:prefix/:id", mediaHandler);

  route("/people/tribes/:tribeId", async (req) => {
    const kind = typeof req.query.preview === "string" && tribeCopy[req.query.preview]
      ? req.query.preview
      : "general";
    return responseTags(req, tribeCopy[kind]);
  });

  route("/list/:id", async (req) => {
    const userId = typeof req.query.user === "string" ? req.query.user : "";
    let list: any = null;

    if (/^\d+$/.test(req.params.id) || /^[0-9a-f-]{32,36}$/i.test(req.params.id)) {
      const result = await supabase
        .from("lists")
        .select("id,title,description,visibility,is_private")
        .eq("id", req.params.id)
        .maybeSingle();
      list = result.data;
    } else if (userId) {
      const { data: lists } = await supabase
        .from("lists")
        .select("id,title,description,visibility,is_private")
        .eq("user_id", userId);
      const slug = decodeURIComponent(req.params.id).toLowerCase();
      list = lists?.find((item: any) => item.title?.toLowerCase().replace(/\s+/g, "-") === slug);
    }

    if (!list || list.visibility !== "public" || list.is_private !== false) {
      return responseTags(req, {
        title: "A shared entertainment list",
        description: "Explore the list and find something new to watch, read, listen to, or play on Consumed.",
      });
    }

    const { data: cover } = await supabase
      .from("list_items")
      .select("image_url")
      .eq("list_id", list.id)
      .not("image_url", "is", null)
      .limit(1)
      .maybeSingle();
    const title = compactText(list.title, 70) || "A shared entertainment list";
    return responseTags(req, {
      title,
      description: compactText(list.description, 150) || `Explore ${title} and find your next favorite on Consumed.`,
      image: cover?.image_url,
    });
  });

  route("/rank/:id", async (req) => {
    const { data: rank } = await supabase
      .from("ranks")
      .select("id,title,description,visibility,cover_image_url")
      .eq("id", req.params.id)
      .eq("visibility", "public")
      .maybeSingle();

    if (!rank) {
      return responseTags(req, {
        title: "A shared ranking on Consumed",
        description: "See what made the list and compare how you would rank it on Consumed.",
      });
    }

    let image = rank.cover_image_url;
    if (!image) {
      const { data: firstItem } = await supabase
        .from("rank_items")
        .select("image_url")
        .eq("rank_id", rank.id)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      image = firstItem?.image_url;
    }
    const title = compactText(rank.title, 70) || "A shared ranking";
    return responseTags(req, {
      title,
      description: compactText(rank.description, 150) || `See what made ${title} and compare your ranking on Consumed.`,
      image,
    });
  });

  route("/edna/:id", async (req) => {
    const userId = typeof req.query.user === "string" ? req.query.user : req.params.id;
    const isCompareInvite = req.query.compare === "1";
    const [{ data: profile }, { data: user }] = await Promise.all([
      supabase
        .from("dna_profiles")
        .select("label,tagline,is_private")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("users")
        .select("display_name,user_name,avatar")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    const name = compactText(user?.display_name || user?.user_name, 40);
    if (isCompareInvite) {
      return responseTags(req, {
        title: `Compare your Entertainment DNA with ${name || "me"}`,
        description: "Reveal your match on Consumed.",
        image: user?.avatar,
      });
    }
    const label = profile?.is_private ? "" : compactText(profile?.label, 65);
    const tagline = profile?.is_private ? "" : compactText(profile?.tagline, 135);
    if (profile?.is_private) {
      return responseTags(req, {
        title: "Entertainment DNA on Consumed",
        description: "Build your Entertainment DNA and discover what your taste says about you.",
      });
    }
    return responseTags(req, {
      title: label
        ? `${name ? `${name} is ` : ""}${label}`
        : `${name ? `${name}'s` : "An"} Entertainment DNA`,
      description: tagline || "Discover the entertainment taste behind the profile and compare your DNA on Consumed.",
      image: user?.avatar,
    });
  });

  route("/leaderboard", async (req) => responseTags(req, {
    title: "See who's leading on Consumed",
    description: "Compare your entertainment stats, climb the leaderboard, and challenge your friends.",
  }));

  route(/^\/play(?:\/.*)?$/, async (req) => {
    const result = req.query.result;
    const title = result === "right"
      ? "I got it right — see how you score"
      : result === "wrong"
        ? "I got it wrong — see how you score"
        : "Play together on Consumed";
    const imageName = result === "right"
      ? "og-play-challenge-v5-right-1200x630.png"
      : result === "wrong"
        ? "og-play-challenge-v5-wrong-1200x630.png"
        : "og-play-challenge-v5-1200x630.png";
    return responseTags(req, {
      title,
      description: result === "right" || result === "wrong"
        ? "Play the same question on Consumed and compare results. No answer spoilers."
        : "Answer trivia, make predictions, and challenge friends who love the same entertainment.",
      image: `${appBase()}/${imageName}`,
    });
  });
}