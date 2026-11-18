// The Visthinker bridge: an MCP server over stdio that relays Claude's calls to the canvas (D90).
// Run: node packages/bridge/src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ContractError, TOOL_NAMES, TOOLS, type ToolName } from "@visthinker/contract";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { openInBrowser } from "./browser.ts";
import { NO_CANVAS, type CanvasLink } from "./canvas.ts";
import { log } from "./log.ts";
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
    ...(options.opener ? { opener: options.opener } : {}),
    openBrowser: options.openBrowser ?? openInBrowser,
  };
  const mcp = new McpServer({ name: "visthinker", version: "0.0.0" });
  for (const name of TOOL_NAMES) register(mcp, ALL_TOOLS[name], ctx);
  return { mcp, close: () => mcp.close() };
}

async function main(): Promise<void> {
  const session = await Session.start({
    port: process.env.VISTHINKER_PORT ? Number(process.env.VISTHINKER_PORT) : undefined,
    extraOrigins: process.env.VISTHINKER_EXTRA_ORIGINS?.split(",").filter(Boolean),
    ...(process.env.VISTHINKER_CANVAS_DIR ? { canvasDir: process.env.VISTHINKER_CANVAS_DIR } : {}),
  });
  const bridge = createBridge({
    canvas: session,
    opener: session,
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

const isMain =
  process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    log("failed to start:", String(error));
    process.exit(1);
  });
}
