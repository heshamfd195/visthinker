// The Visthinker bridge: an MCP server over stdio that relays Claude's calls to the canvas (D90).
// Run from the repo: node packages/bridge/src/bin.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ContractError, TOOL_NAMES, TOOLS, type ToolName } from "@visthinker/contract";
import { z } from "zod";
import { openInBrowser } from "./browser.ts";
import { NO_CANVAS, type CanvasLink } from "./canvas.ts";
import { log } from "./log.ts";
import { createPackApi, type PackApi } from "./packs/api.ts";
import { PackStore, visthinkerHome } from "./packs/store.ts";
import { Session } from "./session/session.ts";
import { ALL_TOOLS } from "./tools/index.ts";
import type { BridgeContext, CanvasOpener, ToolDef } from "./tools/types.ts";

export interface BridgeOptions {
  /** How calls reach the canvas: the session (T16), or no canvas in tests that don't need one. */
  canvas?: CanvasLink;
  /** Serves the canvas link and decides when to open a tab: the session. */
  opener?: CanvasOpener;
  /** Default: the system's browser. */
  openBrowser?: (url: string) => void | Promise<void>;
  /** Packs on disk. Default: ~/.visthinker/packs (or VISTHINKER_HOME) and the repo's starter packs. */
  packs?: PackStore;
  /** The Visthinker API for install_pack and more packs in list_packs and read_pack. */
  api?: PackApi;
}

export interface Bridge {
  mcp: McpServer;
  close: () => Promise<void>;
}

function errorResult(error: unknown): CallToolResult {
  const text =
    error instanceof ContractError
      ? `${error.code}: ${error.message}`
      : `internal: ${error instanceof Error ? error.message : String(error)}`;
  return { isError: true, content: [{ type: "text", text }] };
}

/** Registers one tool. Args are checked going in and the result coming back (D81 · D90). */
function register<N extends ToolName>(mcp: McpServer, tool: ToolDef<N>, ctx: BridgeContext): void {
  const spec = TOOLS[tool.name] as unknown as { args: z.ZodObject; result: z.ZodObject };
  mcp.registerTool(
    tool.name,
    { description: tool.description, inputSchema: spec.args, outputSchema: spec.result },
    async (raw: unknown): Promise<CallToolResult> => {
      try {
        const args = spec.args.safeParse(raw ?? {});
        if (!args.success) throw new ContractError("bad_args", z.prettifyError(args.error));
        const result = spec.result.safeParse(await tool.run(args.data as never, ctx));
        if (!result.success) {
          throw new ContractError(
            "bad_contract",
            `the canvas answered ${tool.name} with a bad result: ${z.prettifyError(result.error)}`,
          );
        }
        const data = result.data as Record<string, unknown>;
        return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
      } catch (error) {
        log(`${tool.name} failed:`, errorResult(error).content[0]);
        return errorResult(error);
      }
    },
  );
}

/** An MCP server with every contract tool, not yet connected to a transport. */
export function createBridge(options: BridgeOptions = {}): Bridge {
  const ctx: BridgeContext = {
    canvas: options.canvas ?? NO_CANVAS,
    packs: options.packs ?? new PackStore(visthinkerHome()),
    ...(options.api ? { api: options.api } : {}),
    ...(options.opener ? { opener: options.opener } : {}),
    openBrowser: options.openBrowser ?? openInBrowser,
  };
  const mcp = new McpServer({ name: "visthinker", version: "0.0.0" });
  for (const name of TOOL_NAMES) register(mcp, ALL_TOOLS[name], ctx);
  return { mcp, close: () => mcp.close() };
}

export interface MainOptions {
  /** The built canvas to serve. Default: VISTHINKER_CANVAS_DIR, else apps/canvas/dist in the repo. */
  canvasDir?: string;
  /** The starter packs. Default: the repo's packs/ folder. */
  starterDir?: string;
}

/** Starts the session and the MCP server on stdio: what `visthinker` runs. */
export async function main(options: MainOptions = {}): Promise<void> {
  const canvasDir = options.canvasDir ?? process.env.VISTHINKER_CANVAS_DIR;
  const session = await Session.start({
    port: process.env.VISTHINKER_PORT ? Number(process.env.VISTHINKER_PORT) : undefined,
    extraOrigins: process.env.VISTHINKER_EXTRA_ORIGINS?.split(",").filter(Boolean),
    ...(canvasDir ? { canvasDir } : {}),
  });
  const bridge = createBridge({
    canvas: session,
    opener: session,
    packs: new PackStore(visthinkerHome(), options.starterDir),
    // VISTHINKER_API, e.g. http://127.0.0.1:8787 locally, or the Railway URL once it's deployed.
    ...(process.env.VISTHINKER_API ? { api: createPackApi(process.env.VISTHINKER_API) } : {}),
    // VISTHINKER_NO_OPEN logs the link instead of opening a browser (tests, headless use).
    ...(process.env.VISTHINKER_NO_OPEN ? { openBrowser: (url: string) => log(`open ${url}`) } : {}),
  });
  const shutdown = () =>
    void Promise.all([bridge.close(), session.close()]).finally(() => process.exit(0));
  process.stdin.on("close", shutdown);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await bridge.mcp.connect(new StdioServerTransport());
  log(`MCP ready on stdio; canvas on ${session.origin}`);
}
