// Strokes are kept raw, never smoothed (D88). Each one becomes a `stroke` event whose detail
// carries only its box and point count; the points come back through `get_strokes` (D76).
import { Stroke, type Box, type VisEvent } from "@visthinker/contract";
import type { Story } from "./story.ts";

export interface StrokeStore {
  /** The next stroke id: "s1", "s2"…; never handed out twice. */
  nextId(): string;
  get(id: string): Stroke | undefined;
  has(id: string): boolean;
  all(): Stroke[];
}

interface MutableStrokeStore extends StrokeStore {
  put(stroke: Stroke): void;
}

/** `initial`: the raw ink of a saved project (D142). */
export function createStrokeStore(initial: readonly Stroke[] = []): StrokeStore {
  const strokes = new Map<string, Stroke>();
  let count = 0;
  for (const stroke of initial) {
    strokes.set(stroke.id, structuredClone(stroke));
    const n = /^s(\d+)$/.exec(stroke.id);
    if (n) count = Math.max(count, Number(n[1]));
  }
  const store: MutableStrokeStore = {
    nextId() {
      let id: string;
      do id = `s${++count}`;
      while (strokes.has(id));
      return id;
    },
    get(id) {
      const stroke = strokes.get(id);
      return stroke && structuredClone(stroke);
    },
    has: (id) => strokes.has(id),
    all: () => [...strokes.values()].map((s) => structuredClone(s)),
    put(stroke) {
      strokes.set(stroke.id, structuredClone(stroke));
    },
  };
  return store;
}

/** The smallest box around a stroke's points, in world units (D79). */
export function strokeBox(stroke: Stroke): Box {
  const xs = stroke.points.map((p) => p[0]);
  const ys = stroke.points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const round = (n: number) => Math.round(n * 10) / 10;
  return [round(x), round(y), round(Math.max(...xs) - x), round(Math.max(...ys) - y)];
}

/**
 * Checks a finished stroke against the contract, keeps it raw and appends its `stroke` event.
 * The same stroke sent twice is recorded once. Throws if the stroke doesn't fit the contract.
 */
export function recordStroke(story: Story, strokes: StrokeStore, input: unknown): VisEvent {
  const stroke = Stroke.parse(input);
  if (strokes.has(stroke.id)) {
    const earlier = story.all().find((e) => e.type === "stroke" && e.target === stroke.id);
    if (earlier) return earlier;
  }
  (strokes as MutableStrokeStore).put(stroke);
  return story.append({
    who: "user",
    type: "stroke",
    target: stroke.id,
    detail: { box: strokeBox(stroke), points: stroke.points.length },
  });
}
