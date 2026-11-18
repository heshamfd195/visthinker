// The cross rule (D96): two roughly straight strokes that cross are an X wherever they cross.
// Pure geometry; grouping strokes into one object comes with segmentation (T29).
import type { Point2 } from "@visthinker/contract";

/** How forgiving the cross rule is. */
export const CROSS_RULE = {
  /** Path share trimmed off each end before fitting, so a hook doesn't count. */
  trim: 0.15,
  /** The trimmed middle may stray this share of its length from the fitted line. */
  maxDeviation: 0.12,
  /**
   * Both strokes must run on past the crossing by this share of their length on each side:
   * meeting at an end (a V, an L, a T, a 1 on its base) is not an X.
   */
  through: 0.1,
  minAngleDeg: 35,
  maxAngleDeg: 145,
  maxLengthRatio: 3,
} as const;

interface Segment {
  a: Point2;
  b: Point2;
  length: number;
  /** Worst distance from the line, as a share of what the rule allows (0 = perfectly straight). */
  bend: number;
}

/** Fits a loose segment to a stroke: direction from its middle, extent from all its points. */
function looseSegment(points: Point2[], rule = CROSS_RULE): Segment | undefined {
  if (points.length < 2) return undefined;
  const cum = [0];
  for (let i = 1; i < points.length; i++)
    cum.push(
      cum[i - 1]! +
        Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]),
    );
  const total = cum.at(-1)!;
  if (total === 0) return undefined;
  const middle = points.filter(
    (_, i) => cum[i]! >= rule.trim * total && cum[i]! <= (1 - rule.trim) * total,
  );
  const fitOn = middle.length >= 2 ? middle : points;

  const n = fitOn.length;
  const cx = fitOn.reduce((t, p) => t + p[0], 0) / n;
  const cy = fitOn.reduce((t, p) => t + p[1], 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of fitOn) {
    sxx += (x - cx) ** 2;
    syy += (y - cy) ** 2;
    sxy += (x - cx) * (y - cy);
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const dir: Point2 = [Math.cos(angle), Math.sin(angle)];
  const along = (p: Point2) => (p[0] - cx) * dir[0] + (p[1] - cy) * dir[1];
  const across = (p: Point2) => Math.abs(-(p[0] - cx) * dir[1] + (p[1] - cy) * dir[0]);

  const midT = fitOn.map(along);
  const midLength = Math.max(...midT) - Math.min(...midT);
  if (midLength === 0) return undefined;
  const bend = Math.max(...fitOn.map(across)) / (rule.maxDeviation * midLength);
  if (bend > 1) return undefined;

  const allT = points.map(along);
  const tMin = Math.min(...allT);
  const tMax = Math.max(...allT);
  const forward = allT[0]! <= allT.at(-1)!;
  const at = (t: number): Point2 => [cx + dir[0] * t, cy + dir[1] * t];
  return {
    a: at(forward ? tMin : tMax),
    b: at(forward ? tMax : tMin),
    length: tMax - tMin,
    bend,
  };
}

/**
 * The cross rule: two roughly straight strokes that cross, at 35°–145°, no more than 3:1
 * in length, are an X wherever they cross, even off-centre. It never gives O.
 * Returns the confidence, or undefined to leave the group to $P.
 */
export function crossRule(strokes: Point2[][], rule = CROSS_RULE): { score: number } | undefined {
  if (strokes.length !== 2) return undefined;
  const [s1, s2] = strokes.map((s) => looseSegment(s, rule));
  if (!s1 || !s2) return undefined;
  if (Math.max(s1.length, s2.length) > rule.maxLengthRatio * Math.min(s1.length, s2.length))
    return undefined;

  const d1: Point2 = [s1.b[0] - s1.a[0], s1.b[1] - s1.a[1]];
  const d2: Point2 = [s2.b[0] - s2.a[0], s2.b[1] - s2.a[1]];
  const cross = d1[0] * d2[1] - d1[1] * d2[0];
  const sin = Math.abs(cross) / (s1.length * s2.length);
  const deg = (Math.asin(Math.min(1, sin)) * 180) / Math.PI; // the acute angle, 0–90
  // 35°–145° between two undirected strokes is an acute angle of at least 35°.
  if (deg < Math.max(rule.minAngleDeg, 180 - rule.maxAngleDeg)) return undefined;

  const w: Point2 = [s2.a[0] - s1.a[0], s2.a[1] - s1.a[1]];
  const t = (w[0] * d2[1] - w[1] * d2[0]) / cross; // along s1, 0..1
  const u = (w[0] * d1[1] - w[1] * d1[0]) / cross; // along s2, 0..1
  const through = (v: number) => v >= rule.through && v <= 1 - rule.through;
  if (!through(t) || !through(u)) return undefined; // they only meet at an end: V, L, T, ⊥

  // 1 for two straight strokes crossing square on; down to about 0.6 at the limits.
  const straight = 1 - 0.5 * Math.max(s1.bend, s2.bend);
  const square = Math.sin((deg * Math.PI) / 180);
  return { score: Math.round(Math.min(1, straight * (0.4 + 0.6 * square)) * 100) / 100 };
}
