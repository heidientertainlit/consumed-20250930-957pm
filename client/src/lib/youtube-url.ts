export type ParsedYouTubeUrl = {
  id: string;
  subtype: "video" | "channel" | "handle";
  url: string;
};

export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  const match = input.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0].replace(/[),.!?]+$/, ""));
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!["youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) return null;
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? { id, subtype: "video", url: `https://www.youtube.com/watch?v=${id}` } : null;
    }
    const watchId = url.searchParams.get("v");
    if (watchId) return { id: watchId, subtype: "video", url: `https://www.youtube.com/watch?v=${watchId}` };
    const parts = url.pathname.split("/").filter(Boolean);
    if (["shorts", "live", "embed"].includes(parts[0]) && parts[1]) {
      return { id: parts[1], subtype: "video", url: `https://www.youtube.com/watch?v=${parts[1]}` };
    }
    if (parts[0] === "channel" && parts[1]) {
      return { id: parts[1], subtype: "channel", url: `https://www.youtube.com/channel/${parts[1]}` };
    }
    if (parts[0]?.startsWith("@")) {
      return { id: parts[0], subtype: "handle", url: `https://www.youtube.com/${parts[0]}` };
    }
    return null;
  } catch {
    return null;
  }
}