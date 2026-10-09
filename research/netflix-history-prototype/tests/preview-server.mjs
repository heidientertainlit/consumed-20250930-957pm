// Optional verification server: serves only the extension's static assets.
// No app imports, env loading, database access, build, or backend integration.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const allowed = new Set(["popup.html", "popup.css", "popup.js", "history-model.js", "history-reader.js"]);
const types = { html: "text/html", css: "text/css", js: "text/javascript" };
export function createPreviewServer() {
  return createServer(async (req, res) => {
    const path = new URL(req.url, "http://preview.invalid").pathname.slice(1);
    if (!allowed.has(path)) {
      res.writeHead(404).end("Not found");
      return;
    }
    try {
      const data = await readFile(new URL(`../extension/${path}`, import.meta.url));
      res.writeHead(200, {
        "Content-Type": `${types[path.split(".").pop()]} ; charset=utf-8`,
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
      }).end(data);
    } catch {
      res.writeHead(500).end("Static preview unavailable");
    }
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  createPreviewServer().listen(5188, "0.0.0.0", () => console.log("Isolated extension preview listening on 5188"));
}
