import { describe, expect, it } from "vitest";
import { parseYouTubeUrl } from "../lib/youtube-url";

describe("parseYouTubeUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=zfPhcXvWdGM", "zfPhcXvWdGM", "video"],
    ["https://youtu.be/zfPhcXvWdGM?si=abc", "zfPhcXvWdGM", "video"],
    ["https://www.youtube.com/live/zfPhcXvWdGM?si=abc", "zfPhcXvWdGM", "video"],
    ["https://youtube.com/shorts/zfPhcXvWdGM", "zfPhcXvWdGM", "video"],
    ["https://www.youtube.com/embed/zfPhcXvWdGM", "zfPhcXvWdGM", "video"],
    ["https://www.youtube.com/channel/UC1234567890123456789012", "UC1234567890123456789012", "channel"],
    ["https://www.youtube.com/@CrimeWeeklyPodcast", "@CrimeWeeklyPodcast", "handle"],
  ])("parses %s", (url, id, subtype) => {
    expect(parseYouTubeUrl(url)).toMatchObject({ id, subtype });
  });

  it("extracts a supported link from reply text", () => {
    expect(parseYouTubeUrl("Following this one: https://www.youtube.com/live/zfPhcXvWdGM?si=test")).toMatchObject({
      id: "zfPhcXvWdGM",
      subtype: "video",
    });
  });

  it("does not classify ordinary links as media", () => {
    expect(parseYouTubeUrl("More context: https://www.wbur.org/news/2026/08/25/example")).toBeNull();
  });
});