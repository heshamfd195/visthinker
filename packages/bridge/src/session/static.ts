import { readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The built canvas, `apps/canvas/dist`, next to this package in the repo. */
export const DEFAULT_CANVAS_DIR = fileURLToPath(
  new URL("../../../../apps/canvas/dist/", import.meta.url),
);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

const PLACEHOLDER = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Visthinker</title></head>
<body style="font-family:system-ui;margin:3rem;max-width:40rem">
<h1>Visthinker bridge is running</h1>
<p>The canvas is not built yet. Run <code>pnpm build</code> in the repo, then reload this page.</p>
</body></html>
`;

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Serves the built canvas, or a placeholder page when it isn't built. */
export function serveCanvas(canvasDir: string) {
  const root = resolve(canvasDir);
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, headers).end();
      return;
    }
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
    } catch {
      res.writeHead(400, headers).end();
      return;
    }
    const wanted = join(root, normalize(pathname));
    const inside = wanted === root || wanted.startsWith(root + sep);
    const index = join(root, "index.html");
    // Unknown paths fall back to index.html (a single-page app).
    const file =
      inside && (await isFile(wanted)) ? wanted : (await isFile(index)) ? index : undefined;
    if (!file) {
      res
        .writeHead(200, { ...headers, "Content-Type": TYPES[".html"] })
        .end(req.method === "HEAD" ? undefined : PLACEHOLDER);
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      ...headers,
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  };
}
