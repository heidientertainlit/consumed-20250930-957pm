const marker = "__dnaClashFixtureFetchInstalled";
const fixtureWindow = window as typeof window & { [marker]?: boolean };
const localComments: Array<{ id: string; username: string; user_id: string; content: string }> = [];
let nextCommentId = 1;

if (!fixtureWindow[marker]) {
  fixtureWindow[marker] = true;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const json = (body: unknown) => new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    if (url.includes("/functions/v1/prediction-comments")) {
      if (method === "POST") {
        let content = "";
        try {
          content = JSON.parse(String(init?.body || "{}")).content || "";
        } catch {
          content = "";
        }
        const comment = {
          id: `local-comment-${nextCommentId++}`,
          username: "fixture.amber",
          user_id: "fixture-amber",
          content,
        };
        localComments.push(comment);
        return json({ comment });
      }
      if (method === "DELETE") {
        const commentId = new URL(url).searchParams.get("comment_id");
        const index = localComments.findIndex((comment) => comment.id === commentId);
        if (index >= 0) localComments.splice(index, 1);
        return json({ ok: true });
      }
      return json({ comments: localComments });
    }
    if (url.includes("/functions/v1/predictions/predict")) {
      return json({ ok: true });
    }
    if (url.includes("/functions/v1/get-media-details")) {
      return json({ artwork: null });
    }

    // Fail closed: fixture fetch calls never reach the network.
    return new Response(JSON.stringify({ error: "External requests are disabled in the DNA Clash fixture." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  };
}
