import {
  ContractError,
  type BrowserCall,
  type ParsedToolArgs,
  type ToolName,
  type ToolResult,
} from "@visthinker/contract";
import type { CanvasLink } from "../canvas.ts";

export interface BridgeContext {
  canvas: CanvasLink;
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

/** A tool the bridge answers itself, registered now and built in a later task. */
export const comingTool = <N extends ToolName>(
  name: N,
  description: string,
  task: string,
): ToolDef<N> =>
  defineTool({
    name,
    description,
    run: async () => {
      throw new ContractError("internal", `${name} isn't built yet (${task}).`);
    },
  });
