import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TOOL_NAMES, WAIT_GRACE_MS, type BrowserCall } from "@visthinker/contract";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { CanvasLink } from "./canvas.ts";
import { createBridge, type Bridge } from "./server.ts";

type Result = CallToolResult & { structuredContent?: Record<string, unknown> };

const open: Array<{ bridge: Bridge; client: Client }> = [];

async function connect(canvas?: CanvasLink): Promise<Client> {
  const bridge = createBridge(canvas ? { canvas } : {});
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

  it("the tools the bridge answers itself say which task builds them", async () => {
    const result = await call(await connect(), "open_canvas");
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/T17/);
  });
});

describe("over stdio", () => {
  it("a real MCP client starts the server and lists its tools", async () => {
    const server = fileURLToPath(new URL("./server.ts", import.meta.url));
    const client = new Client({ name: "stdio-test", version: "0" });
    await client.connect(
      new StdioClientTransport({ command: process.execPath, args: [server], stderr: "ignore" }),
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
