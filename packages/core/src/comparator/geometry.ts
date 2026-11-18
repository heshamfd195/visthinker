// Real geometry for the comparator (D64 · D89): fit a straight line to a hand-drawn
// stroke, and intersect two fitted lines. Works on a copy of the points, never the raw stroke (D88).
import type { Point2, Stroke } from "@visthinker/contract";

/** How forgiving the line test is. World units unless noted. */
export const LINE_TOLERANCES = {
  /** Shorter than this (end to end, along the fit) is a dot or a tick, not a line. */
  minLength: 20,
  /** No point may be further from the fitted line than this share of its length… */
  maxDeviationRatio: 0.06,
  /** …but short lines always get at least this much room for the pen's wobble. */
  minDeviation: 4,
  /** A steady bow (the quadratic part of the residual) above this share of the length is a curve. */
  maxBowRatio: 0.04,
  minBow: 3,
  /** Drawn path length over line length: catches back-and-forth scribbles along one line. */
  maxPathRatio: 1.15,
} as const;

export const CROSSING_TOLERANCES = {
  /** Lines closer to parallel than this many degrees never cross. */
  minAngleDeg: 20,
  /** A line may stop this short of the other one and still count as crossing it… */
  minEndGap: 10,
  /** …or this share of its own length, whichever is larger. */
  endGapRatio: 0.05,
} as const;

export interface LineFit {
  /** The end nearest the first point drawn. */
  a: Point2;
  b: Point2;
  length: number;
  /** Largest distance of a point from the fitted line. */
  maxDeviation: number;
  /** Size of the steady bow, in world units (a curve has a big one, a wobble a small one). */
  bow: number;
  pathRatio: number;
  /** 0.5–0.99, higher when the points hug the line. */
  confidence: number;
}

export type LineVerdict = { line: true; fit: LineFit } | { line: false; reason: string };

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Is this stroke a straight line? Total least squares (the principal axis of the points),
 * then three checks: every point near the axis, no steady bow, no doubling back.
 */
export function fitLine(stroke: Stroke, tol = LINE_TOLERANCES): LineVerdict {
  const pts = dedupe(stroke.points.map((p): Point2 => [p[0], p[1]]));
  if (pts.length < 2) return { line: false, reason: "fewer than two distinct points" };

  const n = pts.length;
  const cx = pts.reduce((s, p) => s + p[0], 0) / n;
  const cy = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of pts) {
    sxx += (x - cx) ** 2;
    syy += (y - cy) ** 2;
    sxy += (x - cx) * (y - cy);
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const dir: Point2 = [Math.cos(angle), Math.sin(angle)];
  const normal: Point2 = [-dir[1], dir[0]];

  const along = pts.map(([x, y]) => (x - cx) * dir[0] + (y - cy) * dir[1]);
  const across = pts.map(([x, y]) => (x - cx) * normal[0] + (y - cy) * normal[1]);
  const tMin = Math.min(...along);
  const tMax = Math.max(...along);
  const length = tMax - tMin;
  if (length < tol.minLength) return { line: false, reason: `too short (${round1(length)})` };

  const maxDeviation = Math.max(...across.map(Math.abs));
  const allowedDeviation = Math.max(tol.minDeviation, tol.maxDeviationRatio * length);
  const bow = quadraticBow(along, across, tMin, tMax);
  const allowedBow = Math.max(tol.minBow, tol.maxBowRatio * length);
  let path = 0;
  for (let i = 1; i < n; i++)
    path += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  const pathRatio = path / length;

  if (maxDeviation > allowedDeviation)
    return { line: false, reason: `a point is ${round1(maxDeviation)} off the line` };
  if (bow > allowedBow) return { line: false, reason: `bends by ${round1(bow)}: a curve` };
  if (pathRatio > tol.maxPathRatio)
    return { line: false, reason: `path is ${round2(pathRatio)}× the line: doubles back` };

  const at = (t: number): Point2 => [round1(cx + dir[0] * t), round1(cy + dir[1] * t)];
  const forward = along[0]! <= along[n - 1]!;
  const confidence = round2(
    clamp(1 - 0.5 * Math.max(maxDeviation / allowedDeviation, bow / allowedBow), 0.5, 0.99),
  );
  return {
    line: true,
    fit: {
      a: at(forward ? tMin : tMax),
      b: at(forward ? tMax : tMin),
      length: round1(length),
      maxDeviation: round2(maxDeviation),
      bow: round2(bow),
      pathRatio: round2(pathRatio),
      confidence,
    },
  };
}

/**
 * Where two segments cross, if they do. Each may stop a little short of the other (hand drawing).
 * Returns null for near-parallel lines.
 */
export function crossingPoint(
  l1: { a: Point2; b: Point2 },
  l2: { a: Point2; b: Point2 },
  tol = CROSSING_TOLERANCES,
): Point2 | null {
  const d1: Point2 = [l1.b[0] - l1.a[0], l1.b[1] - l1.a[1]];
  const d2: Point2 = [l2.b[0] - l2.a[0], l2.b[1] - l2.a[1]];
  const len1 = Math.hypot(...d1);
  const len2 = Math.hypot(...d2);
  if (len1 === 0 || len2 === 0) return null;
  const cross = d1[0] * d2[1] - d1[1] * d2[0];
  const sin = Math.abs(cross) / (len1 * len2);
  if (sin < Math.sin((tol.minAngleDeg * Math.PI) / 180)) return null;

  const w: Point2 = [l2.a[0] - l1.a[0], l2.a[1] - l1.a[1]];
  const t = (w[0] * d2[1] - w[1] * d2[0]) / cross; // along l1, 0..1
  const u = (w[0] * d1[1] - w[1] * d1[0]) / cross; // along l2, 0..1
  const slack1 = Math.max(tol.minEndGap, tol.endGapRatio * len1) / len1;
  const slack2 = Math.max(tol.minEndGap, tol.endGapRatio * len2) / len2;
  if (t < -slack1 || t > 1 + slack1 || u < -slack2 || u > 1 + slack2) return null;
  return [round1(l1.a[0] + d1[0] * t), round1(l1.a[1] + d1[1] * t)];
}

/** Least-squares fit of across = c0 + c1·s + c2·s² with s in [-1, 1]; |c2| is the bow's sagitta. */
function quadraticBow(along: number[], across: number[], tMin: number, tMax: number): number {
  const mid = (tMin + tMax) / 2;
  const half = (tMax - tMin) / 2 || 1;
  // Normal equations for [1, s, s²].
  const m = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const v = [0, 0, 0];
  for (let i = 0; i < along.length; i++) {
    const s = (along[i]! - mid) / half;
    const basis = [1, s, s * s];
    for (let r = 0; r < 3; r++) {
      v[r]! += basis[r]! * across[i]!;
      for (let c = 0; c < 3; c++) m[r]![c]! += basis[r]! * basis[c]!;
    }
  }
  const solution = solve3(m, v);
  return solution ? Math.abs(solution[2]) : 0;
}

function solve3(m: number[][], v: number[]): [number, number, number] | null {
  const det = (a: number[][]) =>
    a[0]![0]! * (a[1]![1]! * a[2]![2]! - a[1]![2]! * a[2]![1]!) -
    a[0]![1]! * (a[1]![0]! * a[2]![2]! - a[1]![2]! * a[2]![0]!) +
    a[0]![2]! * (a[1]![0]! * a[2]![1]! - a[1]![1]! * a[2]![0]!);
  const d = det(m);
  if (Math.abs(d) < 1e-9) return null;
  const col = (k: number) => m.map((row, r) => row.map((x, c) => (c === k ? v[r]! : x)));
  return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d];
}

function dedupe(points: Point2[]): Point2[] {
  return points.filter(
    (p, i) => i === 0 || p[0] !== points[i - 1]![0] || p[1] !== points[i - 1]![1],
  );
}
