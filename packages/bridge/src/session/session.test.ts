import { CONTRACT_VERSION, ContractError, Request as BridgeRequest } from "@visthinker/contract";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { CLOSE_BAD_TOKEN, CLOSE_TAB_TAKEN, HOST, Session, type SessionOptions } from "./session.ts";

const sessions: Session[] = [];
const sockets: WebSocket[] = [];

async function start(options: SessionOptions = {}): Promise<Session> {
  const session = await Session.start(options);
  sessions.push(session);
  return session;
}

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  for (const s of sessions.splice(0)) await s.close();
});

/** Opens a socket like a canvas tab would; resolves once it's open, or with how it was refused. */
function knock(session: Session, opts: { token?: string; origin?: string | null } = {}) {
  const token = opts.token ?? session.token;
  const origin = opts.origin === undefined ? session.origin : opts.origin;
  const ws = new WebSocket(`ws://${HOST}:${session.port}/?token=${encodeURIComponent(token)}`, {
    headers: origin ? { Origin: origin } : {},
  });
  sockets.push(ws);
  return new Promise<{ ws: WebSocket; open: boolean; status?: number; close?: number }>(
    (resolve) => {
      ws.once("open", () => {
        ws.once("close", (code) => resolve({ ws, open: false, close: code }));
        setTimeout(() => resolve({ ws, open: true }), 50);
      });
      ws.once("unexpected-response", (_req, res) =>
        resolve({ ws, open: false, status: res.statusCode }),
      );
      ws.once("error", () => undefined);
    },
  );
}

const next = (ws: WebSocket) =>
  new Promise<unknown>((resolve) =>
    ws.once("message", (data) => resolve(JSON.parse(String(data)))),
  );

/** A tab that passed the handshake and answers each request with `answer`. */
async function connectTab(session: Session, answer: (req: BridgeRequest) => unknown) {
  const { ws, open } = await knock(session);
  expect(open).toBe(true);
  ws.send(JSON.stringify({ hello: { contract: CONTRACT_VERSION } }));
  expect(await next(ws)).toEqual({ hello: { ok: true } });
  ws.on("message", (data) => {
    const req = BridgeRequest.parse(JSON.parse(String(data)));
    const reply = answer(req);
    if (reply !== undefined) ws.send(JSON.stringify(reply));
  });
  return ws;
}

describe("D82 ①: localhost only", () => {
  it("listens on 127.0.0.1, and its link carries the port and token", async () => {
    const session = await start();
    expect(session.origin).toBe(`http://127.0.0.1:${session.port}`);
    expect(session.url).toBe(`${session.origin}/?ws=${session.port}&token=${session.token}`);
  });
});

describe("D82 ②: a secret token per session", () => {
  it("each session makes its own long token", async () => {
    const [a, b] = await Promise.all([start(), start()]);
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(32);
  });

  it("no token, or the wrong one, closes the socket with 4401", async () => {
    const session = await start();
    expect((await knock(session, { token: "" })).close).toBe(CLOSE_BAD_TOKEN);
    expect((await knock(session, { token: "x".repeat(32) })).close).toBe(CLOSE_BAD_TOKEN);
  });
});

describe("D82 ③: Origin check", () => {
  it("another website, or no Origin at all, gets a bare 403", async () => {
    const session = await start();
    expect((await knock(session, { origin: "https://evil.example" })).status).toBe(403);
    expect((await knock(session, { origin: null })).status).toBe(403);
  });

  it("an extra Origin, like the Vite dev server, can be allowed", async () => {
    const session = await start({ extraOrigins: ["http://localhost:5173"] });
    expect((await knock(session, { origin: "http://localhost:5173" })).open).toBe(true);
  });
});

describe("D82 ④: one canvas per session", () => {
  it("a second tab is refused with 4409 while the first is connected", async () => {
    const session = await start();
    expect((await knock(session)).open).toBe(true);
    expect((await knock(session)).close).toBe(CLOSE_TAB_TAKEN);
  });

  it("once the first tab closes, a new one may connect", async () => {
    const session = await start();
    const first = await knock(session);
    const closed = new Promise((r) => first.ws.once("close", r));
    first.ws.close();
    await closed;
    await new Promise((r) => setTimeout(r, 20));
    expect((await knock(session)).open).toBe(true);
  });
});

describe("handshake and calls (D90)", () => {
  it("refuses a tab on another contract version", async () => {
    const session = await start();
    const { ws } = await knock(session);
    ws.send(JSON.stringify({ hello: { contract: "99" } }));
    const reply = (await next(ws)) as { hello: { ok: boolean; error?: { code: string } } };
    expect(reply.hello).toMatchObject({ ok: false, error: { code: "bad_contract" } });
    expect(session.hasCanvas).toBe(false);
  });

  it("before a tab connects, a call answers no_canvas", async () => {
    const session = await start();
    await expect(session.call("get_scene", {})).rejects.toMatchObject({ code: "no_canvas" });
  });

  it("relays a call and resolves with the tab's answer", async () => {
    const session = await start();
    await connectTab(session, (req) => ({
      id: req.id,
      ok: true,
      result: { objects: [], call: req.call },
    }));
    expect(session.hasCanvas).toBe(true);
    await expect(session.call("get_scene", {})).resolves.toEqual({
      objects: [],
      call: "get_scene",
    });
  });

  it("passes the tab's error on as a ContractError with its code", async () => {
    const session = await start();
    await connectTab(session, (req) => ({
      id: req.id,
      ok: false,
      error: { code: "not_allowed", message: "not your turn" },
    }));
    const error = await session.call("act", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContractError);
    expect(error).toMatchObject({ code: "not_allowed", message: "not your turn" });
  });

  it("times out when the tab doesn't answer", async () => {
    const session = await start({ callTimeoutMs: 100 });
    await connectTab(session, () => undefined);
    await expect(session.call("get_scene", {})).rejects.toMatchObject({ code: "timeout" });
  });

  it("a tab that closes mid-call fails the call with no_canvas", async () => {
    const session = await start();
    const ws = await connectTab(session, () => {
      ws.close();
      return undefined;
    });
    await expect(session.call("get_scene", {})).rejects.toMatchObject({ code: "no_canvas" });
  });
});

describe("open_canvas guard", () => {
  it("opens once, then waits out the grace period before opening again", async () => {
    const session = await start({ openGraceMs: 20_000 });
    expect(session.claimOpen(1_000)).toBe(true);
    expect(session.claimOpen(1_001)).toBe(false);
    expect(session.claimOpen(20_999)).toBe(false);
    expect(session.claimOpen(21_000)).toBe(true);
  });

  it("never opens while a tab is connected", async () => {
    const session = await start();
    expect((await knock(session)).open).toBe(true);
    expect(session.claimOpen()).toBe(false);
  });
});
