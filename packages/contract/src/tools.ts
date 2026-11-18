import { z } from "zod";
import { ActArgs, ActResult } from "./act.ts";
import { Id } from "./common.ts";
import { VisEvent, Who } from "./event.ts";
import { Pack } from "./pack.ts";
import { SceneObject } from "./scene.ts";
import { Stroke } from "./stroke.ts";

const Empty = z.object({});
const Seq = z.object({ seq: z.number().int().positive() });

export const WAIT_DEFAULT_MS = 60_000;
export const WAIT_MAX_MS = 300_000;

/** The MCP tools (D81): every tool's input and result. */
export const TOOLS = {
  open_canvas: { args: Empty, result: z.object({ url: z.string().url() }) },

  /** Only the events since the last read (D77). */
  get_events: { args: Empty, result: z.object({ events: z.array(VisEvent) }) },
  /** The full current scene (D77). */
  get_scene: { args: Empty, result: z.object({ objects: z.array(SceneObject) }) },
  /** Raw strokes of one object (D76). */
  get_strokes: { args: z.object({ target: Id }), result: z.object({ strokes: z.array(Stroke) }) },

  /**
   * Answers when something happens (D25). Unread events that match answer at once;
   * otherwise it waits. Returns every unread event and moves the read cursor, like `get_events`.
   */
  wait_for_event: {
    args: z.object({
      types: z.array(z.string().min(1)).optional(),
      who: z.array(Who).optional(),
      timeoutMs: z.number().int().min(1_000).max(WAIT_MAX_MS).default(WAIT_DEFAULT_MS),
    }),
    result: z.object({ events: z.array(VisEvent), timedOut: z.boolean() }),
  },

  act: { args: ActArgs, result: ActResult },
  say: {
    args: z.object({ text: z.string().min(1).max(2_000), target: Id.optional() }),
    result: Seq,
  },
  /** The answer comes later as an `answer` event whose `cause` is this ask's `seq`. */
  ask: {
    args: z.object({
      text: z.string().min(1).max(2_000),
      choices: z.array(z.string().min(1).max(100)).max(6).optional(),
      target: Id.optional(),
    }),
    result: Seq,
  },

  list_packs: {
    args: Empty,
    result: z.object({
      packs: z.array(
        z.object({
          name: z.string(),
          version: z.string(),
          source: z.enum(["starter", "local", "api"]),
        }),
      ),
    }),
  },
  install_pack: {
    args: z.object({ name: z.string().min(1) }),
    result: z.object({ name: z.string(), version: z.string() }),
  },
  read_pack: { args: z.object({ name: z.string().min(1) }), result: z.object({ pack: Pack }) },
  /** Saved in ~/.visthinker/packs (D93), then loaded by the Fast Brain. Local only (D62). */
  write_pack: {
    args: z.object({ pack: Pack }),
    result: z.object({ name: z.string(), version: z.string(), loaded: z.boolean() }),
  },
} as const;

export type ToolName = keyof typeof TOOLS;
export type ToolArgs<N extends ToolName> = z.input<(typeof TOOLS)[N]["args"]>;
export type ParsedToolArgs<N extends ToolName> = z.output<(typeof TOOLS)[N]["args"]>;
export type ToolResult<N extends ToolName> = z.infer<(typeof TOOLS)[N]["result"]>;

export const TOOL_NAMES = Object.keys(TOOLS) as ToolName[];

/** Tools the bridge answers itself; the rest go to the browser (D90). */
export const BRIDGE_ONLY = ["open_canvas", "list_packs", "install_pack", "read_pack"] as const;
export type BridgeOnlyCall = (typeof BRIDGE_ONLY)[number];
/** Tools the bridge passes to the Fast Brain in the browser. `write_pack` goes after it is saved. */
export type BrowserCall = Exclude<ToolName, BridgeOnlyCall>;
export const BROWSER_CALLS = TOOL_NAMES.filter(
  (n): n is BrowserCall => !(BRIDGE_ONLY as readonly string[]).includes(n),
);
