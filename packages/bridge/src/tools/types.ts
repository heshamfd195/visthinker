import {
  type BrowserCall,
  type ParsedToolArgs,
  type ToolName,
  type ToolResult,
} from "@visthinker/contract";
import type { CanvasLink } from "../canvas.ts";
import type { PackStore } from "../packs/store.ts";

/** Where the canvas is served, and whether a browser tab should open now (the session). */
export interface CanvasOpener {
  readonly url: string;
  claimOpen(): boolean;
}

export interface BridgeContext {
  canvas: CanvasLink;
  packs: PackStore;
  opener?: CanvasOpener;
  openBrowser: (url: string) => void | Promise<void>;
}

/** One MCP tool. Its args and result are the contract's TOOLS[name] schemas. */
export interface ToolDef<N extends ToolName = ToolName> {
  name: N;
  description: string;
  run: (args: ParsedToolArgs<N>, ctx: BridgeContext) => Promise<ToolResult<N>>;
}

export const defineTool = <N extends ToolName>(tool: ToolDef<N>): ToolDef<N> => tool;

/** A tool the bridge only passes through to the canvas (D90). */
export const relayTool = <N extends BrowserCall>(
  name: N,
  description: string,
  timeoutMs?: (args: ParsedToolArgs<N>) => number,
): ToolDef<N> =>
  defineTool({
    name,
    description,
    run: async (args, ctx) =>
      (await ctx.canvas.call(name, args, timeoutMs?.(args))) as ToolResult<N>,
  });
