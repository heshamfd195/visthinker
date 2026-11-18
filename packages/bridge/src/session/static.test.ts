import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { request, type IncomingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { HOST, Session } from "./session.ts";

let canvasDir: string;
const sessions: Session[] = [];

beforeAll(async () => {
  canvasDir = await mkdtemp(join(tmpdir(), "visthinker-canvas-"));
  await mkdir(join(canvasDir, "assets"));
  await writeFile(join(canvasDir, "index.html"), "<!doctype html><title>Visthinker</title>");
  await writeFile(join(canvasDir, "assets", "app.js"), "console.log(1)");
});

afterEach(async () => {
  for (const s of sessions.splice(0)) await s.close();
});

async function start(dir = canvasDir) {
  const session = await Session.start({ canvasDir: dir });
  sessions.push(session);
  return session;
}

function get(session: Session, path: string, opts: { method?: string; host?: string } = {}) {
  return new Promise<{ status?: number; headers: IncomingHttpHeaders; body: string }>((resolve) => {
    const req = request(
      {
        host: HOST,
        port: session.port,
        path,
        method: opts.method ?? "GET",
        headers: { Host: opts.host ?? `${HOST}:${session.port}` },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      },
    );
    req.end();
  });
}

describe("serving the canvas (T17)", () => {
  it("serves index.html at the link, token and all", async () => {
    const session = await start();
    const res = await get(session, `/?ws=${session.port}&token=${session.token}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.body).toContain("<title>Visthinker</title>");
  });

  it("serves assets with their type, never cached, never sniffed", async () => {
    const res = await get(await start(), "/assets/app.js");
    expect(res.headers["content-type"]).toMatch(/text\/javascript/);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("never serves a file outside the canvas folder", async () => {
    const res = await get(await start(), "/../../../../etc/passwd");
    expect(res.body).toContain("<title>Visthinker</title>");
    expect(res.body).not.toContain("root:");
  });

  it("only reads: other methods get 405", async () => {
    expect((await get(await start(), "/", { method: "POST" })).status).toBe(405);
  });

  it("shows how to build the canvas when it isn't built", async () => {
    const empty = await mkdtemp(join(tmpdir(), "visthinker-empty-"));
    const res = await get(await start(empty), "/");
    expect(res.status).toBe(200);
    expect(res.body).toContain("pnpm build");
  });

  it("refuses a request for any other host name (DNS rebinding)", async () => {
    const session = await start();
    expect((await get(session, "/", { host: `evil.example:${session.port}` })).status).toBe(421);
    expect((await get(session, "/", { host: `localhost:${session.port}` })).status).toBe(200);
  });
});
