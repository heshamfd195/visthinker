// The fast matcher (D118 · D174): names a letter by your nearest saved example. Two layers, so
// it stays fast as the examples grow: a prefilter on cheap measures (stroke count, shape, loops)
// drops examples that can't be the same letter, then $P compares the point clouds of the rest. Each
// example's cloud and measures are worked out once and kept until the examples change.
import type { HandwritingExample, LetterFeatures, Point2, Stroke } from "@visthinker/contract";
import { greedyCloudMatch, normalize, type CloudPoint } from "../../comparator/symbols.ts";
import { examplePoints, exampleStrokes, type ExampleBook } from "./examples.ts";
import { letterFeatures } from "./features.ts";
import { rotate } from "./read.ts";

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
  /**
   * D177: with no other letter to compare against (only one letter taught, or the prefilter left
   * one), the lead says nothing, so a match must be this close to be sure. With only a 2 and two
   * Bs taught (25 Nov), an untaught H came within 1.2 of a B; a B of the same style, within 1.0.
   */
  alone: 1.0,
  /** The prefilter: stroke counts may differ by this much (an E in 1 to 4 strokes)… */
  strokes: 2,
  /** …height over width by this factor at most (an L is tall, a dash is wide)… */
  aspect: 2,
  /** …and closed loops by this many. */
  loops: 1,
  /**
   * Turns tried when a letter isn't sure as drawn: $P doesn't allow for rotation, and a 20° tilted
   * M was nearest a G upright but an M turned back (25 Nov). The first each way, then the rest on
   * the side that came nearer: four tries, not six.
   */
  turns: [20, 10, 30],
  /** …against only the letters this near as drawn (twice the sure limit). */
  near: 2.4,
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
  /** Degrees clockwise on the page it was turned back by to match; missing when matched as drawn. */
  turn?: number;
}

export interface ExampleMatcher {
  /** Undefined when there are no examples yet, or none passes the prefilter. */
  match(strokes: readonly Stroke[], features?: LetterFeatures): ExampleMatch | undefined;
  /** How many examples a letter has (0 for a letter you never taught). */
  count(label: string): number;
}

interface Entry {
  example: HandwritingExample;
  cloud: CloudPoint[];
  strokes: number;
  aspect: number;
  loops: number;
}

/** The middle of a letter's box, to turn it about. */
function centre(strokes: readonly Stroke[]): Point2 {
  const xs = strokes.flatMap((s) => s.points.map((p) => p[0]));
  const ys = strokes.flatMap((s) => s.points.map((p) => p[1]));
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
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

  /** One try: the letter as given, or turned by `turn` degrees. */
  /**
   * `cutoff`: $P stops on an example past it, and a letter none of whose examples came nearer is
   * ranked at the cutoff, a floor. With the cutoff at MATCH.sure × MATCH.lead, which letters come
   * out sure is the same, and a turned try costs a fraction of a full one.
   */
  const matchOnce = (
    strokes: readonly Stroke[],
    loops: number,
    turn: number,
    cutoff = Infinity,
    only?: ReadonlySet<string>,
  ) => {
    const about = centre(strokes);
    const points = strokes.map((s) =>
      s.points.map(([x, y]): Point2 => (turn ? rotate([x, y], about, -turn) : [x, y])),
    );
    const aspect = aspectOf(points.flat());
    const cloud = normalize(points, MATCH.points);

    // Each letter once, by its nearest example.
    const best = new Map<string, { d: number; id: string }>();
    let compared = 0;
    for (const e of entries) {
      if (Math.abs(e.strokes - strokes.length) > MATCH.strokes) continue;
      if (Math.max(e.aspect / aspect, aspect / e.aspect) > MATCH.aspect) continue;
      if (Math.abs(e.loops - loops) > MATCH.loops) continue;
      if (only && !only.has(e.example.label)) continue;
      compared++;
      const sofar = Math.min(best.get(e.example.label)?.d ?? Infinity, cutoff);
      const d = greedyCloudMatch(cloud, e.cloud, sofar);
      if (d < sofar) best.set(e.example.label, { d, id: e.example.id });
      else if (!best.has(e.example.label))
        best.set(e.example.label, { d: cutoff, id: e.example.id });
    }
    const ranked = [...best.entries()].sort((a, b) => a[1].d - b[1].d);
    const [top, next] = ranked;
    if (!top) return undefined;
    const [char, { d, id }] = top;
    const sure = next ? d <= MATCH.sure && next[1].d >= MATCH.lead * d : d <= MATCH.alone;
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const match: ExampleMatch = {
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
      ...(turn ? { turn } : {}),
    };
    return { match, d, ranked };
  };

  return {
    match(strokes, features) {
      rebuild();
      if (entries.length === 0 || strokes.length === 0) return undefined;
      const loops = (features ?? letterFeatures(strokes)).loops.length;
      const upright = matchOnce(strokes, loops, 0);
      if (upright?.match.sure) return upright.match;
      // Not sure as drawn: a tilted letter may be sure turned back a little, as the cards do.
      // A turn counts only if it's sure by the same rules; else the nearest guess is kept.
      let best = upright;
      // Only letters already near as drawn: a small turn doesn't bring a far one close.
      const near = new Set(
        (upright?.ranked ?? []).filter(([, m]) => m.d <= MATCH.near).map(([c]) => c),
      );
      if (near.size === 0) return upright?.match;
      const tryTurn = (turn: number) => {
        const tried = matchOnce(strokes, loops, turn, MATCH.sure * MATCH.lead, near);
        if (!tried) return Infinity;
        if (tried.match.sure && !best?.match.sure) best = tried;
        // An unsure turn replaces the guess only when nearer than the cutoff (its distance is exact).
        else if (
          tried.match.sure === !!best?.match.sure &&
          tried.d < MATCH.sure * MATCH.lead &&
          tried.d < (best?.d ?? Infinity)
        )
          best = tried;
        return tried.d;
      };
      // Coarse, then fine: 20° each way, then 10° and 30° on the side that came nearer.
      const [mid, ...side] = MATCH.turns;
      const way = tryTurn(mid) <= tryTurn(-mid) ? 1 : -1;
      for (const deg of side) tryTurn(way * deg);
      return best?.match;
    },
    count(label) {
      rebuild();
      return counts.get(label) ?? 0;
    },
  };
}
