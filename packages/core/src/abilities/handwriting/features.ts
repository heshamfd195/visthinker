// The handwriting ability, step 1 (T51 · D111 · D112 · D161): the measured parts of one letter.
// A group of strokes becomes lines and curves, where their ends meet, where lines cross and how far
// along each, and closed loops. Every tolerance and every result is a share of the letter's own
// box, never pixels, so a tiny A and a huge A read the same. Order never counts: a ∧ drawn in one
// stroke gives the same two legs as two strokes. Works on copies of the points, never the raw
// stroke (D88). Measured on the page's axes for now; a tilted word's own baseline comes later.
import type { Box, Point2, Stroke } from "@visthinker/contract";
import { crossingPoint, fitLine, LINE_TOLERANCES } from "../../comparator/geometry.ts";
import type { LineTolerances } from "../../comparator/geometry.ts";
import { simplify } from "../../comparator/shapes.ts";
import { boxAround } from "../../scene/transform.ts";

/** How forgiving the reading is. Each length is a share of the letter's size (its larger side). */
export const FEATURE_TOLERANCES = {
  /** Douglas–Peucker tolerance when looking for corners. */
  simplify: 0.04,
  /** A corner turns at least this many degrees… */
  cornerDeg: 60,
  /** …measured over this much path on each side, so a curve's gentle bends never count. */
  cornerWindow: 0.15,
  /** Pieces shorter than this along their path (a hook, a rounded corner's middle) are dropped. */
  minPart: 0.08,
  /** Two pieces of one stroke closer to parallel than this are one line drawn twice (a retrace). */
  mergeDeg: 15,
  /** Ends this close meet (legs that almost meet still do). */
  meet: 0.12,
  /** A line may stop this short of another and still cross it (a bar that stops short). */
  crossGap: 0.1,
  /** Lines closer to parallel than this many degrees never cross. */
  crossMinDeg: 20,
  /** A stroke whose end comes back this close… */
  loopClose: 0.15,
  /** …to a point in this first share of its own path closes (an O that overshoots, too). */
  loopStart: 0.2,
  /** A loop is at least this big on its larger side. */
  loopMin: 0.2,
  /** Room for the pen's wobble when fitting a short line. */
  lineWobble: 0.03,
  /**
   * A hand-drawn leg may bow this share of its length and still be a line (a real A's left leg
   * bowed 6%; the comparator's straight-line test allows 4%)…
   */
  lineBow: 0.08,
  /** …and stray this share of its length from the fitted line. */
  lineDeviation: 0.1,
} as const;

export type FeatureTolerances = Record<keyof typeof FEATURE_TOLERANCES, number>;

export type PartEnd = "a" | "b";

interface PartBase {
  /** Which stroke of the group it came from, in drawing order. */
  stroke: number;
  /** Its ends in the letter's box (0–1, top left is 0, y grows down); `a` was drawn first. */
  a: Point2;
  b: Point2;
  /** A share of the letter's size: a line end to end, a curve along its path. */
  length: number;
}

export interface LinePart extends PartBase {
  kind: "line";
  /** Degrees from flat, 0–180 with y up: 90 is upright, under 90 leans right (/), over leans left (\). */
  angle: number;
}

export interface CurvePart extends PartBase {
  kind: "curve";
}

export type LetterPart = LinePart | CurvePart;

/** Two parts whose ends land close together, like the top of an A. */
export interface PartMeet {
  /** Indexes into `parts`, the lower first. */
  parts: [number, number];
  ends: [PartEnd, PartEnd];
  at: Point2;
  /** How far apart the two ends are, a share of the letter's size. */
  gap: number;
}

/** Two lines that cross, or one that touches the other's body (a T, an H's bar). */
export interface PartCrossing {
  /** Indexes into `parts`, the lower first; both are lines. */
  parts: [number, number];
  /** How far along the first line it is (0 at its `a`, 1 at its `b`); near 0 or 1 is a touch. */
  t: number;
  /** The same along the second line. */
  u: number;
  at: Point2;
  /** The smaller angle between the two lines, 0–90. */
  angle: number;
}

/** A stroke that closes on itself around a curve, like an O or the bowl of a P drawn in one go. */
export interface LetterLoop {
  stroke: number;
  center: Point2;
  /** Its size, each a share of the letter's size. */
  width: number;
  height: number;
}

export interface LetterFeatures {
  strokes: number;
  /** The letter's box in world units; everything else is measured against it. */
  box: Box;
  /** Height over width. */
  aspect: number;
  parts: LetterPart[];
  meets: PartMeet[];
  crossings: PartCrossing[];
  loops: LetterLoop[];
}

/** A part while it is still being read, in world units. */
interface WorldPart {
  kind: "line" | "curve";
  stroke: number;
  a: Point2;
  b: Point2;
  length: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100 || 0;
const dist = (p: Point2, q: Point2) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const mid = (p: Point2, q: Point2): Point2 => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];

/** Reads one letter's strokes into its measured parts. */
export function letterFeatures(
  strokes: readonly Stroke[],
  tol: FeatureTolerances = FEATURE_TOLERANCES,
): LetterFeatures {
  const paths = strokes.map((s) => distinct(s.points.map((p): Point2 => [p[0], p[1]])));
  const all = paths.flat();
  const empty = { parts: [], meets: [], crossings: [], loops: [] };
  if (all.length === 0) return { strokes: strokes.length, box: [0, 0, 0, 0], aspect: 1, ...empty };
  const box = boxAround(all);
  const size = Math.max(box[2], box[3]);
  const aspect = round2(box[3] / Math.max(box[2], 0.05 * size, 1e-9));
  if (size === 0) return { strokes: strokes.length, box, aspect, ...empty };

  // Positions as shares of the box on each axis; a very thin letter (an I) gets a floor.
  const spanX = Math.max(box[2], 0.05 * size);
  const spanY = Math.max(box[3], 0.05 * size);
  const rel = (p: Point2): Point2 => [
    round2((p[0] - box[0]) / spanX),
    round2((p[1] - box[1]) / spanY),
  ];
  const share = (n: number) => round2(n / size);

  const lineTol: LineTolerances = {
    ...LINE_TOLERANCES,
    maxBowRatio: tol.lineBow,
    maxDeviationRatio: tol.lineDeviation,
    minLength: tol.minPart * size,
    minDeviation: Math.max(0.5, tol.lineWobble * size),
    minBow: Math.max(0.5, 0.75 * tol.lineWobble * size),
  };
  const world = paths.flatMap((path, i) =>
    mergeRetraces(
      piecesOf(path, size, tol).map((piece) => partOf(piece, i, strokes[i]!, lineTol)),
      size,
      tol,
    ),
  );

  const parts = world.map((p): LetterPart => {
    const base = { stroke: p.stroke, a: rel(p.a), b: rel(p.b), length: share(p.length) };
    return p.kind === "line"
      ? { kind: "line", ...base, angle: round1(angleOf(p)) }
      : { kind: "curve", ...base };
  });

  const meets: PartMeet[] = [];
  for (let i = 0; i < world.length; i++)
    for (let j = i + 1; j < world.length; j++)
      for (const m of meetsBetween(world[i]!, world[j]!, tol.meet * size))
        meets.push({ parts: [i, j], ends: m.ends, at: rel(m.at), gap: share(m.gap) });

  const crossings: PartCrossing[] = [];
  const crossTol = { minAngleDeg: tol.crossMinDeg, minEndGap: tol.crossGap * size, endGapRatio: 0 };
  for (let i = 0; i < world.length; i++)
    for (let j = i + 1; j < world.length; j++) {
      const [l1, l2] = [world[i]!, world[j]!];
      if (l1.kind !== "line" || l2.kind !== "line") continue;
      if (meets.some((m) => m.parts[0] === i && m.parts[1] === j)) continue;
      const at = crossingPoint(l1, l2, crossTol);
      if (!at) continue;
      const between = Math.abs(angleOf(l1) - angleOf(l2));
      crossings.push({
        parts: [i, j],
        t: round2(along(l1, at)),
        u: round2(along(l2, at)),
        at: rel(at),
        angle: round1(Math.min(between, 180 - between)),
      });
    }

  const loops: LetterLoop[] = [];
  paths.forEach((path, i) => {
    if (!world.some((p) => p.stroke === i && p.kind === "curve")) return;
    if (!closes(path, size, tol)) return;
    const b = boxAround(path);
    if (Math.max(b[2], b[3]) < tol.loopMin * size) return;
    loops.push({
      stroke: i,
      center: rel([b[0] + b[2] / 2, b[1] + b[3] / 2]),
      width: share(b[2]),
      height: share(b[3]),
    });
  });

  return { strokes: strokes.length, box, aspect, parts, meets, crossings, loops };
}

/** Splits a stroke at its sharp corners and drops the tiny pieces (hooks, rounded corners). */
function piecesOf(path: Point2[], size: number, tol: FeatureTolerances): Point2[][] {
  if (path.length < 2) return [];
  // `simplify` keeps the very point objects it was given, so they map back to their places.
  const place = new Map(path.map((p, i) => [p, i]));
  const kept = simplify(path, tol.simplify * size).map((p) => place.get(p)!);
  const cum = cumulative(path);
  const corners = kept
    .slice(1, -1)
    .filter((i) => windowTurn(path, cum, i, tol.cornerWindow * size) >= tol.cornerDeg);
  const cuts = [0, ...corners, path.length - 1];
  const pieces: Point2[][] = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const [from, to] = [cuts[k]!, cuts[k + 1]!];
    if (cum[to]! - cum[from]! >= tol.minPart * size) pieces.push(path.slice(from, to + 1));
  }
  return pieces;
}

/** A piece is a line if it fits one, otherwise a curve. */
function partOf(
  piece: Point2[],
  stroke: number,
  source: Stroke,
  lineTol: LineTolerances,
): WorldPart {
  const verdict = fitLine({ ...source, points: piece.map((p) => [p[0], p[1], 0.5, 0]) }, lineTol);
  if (verdict.line) {
    const { a, b, length } = verdict.fit;
    return { kind: "line", stroke, a, b, length };
  }
  const cum = cumulative(piece);
  return { kind: "curve", stroke, a: piece[0]!, b: piece.at(-1)!, length: cum.at(-1)! };
}

/** Two lines in a row of one stroke, nearly parallel and on top of each other, are one line. */
function mergeRetraces(parts: WorldPart[], size: number, tol: FeatureTolerances): WorldPart[] {
  const out: WorldPart[] = [];
  for (const part of parts) {
    const prev = out.at(-1);
    if (prev && prev.kind === "line" && part.kind === "line" && sameLine(prev, part, size, tol))
      out[out.length - 1] = merged(prev, part);
    else out.push(part);
  }
  return out;
}

function sameLine(l1: WorldPart, l2: WorldPart, size: number, tol: FeatureTolerances): boolean {
  const diff = Math.abs(angleOf(l1) - angleOf(l2));
  if (Math.min(diff, 180 - diff) > tol.mergeDeg) return false;
  const [long, short] = l1.length >= l2.length ? [l1, l2] : [l2, l1];
  return Math.max(offLine(long, short.a), offLine(long, short.b)) <= tol.meet * size;
}

/** The union of two near-parallel lines along the longer one; `a` stays at the first one's start. */
function merged(first: WorldPart, second: WorldPart): WorldPart {
  const long = first.length >= second.length ? first : second;
  const ts = [first.a, first.b, second.a, second.b].map((p) => along(long, p));
  const at = (t: number): Point2 => [
    round1(long.a[0] + (long.b[0] - long.a[0]) * t),
    round1(long.a[1] + (long.b[1] - long.a[1]) * t),
  ];
  let [a, b] = [at(Math.min(...ts)), at(Math.max(...ts))];
  if (dist(b, first.a) < dist(a, first.a)) [a, b] = [b, a];
  return { kind: "line", stroke: first.stroke, a, b, length: dist(a, b) };
}

/** Each pair of ends within `reach`, closest taken first, each end used once; `a` ends listed first. */
function meetsBetween(p1: WorldPart, p2: WorldPart, reach: number) {
  const pairs = (["a", "b"] as const).flatMap((e1) =>
    (["a", "b"] as const).map((e2) => ({
      ends: [e1, e2] as [PartEnd, PartEnd],
      gap: dist(p1[e1], p2[e2]),
      at: mid(p1[e1], p2[e2]),
    })),
  );
  const chosen: typeof pairs = [];
  for (const pair of pairs.filter((m) => m.gap <= reach).sort((x, y) => x.gap - y.gap))
    if (!chosen.some((c) => c.ends[0] === pair.ends[0] || c.ends[1] === pair.ends[1]))
      chosen.push(pair);
  return chosen.sort((x, y) => x.ends.join().localeCompare(y.ends.join()));
}

/** Does the stroke come back to its start, or run past it? */
function closes(path: Point2[], size: number, tol: FeatureTolerances): boolean {
  const cum = cumulative(path);
  const total = cum.at(-1)!;
  const end = path.at(-1)!;
  const reach = tol.loopClose * size;
  return (
    path.some((p, i) => cum[i]! <= tol.loopStart * total && dist(p, end) <= reach) &&
    total > 2 * reach
  );
}

/** Degrees the path turns at point `i`, judged from `window` of path before and after it. */
function windowTurn(path: Point2[], cum: number[], i: number, window: number): number {
  let before = i;
  while (before > 0 && cum[i]! - cum[before]! < window) before--;
  let after = i;
  while (after < path.length - 1 && cum[after]! - cum[i]! < window) after++;
  const [p, q, r] = [path[before]!, path[i]!, path[after]!];
  const u = Math.atan2(q[1] - p[1], q[0] - p[0]);
  const v = Math.atan2(r[1] - q[1], r[0] - q[0]);
  let d = Math.abs(((v - u) * 180) / Math.PI) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/** Undirected degrees from flat, 0–180, with y up. */
function angleOf(l: { a: Point2; b: Point2 }): number {
  const deg = (Math.atan2(-(l.b[1] - l.a[1]), l.b[0] - l.a[0]) * 180) / Math.PI;
  return ((deg % 180) + 180) % 180;
}

/** Where `p` falls along a line, 0 at `a` and 1 at `b`. */
function along(l: { a: Point2; b: Point2 }, p: Point2): number {
  const d: Point2 = [l.b[0] - l.a[0], l.b[1] - l.a[1]];
  const len2 = d[0] ** 2 + d[1] ** 2;
  return len2 === 0 ? 0 : ((p[0] - l.a[0]) * d[0] + (p[1] - l.a[1]) * d[1]) / len2;
}

/** How far `p` is from the infinite line through `l`. */
function offLine(l: { a: Point2; b: Point2 }, p: Point2): number {
  const len = dist(l.a, l.b);
  if (len === 0) return dist(l.a, p);
  return Math.abs((l.b[0] - l.a[0]) * (l.a[1] - p[1]) - (l.a[0] - p[0]) * (l.b[1] - l.a[1])) / len;
}

function cumulative(path: Point2[]): number[] {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1]! + dist(path[i]!, path[i - 1]!));
  return cum;
}

function distinct(points: Point2[]): Point2[] {
  return points.filter(
    (p, i) => i === 0 || p[0] !== points[i - 1]![0] || p[1] !== points[i - 1]![1],
  );
}
