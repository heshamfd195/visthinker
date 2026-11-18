// The Fast Brain's answers to Claude's calls (D90). Each call's args are checked against the
// contract first. Calls not built yet answer unknown_call, naming the task that brings them.
import {
  ContractError,
  TOOLS,
  type BrowserCall,
  type ParsedToolArgs,
  type ToolResult,
} from "@visthinker/contract";
import type { CallHandler } from "../ports/index.ts";
import type { SceneStore } from "../scene/store.ts";
import type { StrokeStore } from "../scene/strokes.ts";
import type { Story } from "../scene/story.ts";

export interface ToolDeps {
  story: Story;
  scene: SceneStore;
  strokes: StrokeStore;
}

type Handlers = { [C in BrowserCall]?: (args: ParsedToolArgs<C>) => Promise<ToolResult<C>> };

const COMING: Partial<Record<BrowserCall, string>> = {
  wait_for_event: "T20",
  act: "T21",
  say: "T21",
  ask: "T21",
  write_pack: "T24",
};

export function createToolHandler({ story, scene, strokes }: ToolDeps): CallHandler {
  const handlers: Handlers = {
    /** Only the events since the last read; the read moves the cursor (D77). */
    get_events: async () => ({ events: story.read() }),

    /** The whole current scene (D77). */
    get_scene: async () => ({ objects: scene.all() }),

    /** A stroke's own points, or those of the strokes that made an object (D76). */
    get_strokes: async ({ target }) => {
      if (strokes.has(target)) return { strokes: [strokes.get(target)!] };
      const object = scene.get(target);
      if (!object) throw new ContractError("unknown_target", `no stroke or object ${target}`);
      const ids = object.strokes ?? [];
      return { strokes: ids.flatMap((id) => (strokes.has(id) ? [strokes.get(id)!] : [])) };
    },
  };

  return async (call, args) => {
    const handler = handlers[call] as ((a: unknown) => Promise<unknown>) | undefined;
    if (!handler) {
      const task = COMING[call];
      throw new ContractError(
        "unknown_call",
        `the canvas doesn't answer ${call} yet${task ? ` (${task})` : ""}`,
      );
    }
    const parsed = TOOLS[call].args.safeParse(args ?? {});
    if (!parsed.success) throw new ContractError("bad_args", parsed.error.message.slice(0, 900));
    return handler(parsed.data);
  };
}
