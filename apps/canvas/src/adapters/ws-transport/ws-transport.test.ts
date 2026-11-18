// A scripted bridge: a real `ws` server that does the hello (D90), then sends requests and
// reads the canvas's answers through ws-transport. Node's own WebSocket plays the browser.
import { ContractError, CONTRACT_VERSION } from "@visthinker/contract";
import type { TransportStatus } from "@visthinker/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocketServer, type WebSocket as ServerSocket } from "ws";
import {
  CLOSE_BUSY,
  CLOSE_EXPIRED,
  bridgeUrlFromPage,
  createWsTransport,
  type WsTransport,
} from "./index.ts";

interface Tab {
  socket: ServerSocket;
  token: string | null;
  next(): Promise<unknown>;
}

let server: WebSocketServer;
let port: number;
let tabs: Tab[];
let waiting: ((tab: Tab) => void)[];
let transport: WsTransport | null;

beforeEach(async () => {
  tabs = [];
  waiting = [];
  transport = null;
  server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  port = (server.address() as { port: number }).port;
  server.on("connection", (socket, req) => {
    const inbox: unknown[] = [];
    const readers: ((m: unknown) => void)[] = [];
    socket.on("message", (data) => {
      const message = JSON.parse(String(data));
      const reader = readers.shift();
      if (reader) reader(message);
      else inbox.push(message);
    });
    const tab: Tab = {
      socket,
      token: new URL(req.url ?? "/", "http://x").searchParams.get("token"),
      next: () =>
        inbox.length ? Promise.resolve(inbox.shift()) : new Promise((r) => readers.push(r)),
    };
    tabs.push(tab);
    waiting.shift()?.(tab);
  });
});

afterEach(async () => {
  transport?.close();
  for (const c of server.clients) c.terminate();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const nextTab = () => new Promise<Tab>((resolve) => waiting.push(resolve));
const url = (token = "t0ken") => `ws://127.0.0.1:${port}/?token=${token}`;

function start(options: { reconnectMs?: number } = {}) {
  const seen: TransportStatus[] = [];
  transport = createWsTransport({ url: url(), reconnectMs: options.reconnectMs ?? 20 });
  transport.onStatus((s) => seen.push(s));
  const connected = nextTab();
  transport.start();
  return { transport, seen, connected };
}

const until = async (check: () => boolean, ms = 2_000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 5));
  }
};

/** Connects and completes the handshake. */
async function ready(options?: { reconnectMs?: number }) {
  const started = start(options);
  const tab = await started.connected;
  expect(await tab.next()).toEqual({ hello: { contract: CONTRACT_VERSION } });
  tab.socket.send(JSON.stringify({ hello: { ok: true } }));
  await until(() => started.transport.status() === "ready");
  return { ...started, tab };
}

describe("the link from the page (D82)", () => {
  it("reads the port and token, and refuses a page without them", () => {
    expect(bridgeUrlFromPage("?ws=5199&token=a%2Fb")).toBe("ws://127.0.0.1:5199/?token=a%2Fb");
    expect(bridgeUrlFromPage("?ws=5199")).toBeNull();
    expect(bridgeUrlFromPage("?ws=evil.example&token=t")).toBeNull();
    expect(bridgeUrlFromPage("")).toBeNull();
  });
});

describe("connecting", () => {
  it("does nothing until started, then sends the token and says hello", async () => {
    const t = createWsTransport({ url: url() });
    transport = t;
    await new Promise((r) => setTimeout(r, 30));
    expect(tabs).toHaveLength(0);
    const { tab, seen } = await ready();
    expect(tab.token).toBe("t0ken");
    expect(seen).toEqual(["ready"]);
  });

  it("starting twice opens one socket", async () => {
    const { transport: t } = await ready();
    t.start();
    await new Promise((r) => setTimeout(r, 30));
    expect(tabs).toHaveLength(1);
  });
});

describe("answering calls (D90)", () => {
  it("answers each request through the handler, by id", async () => {
    const { transport: t, tab } = await ready();
    t.serve(async (call, args) => ({ call, args }));
    tab.socket.send(JSON.stringify({ id: 4, call: "get_scene", args: { x: 1 } }));
    expect(await tab.next()).toEqual({
      id: 4,
      ok: true,
      result: { call: "get_scene", args: { x: 1 } },
    });
  });

  it("a ContractError keeps its code; anything else is internal", async () => {
    const { transport: t, tab } = await ready();
    t.serve(async (call) => {
      if (call === "act") throw new ContractError("not_allowed", "not your turn");
      throw new Error("boom");
    });
    tab.socket.send(JSON.stringify({ id: 1, call: "act", args: {} }));
    expect(await tab.next()).toEqual({
      id: 1,
      ok: false,
      error: { code: "not_allowed", message: "not your turn" },
    });
    tab.socket.send(JSON.stringify({ id: 2, call: "get_scene", args: {} }));
    expect(await tab.next()).toMatchObject({
      id: 2,
      ok: false,
      error: { code: "internal", message: "boom" },
    });
  });

  it("refuses the bridge's own tools and unreadable requests, at once", async () => {
    const { transport: t, tab } = await ready();
    t.serve(async () => ({}));
    tab.socket.send(JSON.stringify({ id: 3, call: "open_canvas", args: {} }));
    expect(await tab.next()).toMatchObject({ id: 3, ok: false, error: { code: "unknown_call" } });
    tab.socket.send(JSON.stringify({ id: 5, call: "draw_pixels", args: {} }));
    expect(await tab.next()).toMatchObject({ id: 5, ok: false, error: { code: "unknown_call" } });
  });

  it("with nothing serving, says so instead of leaving the bridge waiting", async () => {
    const { tab } = await ready();
    tab.socket.send(JSON.stringify({ id: 6, call: "get_scene", args: {} }));
    expect(await tab.next()).toMatchObject({ id: 6, ok: false, error: { code: "internal" } });
  });
});

describe("drops and refusals", () => {
  it("reconnects quietly after an ordinary drop", async () => {
    const { transport: t, tab } = await ready();
    const again = nextTab();
    tab.socket.close(1001);
    const second = await again;
    await second.next();
    second.socket.send(JSON.stringify({ hello: { ok: true } }));
    await until(() => t.status() === "ready");
  });

  it("stops on 4409 (another tab) and tries once more on reconnect()", async () => {
    const { transport: t, tab } = await ready();
    tab.socket.close(CLOSE_BUSY, "another canvas tab is connected");
    await until(() => t.status() === "busy");
    await new Promise((r) => setTimeout(r, 60));
    expect(tabs).toHaveLength(1);
    const again = nextTab();
    t.reconnect();
    await again;
  });

  it("stops on 4401 (bad link) and on a refused hello", async () => {
    const first = await ready();
    first.tab.socket.close(CLOSE_EXPIRED, "this canvas link is not valid");
    await until(() => first.transport.status() === "expired");
    first.transport.close();

    const second = start();
    const tab = await second.connected;
    await tab.next();
    tab.socket.send(
      JSON.stringify({ hello: { ok: false, error: { code: "bad_contract", message: "x" } } }),
    );
    await until(() => second.transport.status() === "expired");
  });

  it("close() is final", async () => {
    const { transport: t } = await ready();
    t.close();
    await until(() => t.status() === "closed");
    t.reconnect();
    t.start();
    await new Promise((r) => setTimeout(r, 60));
    expect(tabs).toHaveLength(1);
  });
});
