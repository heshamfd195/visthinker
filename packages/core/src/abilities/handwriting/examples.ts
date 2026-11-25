// Your handwriting examples (D117 · D118 · D174): the letters you taught, kept in memory for the
// Fast Brain. The canvas loads them from the bridge on start and saves them after each change; the
// book itself never touches a disk. Only the last 10 per letter are kept, newest last.
import {
  EXAMPLES_PER_LABEL,
  type ExampleSource,
  type HandwritingExample,
  type Point2,
  type Stroke,
} from "@visthinker/contract";

export interface ExampleBook {
  /** Every example, oldest first. */
  all(): readonly HandwritingExample[];
  /** How many examples each label has. */
  counts(): Map<string, number>;
  /** Adds one, dropping the oldest of its label past the limit; tells listeners. */
  add(example: HandwritingExample): void;
  /** Puts examples loaded from disk before the ones added since, then trims. */
  load(examples: readonly HandwritingExample[]): void;
  /** Goes up with every change, so a matcher knows when to rebuild its cache. */
  version(): number;
  /**
   * Called after each change, saying why: an `add` needs saving, a `load` came from disk.
   * Returns an unsubscribe function.
   */
  subscribe(
    listener: (examples: readonly HandwritingExample[], why: "add" | "load") => void,
  ): () => void;
}

/** Keeps the newest `limit` examples of each label, in their order. */
export function keepNewest(
  examples: readonly HandwritingExample[],
  limit = EXAMPLES_PER_LABEL,
): HandwritingExample[] {
  const seen = new Map<string, number>();
  const kept: HandwritingExample[] = [];
  for (let i = examples.length - 1; i >= 0; i--) {
    const e = examples[i]!;
    const n = seen.get(e.label) ?? 0;
    if (n >= limit) continue;
    seen.set(e.label, n + 1);
    kept.push(e);
  }
  return kept.reverse();
}

export function createExampleBook(initial: readonly HandwritingExample[] = []): ExampleBook {
  let examples = keepNewest(initial);
  let version = 0;
  const listeners = new Set<
    (examples: readonly HandwritingExample[], why: "add" | "load") => void
  >();
  const tell = (why: "add" | "load") => {
    for (const listener of [...listeners]) listener(examples, why);
  };
  return {
    all: () => examples,
    counts() {
      const counts = new Map<string, number>();
      for (const e of examples) counts.set(e.label, (counts.get(e.label) ?? 0) + 1);
      return counts;
    },
    add(example) {
      examples = keepNewest([...examples.filter((e) => e.id !== example.id), example]);
      version++;
      tell("add");
    },
    load(loaded) {
      const ids = new Set(examples.map((e) => e.id));
      examples = keepNewest([...loaded.filter((e) => !ids.has(e.id)), ...examples]);
      version++;
      tell("load");
    },
    version: () => version,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * A letter's strokes as an example: points moved so its box starts at 0, 0 and rounded to one
 * decimal, each stroke's start kept after the first, so it can be matched and played back (D172).
 */
export function exampleFrom(
  strokes: readonly Stroke[],
  named: { id: string; label: string; from: ExampleSource; at: string },
): HandwritingExample {
  const drawn = [...strokes].sort((a, b) => a.t0 - b.t0);
  const xs = drawn.flatMap((s) => s.points.map((p) => p[0]));
  const ys = drawn.flatMap((s) => s.points.map((p) => p[1]));
  const [x0, y0, t0] = [Math.min(...xs), Math.min(...ys), drawn[0]?.t0 ?? 0];
  return {
    ...named,
    strokes: drawn.map((s) => ({
      t: Math.max(0, Math.round(s.t0 - t0)),
      points: s.points.map(([x, y, p, dt]) => [round1(x - x0), round1(y - y0), p, dt]),
    })),
  };
}

/** An example's strokes as point lists, for $P. */
export const examplePoints = (example: HandwritingExample): Point2[][] =>
  example.strokes.map((s) => s.points.map(([x, y]): Point2 => [x, y]));

/** An example's strokes as `Stroke`s, to measure them like a letter on the canvas. */
export const exampleStrokes = (example: HandwritingExample): Stroke[] =>
  example.strokes.map((s, i) => ({
    id: `${example.id}.${i}`,
    t0: s.t,
    tool: "pen",
    color: "ink",
    width: 4,
    points: s.points,
  }));
