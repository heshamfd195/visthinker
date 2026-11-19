import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TOOL_NAMES, WAIT_GRACE_MS, type BrowserCall } from "@visthinker/contract";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { CanvasLink } from "./canvas.ts";
import type { PackApi } from "./packs/api.ts";
import { PackStore } from "./packs/store.ts";
import { createBridge, type Bridge } from "./server.ts";

type Result = CallToolResult & { structuredContent?: Record<string, unknown> };

const open: Array<{ bridge: Bridge; client: Client }> = [];

/** Packs in a temp home, so tests never touch ~/.visthinker. */
const tempPacks = async () => new PackStore(await mkdtemp(join(tmpdir(), "visthinker-home-")));

async function connect(canvas?: CanvasLink, packs?: PackStore, api?: PackApi): Promise<Client> {
  const bridge = createBridge({
    ...(canvas ? { canvas } : {}),
    packs: packs ?? (await tempPacks()),
    ...(api ? { api } : {}),
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([bridge.mcp.connect(serverSide), client.connect(clientSide)]);
  open.push({ bridge, client });
  return client;
}

const call = async (client: Client, name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as Result;

const text = (result: Result) => (result.content[0] as { text: string }).text;

afterEach(async () => {
  for (const { client, bridge } of open.splice(0)) {
    await client.close();
    await bridge.close();
  }
});

describe("the bridge's tools (D81)", () => {
  it("registers every contract tool, each with its input schema", async () => {
    const { tools } = await (await connect()).listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    for (const tool of tools) {
      expect(tool.description?.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("without a canvas, a canvas tool answers no_canvas (D90)", async () => {
    const result = await call(await connect(), "get_scene");
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/^no_canvas:/);
  });

  it("checks args before anything reaches the canvas", async () => {
    let reached = false;
    const client = await connect({ call: async () => ((reached = true), {}) });
    const result = await call(client, "act", { actions: [] });
    expect(result.isError).toBe(true);
    expect(reached).toBe(false);
  });
});

describe("relaying to the canvas (D90)", () => {
  it("passes the call through and returns the canvas's answer as structured content", async () => {
    const seen: Array<[BrowserCall, unknown]> = [];
    const client = await connect({
      call: async (name, args) => {
        seen.push([name, args]);
        return { objects: [] };
      },
    });
    const result = await call(client, "get_scene");
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ objects: [] });
    expect(seen).toEqual([["get_scene", {}]]);
  });

  it("refuses a canvas answer that breaks the contract", async () => {
    const client = await connect({ call: async () => ({ objects: "not a list" }) });
    const result = await call(client, "get_scene");
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/^bad_contract:/);
  });

  it("gives wait_for_event its own timeout plus a grace period", async () => {
    let timeout: number | undefined;
    const client = await connect({
      call: async (_name, _args, ms) => ((timeout = ms), { events: [], timedOut: true }),
    });
    await call(client, "wait_for_event", { timeoutMs: 5_000 });
    expect(timeout).toBe(5_000 + WAIT_GRACE_MS);
  });
});

describe("open_canvas (T17)", () => {
  async function withOpener(claims: boolean[]) {
    const opened: string[] = [];
    const url = "http://127.0.0.1:9999/?ws=9999&token=secret";
    const bridge = createBridge({
      packs: await tempPacks(),
      opener: { url, claimOpen: () => claims.shift() ?? false },
      openBrowser: (u) => void opened.push(u),
    });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0" });
    await Promise.all([bridge.mcp.connect(serverSide), client.connect(clientSide)]);
    open.push({ bridge, client });
    return { client, opened, url };
  }

  it("opens the browser at the token link and returns it", async () => {
    const { client, opened, url } = await withOpener([true]);
    const result = await call(client, "open_canvas");
    expect(result.structuredContent).toEqual({ url });
    expect(opened).toEqual([url]);
  });

  it("returns the link without opening another tab when the session says no", async () => {
    const { client, opened, url } = await withOpener([true, false]);
    await call(client, "open_canvas");
    const again = await call(client, "open_canvas");
    expect(again.structuredContent).toEqual({ url });
    expect(opened).toHaveLength(1);
  });

  it("without a canvas server, answers no_canvas", async () => {
    expect(text(await call(await connect(), "open_canvas"))).toMatch(/^no_canvas:/);
  });
});

describe("pack tools (T24)", () => {
  const pack = (name: string, version = "0.1.0") => ({
    "pack.json": { name, version, contract: "0", match: {}, blocks: ["grid"] },
    "README.md": "# A pack",
  });

  it("list_packs shows the starter packs, then the local ones", async () => {
    const packs = await tempPacks();
    await packs.save(pack("noughts") as never);
    const result = await call(await connect(undefined, packs), "list_packs");
    expect(result.structuredContent).toEqual({
      packs: [
        { name: "modes", version: "0.1.0", source: "starter" },
        { name: "shapes", version: "0.1.0", source: "starter" },
        { name: "tic-tac-toe", version: "0.1.0", source: "starter" },
        { name: "noughts", version: "0.1.0", source: "local" },
      ],
    });
  });

  it("read_pack reads a starter pack, and an unknown name says so", async () => {
    const client = await connect();
    const result = await call(client, "read_pack", { name: "tic-tac-toe" });
    expect(
      (result.structuredContent as { pack: { "pack.json": { name: string } } }).pack["pack.json"]
        .name,
    ).toBe("tic-tac-toe");
    expect(text(await call(client, "read_pack", { name: "chess" }))).toMatch(/^unknown_target:/);
  });

  it("write_pack saves the pack, then loads it into the canvas", async () => {
    const packs = await tempPacks();
    const client = await connect(
      {
        call: async (name, args) => ({
          name: "noughts",
          version: "0.2.0",
          loaded: name === "write_pack" && !!args,
        }),
      },
      packs,
    );
    const result = await call(client, "write_pack", { pack: pack("noughts", "0.2.0") });
    expect(result.structuredContent).toEqual({ name: "noughts", version: "0.2.0", loaded: true });
    expect((await packs.read("noughts"))["pack.json"].version).toBe("0.2.0");
  });

  it("with no canvas open, write_pack still saves and says loaded: false", async () => {
    const packs = await tempPacks();
    const result = await call(await connect(undefined, packs), "write_pack", {
      pack: pack("noughts"),
    });
    expect(result.structuredContent).toEqual({ name: "noughts", version: "0.1.0", loaded: false });
    expect((await packs.list()).map((p) => p.name)).toContain("noughts");
  });

  it("refuses a pack that breaks the contract, and saves nothing", async () => {
    const packs = await tempPacks();
    const bad = {
      "pack.json": { name: "noughts", version: "1", contract: "0", match: {}, blocks: ["grid"] },
    };
    const result = await call(await connect(undefined, packs), "write_pack", { pack: bad });
    expect(result.isError).toBe(true);
    expect(await packs.list()).toHaveLength(3);
  });

  it("install_pack needs the API, and says to write the pack instead", async () => {
    expect(text(await call(await connect(), "install_pack", { name: "chess" }))).toMatch(
      /write_pack/,
    );
  });
});

describe("pack tools with the API (T34)", () => {
  const chess = {
    "pack.json": { name: "chess", version: "0.3.0", contract: "0", match: {}, blocks: ["grid"] },
    "README.md": "# Chess",
  };
  const api = (packs: Record<string, unknown> = { chess }, down = false): PackApi => ({
    url: "http://api.test",
    list: async () => {
      if (down) throw new Error("down");
      return Object.keys(packs).map((name) => ({ name, version: "0.3.0" }));
    },
    read: async (name) => {
      if (!(name in packs))
        throw new (await import("@visthinker/contract")).ContractError(
          "unknown_target",
          `no ${name}`,
        );
      return packs[name];
    },
  });

  it("list_packs adds the API's catalog as source api", async () => {
    const result = await call(await connect(undefined, undefined, api()), "list_packs");
    expect(
      (result.structuredContent as { packs: { name: string; source: string }[] }).packs.at(-1),
    ).toEqual({
      name: "chess",
      version: "0.3.0",
      source: "api",
    });
  });

  it("an API that's down never hides the packs on this machine", async () => {
    const result = await call(await connect(undefined, undefined, api({}, true)), "list_packs");
    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as { packs: unknown[] }).packs).toHaveLength(3);
  });

  it("read_pack falls back to the API for a pack this machine doesn't have", async () => {
    const result = await call(await connect(undefined, undefined, api()), "read_pack", {
      name: "chess",
    });
    expect((result.structuredContent as { pack: typeof chess }).pack["pack.json"].name).toBe(
      "chess",
    );
  });

  it("install_pack checks the pack, saves it, and loads it into the canvas", async () => {
    const packs = await tempPacks();
    const loads: string[] = [];
    const client = await connect(
      { call: async (name, args) => (loads.push(name), { ...(args as object), loaded: true }) },
      packs,
      api(),
    );
    const result = await call(client, "install_pack", { name: "chess" });
    expect(result.structuredContent).toEqual({ name: "chess", version: "0.3.0" });
    expect((await packs.read("chess"))["pack.json"].version).toBe("0.3.0");
    expect(loads).toEqual(["write_pack"]);
  });

  it("with no canvas open, install_pack still saves the pack", async () => {
    const packs = await tempPacks();
    expect(
      (await call(await connect(undefined, packs, api()), "install_pack", { name: "chess" }))
        .isError,
    ).toBeFalsy();
    expect((await packs.list()).map((p) => p.name)).toContain("chess");
  });

  it("refuses a broken pack from the API, and saves nothing", async () => {
    const packs = await tempPacks();
    const broken = { "pack.json": { name: "chess", version: "3" } };
    const result = await call(
      await connect(undefined, packs, api({ chess: broken })),
      "install_pack",
      { name: "chess" },
    );
    expect(text(result)).toMatch(/^bad_contract:/);
    expect(await packs.list()).toHaveLength(3);
  });
});

describe("over stdio", () => {
  it("a real MCP client starts the server and lists its tools", async () => {
    const server = fileURLToPath(new URL("./bin.ts", import.meta.url));
    const client = new Client({ name: "stdio-test", version: "0" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [server],
        env: {
          ...(process.env as Record<string, string>),
          VISTHINKER_HOME: await mkdtemp(join(tmpdir(), "visthinker-home-")),
          VISTHINKER_NO_OPEN: "1",
        },
        stderr: "ignore",
      }),
    );
    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(TOOL_NAMES.length);
      const result = (await client.callTool({ name: "get_events", arguments: {} })) as Result;
      expect(text(result)).toMatch(/^no_canvas:/);
    } finally {
      await client.close();
    }
  }, 20_000);
});
