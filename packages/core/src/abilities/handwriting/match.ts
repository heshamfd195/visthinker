// The fast matcher (D118 · D174): names a letter by your nearest saved example. Two layers, so
// it stays fast as the examples grow: a prefilter on cheap measures (stroke count, shape, loops)
// drops examples that can't be the same letter, then $P compares the point clouds of the rest. Each
// example's cloud and measures are worked out once and kept until the examples change.
import type { HandwritingExample, LetterFeatures, Stroke } from "@visthinker/contract";
import { greedyCloudMatch, normalize, type CloudPoint } from "../../comparator/symbols.ts";
import { examplePoints, exampleStrokes, type ExampleBook } from "./examples.ts";
import { letterFeatures } from "./features.ts";

export const MATCH = {
  /** Points each cloud is resampled to ($P's usual 32). */
  points: 32,
  /**
   * Sure: the nearest example is at most this far ($P distance)… On your four HELLOs (24 Nov),
   * each read against the other three, the right letter was within 1.33 (19 of 20 within 1.1),
   * but letters never taught came as close as 1.25 (a B to an E) and 1.42 (an A to an H). A wrong
   * sure costs more than a missed one, which only goes on to the cards and Claude.
   */
  sure: 1.2,
  /** …and the next letter's nearest is at least this many times farther (the least was 1.35). */
  lead: 1.25,
  /** The prefilter: stroke counts may differ by this much (an E in 1 to 4 strokes)… */
  strokes: 2,
  /** …height over width by this factor at most (an L is tall, a dash is wide)… */
  aspect: 2,
  /** …and closed loops by this many. */
  loops: 1,
  /** A distance this far scores 0; nearer scores up to 100 (the sure limit scores 60). */
  far: 3,
} as const;

/** What your examples say a letter is. */
export interface ExampleMatch {
  /** The nearest example's letter when sure, else `?`. */
  label: string;
  sure: boolean;
  /** 0–100 from the nearest distance: 100 at 0, falling to 0 at `MATCH.far`. */
  score: number;
  /** The $P distance to the nearest example. */
  distance: number;
  /** That example's id. */
  example: string;
  /** How many examples its letter has. */
  count: number;
  /** The two nearest letters, each once, nearest first. */
  guesses: { char: string; score: number; distance: number }[];
  /** How many examples the prefilter let through to $P, and how many there are. */
  compared: number;
  of: number;
}

export interface ExampleMatcher {
  /** Undefined when there are no examples yet, or none passes the prefilter. */
  match(strokes: readonly Stroke[], features?: LetterFeatures): ExampleMatch | undefined;
}

interface Entry {
  example: HandwritingExample;
  cloud: CloudPoint[];
  strokes: number;
  aspect: number;
  loops: number;
}

const toScore = (d: number) => Math.round(100 * Math.max(0, 1 - d / MATCH.far));

/** Height over width, kept off zero so a flat dash still compares. */
function aspectOf(points: readonly (readonly number[])[]): number {
  const xs = points.map((p) => p[0]!);
  const ys = points.map((p) => p[1]!);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  const size = Math.max(w, h, 1e-9);
  return Math.max(h, 0.05 * size) / Math.max(w, 0.05 * size);
}

export function createExampleMatcher(book: ExampleBook): ExampleMatcher {
  let built = -1;
  let entries: Entry[] = [];
  const counts = new Map<string, number>();

  const rebuild = () => {
    if (built === book.version()) return;
    built = book.version();
    const before = new Map(entries.map((e) => [e.example.id, e]));
    entries = book.all().map((example) => {
      const kept = before.get(example.id);
      if (kept && kept.example === example) return kept;
      const strokes = exampleStrokes(example);
      return {
        example,
        cloud: normalize(examplePoints(example), MATCH.points),
        strokes: strokes.length,
        aspect: aspectOf(strokes.flatMap((s) => s.points)),
        loops: letterFeatures(strokes).loops.length,
      };
    });
    counts.clear();
    for (const e of entries) counts.set(e.example.label, (counts.get(e.example.label) ?? 0) + 1);
  };

  return {
    match(strokes, features) {
      rebuild();
      if (entries.length === 0 || strokes.length === 0) return undefined;
      const points = strokes.map((s) => s.points.map(([x, y]): [number, number] => [x, y]));
      const aspect = aspectOf(points.flat());
      const loops = (features ?? letterFeatures(strokes)).loops.length;
      const cloud = normalize(points, MATCH.points);

      // Each letter once, by its nearest example.
      const best = new Map<string, { d: number; id: string }>();
      let compared = 0;
      for (const e of entries) {
        if (Math.abs(e.strokes - strokes.length) > MATCH.strokes) continue;
        if (Math.max(e.aspect / aspect, aspect / e.aspect) > MATCH.aspect) continue;
        if (Math.abs(e.loops - loops) > MATCH.loops) continue;
        compared++;
        const sofar = best.get(e.example.label)?.d ?? Infinity;
        const d = greedyCloudMatch(cloud, e.cloud, sofar);
        if (d < sofar) best.set(e.example.label, { d, id: e.example.id });
      }
      const ranked = [...best.entries()].sort((a, b) => a[1].d - b[1].d);
      const [top, next] = ranked;
      if (!top) return undefined;
      const [char, { d, id }] = top;
      const sure = d <= MATCH.sure && (next === undefined || next[1].d >= MATCH.lead * d);
      const round2 = (n: number) => Math.round(n * 100) / 100;
      return {
        label: sure ? char : "?",
        sure,
        score: toScore(d),
        distance: round2(d),
        example: id,
        count: counts.get(char) ?? 0,
        guesses: ranked.slice(0, 2).map(([c, m]) => ({
          char: c,
          score: toScore(m.d),
          distance: round2(m.d),
        })),
        compared,
        of: entries.length,
      };
    },
  };
}
