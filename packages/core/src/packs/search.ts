// The fast search over packs (D68): after each change, a loaded pack whose `match` the scene now
// meets makes the Fast Brain ask, e.g. "Tic-tac-toe? Shall I build it and continue?". On yes, the
// pack's grid is built from the user's own lines and its game starts. It asks once per drawing:
// the same crossings are never asked about twice, whatever the answer.
import type { VisEvent } from "@visthinker/contract";
import type { Games } from "../game/games.ts";
import type { SceneStore } from "../scene/store.ts";
import type { Story } from "../scene/story.ts";
import { matchPack, type PackRegistry } from "./loader.ts";

export interface PackSearch {
  /** Searches now instead of after the current change (for tests). */
  check(): void;
}

/** "tic-tac-toe" → "Tic-tac-toe". */
const title = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

export function createPackSearch({
  story,
  scene,
  packs,
  games,
}: {
  story: Story;
  scene: SceneStore;
  packs: PackRegistry;
  games: Games;
}): PackSearch {
  const asked = new Set<string>();
  const pending = new Map<number, string>();
  let queued = false;

  const check = () => {
    const objects = scene.all();
    const crossings = objects
      .filter((o) => o.kind === "crossing")
      .map((o) => o.id)
      .sort()
      .join(",");
    for (const name of packs.names()) {
      const loaded = packs.get(name)!;
      const manifest = loaded.pack["pack.json"];
      if (!loaded.pack["rules.json"]?.grid || Object.keys(manifest.match).length === 0) continue;
      if (objects.some((o) => o.kind === "board" && o.pack === name)) continue;
      const key = `${name}:${crossings}`;
      if (asked.has(key) || !matchPack(manifest.match, objects).ok) continue;
      asked.add(key);
      const ask = story.append({
        who: "fastbrain",
        type: "ask",
        detail: {
          text: `${title(name)}? Shall I build it and continue?`,
          choices: ["yes", "no"],
          pack: name,
        },
      });
      pending.set(ask.seq, name);
    }
  };

  const onAnswer = (event: VisEvent) => {
    const name = event.cause === undefined ? undefined : pending.get(event.cause);
    if (!name) return;
    pending.delete(event.cause!);
    if (event.detail?.["choice"] !== "yes") return;
    try {
      games.buildFromDrawing(name, event.seq);
    } catch (error) {
      story.append({
        who: "fastbrain",
        type: "say",
        detail: {
          text: `I couldn't build ${name}: ${error instanceof Error ? error.message : String(error)}`,
        },
        cause: event.seq,
      });
    }
  };

  story.subscribe((event) => {
    if (event.type === "answer") return queueMicrotask(() => onAnswer(event));
    // Search once the whole change is in (a stroke and what it made), not halfway through.
    if (queued || (event.who === "fastbrain" && event.type === "ask")) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      check();
    });
  });

  return { check };
}
