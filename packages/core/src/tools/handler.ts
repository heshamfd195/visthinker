// The Fast Brain's answers to Claude's calls (D90). Each call's args are checked against the
// contract first. Calls not built yet answer unknown_call, naming the task that brings them.
import {
  ContractError,
  TOOLS,
  type BrowserCall,
  type ParsedToolArgs,
  type ToolResult,
} from "@visthinker/contract";
import type { CallHandler, Clock } from "../ports/index.ts";
import type { SceneStore } from "../scene/store.ts";
import type { StrokeStore } from "../scene/strokes.ts";
import type { Story } from "../scene/story.ts";
import type { PackRegistry } from "../packs/loader.ts";
import { createGames, type Games } from "../game/games.ts";
import { createActor, type Actor } from "./act.ts";

export interface ToolDeps {
  clock: Clock;
  packs: PackRegistry;
  story: Story;
  scene: SceneStore;
  strokes: StrokeStore;
}

type Handlers = { [C in BrowserCall]?: (args: ParsedToolArgs<C>) => Promise<ToolResult<C>> };

const COMING: Partial<Record<BrowserCall, string>> = {};

export interface ToolHandler extends CallHandler {
  /** The same actor the act tool uses, for the canvas to send the user's answers to. */
  actor: Actor;
  /** The games on the canvas: the canvas places boards and sends the user's taps here. */
  games: Games;
}

export function createToolHandler({ clock, packs, story, scene, strokes }: ToolDeps): ToolHandler {
  const games = createGames({ story, scene, packs });
  const actor = createActor({ story, scene, games });
  // Waiters wake once the whole change is in the story, not halfway through it: a stroke and
  // what the Fast Brain makes of it arrive in the same read.
  const waiters = new Set<() => void>();
  let wakeQueued = false;
  story.subscribe(() => {
    if (wakeQueued) return;
    wakeQueued = true;
    queueMicrotask(() => {
      wakeQueued = false;
      for (const wake of [...waiters]) wake();
    });
  });

  const handlers: Handlers = {
    /** Only the events since the last read; the read moves the cursor (D77). */
    get_events: async () => ({ events: story.read() }),

    /**
     * Answers when something happens (D25): at once if a matching unread event exists, else when
     * one arrives, else with timedOut. Returns every unread event and moves the cursor, like
     * get_events, so nothing that happened while waiting is lost.
     */
    wait_for_event: ({ types, who, timeoutMs }) =>
      new Promise((resolve) => {
        const matches = () =>
          story
            .unread()
            .some((e) => (!types || types.includes(e.type)) && (!who || who.includes(e.who)));
        if (matches()) return resolve({ events: story.read(), timedOut: false });
        const wake = () => {
          if (!matches()) return;
          cancel();
          waiters.delete(wake);
          resolve({ events: story.read(), timedOut: false });
        };
        const cancel = clock.after(timeoutMs, () => {
          waiters.delete(wake);
          resolve({ events: story.read(), timedOut: true });
        });
        waiters.add(wake);
      }),

    /** Change the canvas by id: 1 to 10 actions, all or nothing (D91). */
    act: async (args) => actor.act(args),

    /** A short message on the canvas, optionally next to an object. */
    say: async ({ text, target }) => ({
      seq: story.append({
        who: "claude",
        type: "say",
        ...(target ? { target: mustExist(target) } : {}),
        detail: { text },
      }).seq,
    }),

    /** A question, maybe with choices. The answer comes later as an answer event whose cause is this seq. */
    ask: async ({ text, choices, target }) => ({
      seq: story.append({
        who: "claude",
        type: "ask",
        ...(target ? { target: mustExist(target) } : {}),
        detail: { text, ...(choices ? { choices } : {}) },
      }).seq,
    }),

    /** Loads a pack Claude wrote (the bridge has saved it first, D93). Local only (D62). */
    write_pack: async ({ pack }) => {
      const { pack: loaded } = packs.load(pack);
      const { name, version } = loaded["pack.json"];
      story.append({ who: "fastbrain", type: "pack", detail: { name, version, by: "claude" } });
      return { name, version, loaded: true };
    },

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

  function mustExist(id: string): string {
    if (!scene.has(id) && !strokes.has(id))
      throw new ContractError("unknown_target", `no object ${id}`);
    return id;
  }

  const handle = async (call: BrowserCall, args: unknown) => {
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
  return Object.assign(handle, { actor, games });
}
