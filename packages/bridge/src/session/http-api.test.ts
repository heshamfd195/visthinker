import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PackStore } from "../packs/store.ts";
import { createBridge } from "../server.ts";
import { createHttpApi } from "./http-api.ts";
import { Session } from "./session.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0)) await clean();
});

async function setup() {
  const home = await mkdtemp(join(tmpdir(), "vt-api-"));
  const session = await Session.start({ extraOrigins: ["http://localhost:5179"] });
  const bridge = createBridge({ canvas: session, packs: new PackStore(home) });
  session.useApi(createHttpApi(bridge.ctx, home));
  cleanups.push(async () => {
    await session.close();
    await rm(home, { recursive: true, force: true });
  });
  const api = (path: string, init: RequestInit & { token?: string | null; origin?: string } = {}) =>
    fetch(`${session.origin}/api/${path}`, {
      ...init,
      headers: {
        ...(init.token === null ? {} : { Authorization: `Bearer ${init.token ?? session.token}` }),
        ...(init.origin ? { Origin: init.origin } : {}),
        "Content-Type": "application/json",
      },
    });
  return { session, api };
}

const snapshot = {
  version: 1,
  events: [{ seq: 1, t: 0, who: "user", type: "stroke", target: "s1" }],
  strokes: [],
  objects: [],
  history: { hidden: [], saved: [] },
};

const project = (id: string, updatedAt: number) => ({
  meta: {
    id,
    name: `Project ${id}`,
    updatedAt,
    chats: [{ id: "main", name: "Chat", createdAt: 0 }],
  },
  snapshot,
});

describe("the canvas's HTTP API (D142 · D143)", () => {
  it("refuses a request without this session's token, or from another site", async () => {
    const { api } = await setup();
    expect((await api("projects", { token: null })).status).toBe(401);
    expect((await api("projects", { token: "wrong" })).status).toBe(401);
    expect((await api("projects", { origin: "https://evil.example" })).status).toBe(403);
  });

  it("lets the Vite dev page in, with CORS headers", async () => {
    const { api } = await setup();
    const res = await api("projects", { origin: "http://localhost:5179" });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5179");
  });

  it("saves projects on disk and lists the latest first", async () => {
    const { api } = await setup();
    expect(await (await api("projects")).json()).toEqual({ projects: [] });
    for (const [id, at] of [
      ["one", 1],
      ["two", 2],
    ] as const) {
      const res = await api(`projects/${id}`, {
        method: "PUT",
        body: JSON.stringify(project(id, at)),
      });
      expect(res.status).toBe(200);
    }
    const list = (await (await api("projects")).json()) as { projects: { id: string }[] };
    expect(list.projects.map((p) => p.id)).toEqual(["two", "one"]);
    const read = (await (await api("projects/one")).json()) as { snapshot: unknown };
    expect(read.snapshot).toEqual(snapshot);
  });

  it("refuses a project that doesn't fit the contract, or a path that escapes", async () => {
    const { api } = await setup();
    const bad = await api("projects/one", {
      method: "PUT",
      body: JSON.stringify({ meta: { id: "one" } }),
    });
    expect(bad.status).toBe(400);
    expect((await api("projects/..%2Fetc")).status).toBe(400);
    expect((await api("projects/missing")).status).toBe(404);
  });

  it("keeps behaviour settings, with safe defaults (D47)", async () => {
    const { api } = await setup();
    expect(await (await api("settings")).json()).toEqual({
      askClaudeWhenUnsure: true,
      saveStories: false,
    });
    await api("settings", {
      method: "PUT",
      body: JSON.stringify({ askClaudeWhenUnsure: false, saveStories: true }),
    });
    expect(await (await api("settings")).json()).toEqual({
      askClaudeWhenUnsure: false,
      saveStories: true,
    });
  });

  it("lists the packs for the packs panel (D122)", async () => {
    const { api } = await setup();
    const body = (await (await api("packs")).json()) as { packs: { name: string }[] };
    expect(body.packs.map((p) => p.name)).toEqual(["modes", "shapes"]);
    const install = await api("packs/chess/install", { method: "POST" });
    expect(install.status).toBe(403);
  });
});
