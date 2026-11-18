// One-stroke shapes for the alphabet (T27): a closed stroke is a box or a circle, and an open
// stroke that runs out and turns back at its far end is an arrow. Works on a copy of the points.
import type { Point2, Stroke } from "@visthinker/contract";

export const SHAPE_TOLERANCES = {
  /** Smaller than this (the larger side of the box around it) is a dot, not a shape. */
  minSize: 20,
  /** A stroke is closed when its ends are this share of its size apart, or nearer. */
  closeRatio: 0.2,
  /** Corner-finding tolerance (Douglas–Peucker), as a share of the size. */
  simplifyRatio: 0.08,
  /** A box's corners turn by 90° ± this many degrees. */
  cornerSlackDeg: 30,
  /** A circle's distance from the centre (scaled to its box) varies by at most this share. */
  maxRoundness: 0.15,
  /** An arrow's head: each wing this share of the shaft, at this angle off the shaft, in degrees. */
  headMin: 0.08,
  headMax: 0.5,
  wingMinDeg: 15,
  wingMaxDeg: 75,
} as const;

export type ShapeVerdict =
  | { kind: "box" | "circle"; confidence: number }
  | { kind: "arrow"; confidence: number; a: Point2; b: Point2 }
  | { kind: null; reason: string };

const round1 = (n: number) => Math.round(n * 10) / 10;
const dist = (p: Point2, q: Point2) => Math.hypot(p[0] - q[0], p[1] - q[1]);

function points(stroke: Stroke): Point2[] {
  const pts = stroke.points.map((p): Point2 => [p[0], p[1]]);
  return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1]![0] || p[1] !== pts[i - 1]![1]);
}

/** Douglas–Peucker: the points that matter, within `epsilon` of the path. */
export function simplify(pts: Point2[], epsilon: number): Point2[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0]!, pts.at(-1)!];
  const len = dist(a, b);
  let worst = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const d =
      len === 0
        ? dist(p, a)
        : Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len;
    if (d > worst) [worst, at] = [d, i];
  }
  if (worst <= epsilon) return [a, b];
  return [
    ...simplify(pts.slice(0, at + 1), epsilon).slice(0, -1),
    ...simplify(pts.slice(at), epsilon),
  ];
}

/** The turn at `b` between a→b and b→c, in degrees (0 = straight on). */
function turn(a: Point2, b: Point2, c: Point2): number {
  const u = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const v = Math.atan2(c[1] - b[1], c[0] - b[0]);
  let d = Math.abs(((v - u) * 180) / Math.PI) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

export function classifyShape(stroke: Stroke, tol = SHAPE_TOLERANCES): ShapeVerdict {
  const pts = points(stroke);
  if (pts.length < 3) return { kind: null, reason: "too few points" };
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const [w, h] = [x1 - x0, y1 - y0];
  const size = Math.max(w, h);
  if (size < tol.minSize) return { kind: null, reason: "too small" };

  const closed = dist(pts[0]!, pts.at(-1)!) <= tol.closeRatio * size;
  if (closed) {
    // Corners first: a box simplifies to 4 corners that each turn about 90°.
    const ring = simplify([...pts, pts[0]!], tol.simplifyRatio * size).slice(0, -1);
    if (ring.length >= 4 && ring.length <= 5) {
      const corners = ring.map((p, i) =>
        turn(ring[(i + ring.length - 1) % ring.length]!, p, ring[(i + 1) % ring.length]!),
      );
      const square = corners.filter((d) => Math.abs(d - 90) <= tol.cornerSlackDeg);
      if (square.length === 4) {
        const off = Math.max(...square.map((d) => Math.abs(d - 90))) / tol.cornerSlackDeg;
        return { kind: "box", confidence: round2(Math.max(0.5, 0.95 - 0.4 * off)) };
      }
    }
    // Then round: scaled to its box, every point is about as far from the centre.
    if (Math.min(w, h) > 0) {
      const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
      const r = pts.map(([x, y]) => Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2)));
      const mean = r.reduce((s, v) => s + v, 0) / r.length;
      const spread = Math.sqrt(r.reduce((s, v) => s + (v - mean) ** 2, 0) / r.length) / mean;
      if (spread <= tol.maxRoundness) {
        return { kind: "circle", confidence: round2(Math.max(0.5, 0.97 - spread * 2)) };
      }
    }
    return { kind: null, reason: "closed, but neither round nor four corners" };
  }

  // An arrow: out along a shaft to its tip, then the head turns back from the tip.
  const start = pts[0]!;
  // The tip is where the stroke first reaches (almost) its farthest point: a head drawn back
  // through the tip may pass a little farther on its way, and must not move the tip.
  const far = Math.max(...pts.map((p) => dist(start, p)));
  const tipIndex = pts.findIndex((p) => dist(start, p) >= 0.97 * far);
  const tip = pts[tipIndex]!;
  const shaft = dist(start, tip);
  const head = pts.slice(tipIndex + 1);
  if (head.length < 2 || shaft < tol.minSize)
    return { kind: null, reason: "no head after the tip" };
  const back = Math.atan2(start[1] - tip[1], start[0] - tip[0]);
  const wings = { left: 0, right: 0 };
  for (const p of head) {
    const d = dist(tip, p);
    if (d < tol.headMin * shaft || d > tol.headMax * shaft) continue;
    let off = ((Math.atan2(p[1] - tip[1], p[0] - tip[0]) - back) * 180) / Math.PI;
    off = ((off + 540) % 360) - 180;
    if (Math.abs(off) >= tol.wingMinDeg && Math.abs(off) <= tol.wingMaxDeg) {
      if (off > 0) wings.left++;
      else wings.right++;
    }
  }
  // The shaft itself must be straight: every point before the tip near the start–tip line.
  const before = pts.slice(0, tipIndex + 1);
  const offShaft = Math.max(
    ...before.map(
      (p) =>
        Math.abs(
          (tip[0] - start[0]) * (start[1] - p[1]) - (start[0] - p[0]) * (tip[1] - start[1]),
        ) / shaft,
    ),
  );
  if (wings.left > 0 && wings.right > 0 && offShaft <= 0.08 * shaft) {
    return {
      kind: "arrow",
      confidence: 0.85,
      a: [round1(start[0]), round1(start[1])],
      b: [round1(tip[0]), round1(tip[1])],
    };
  }
  return { kind: null, reason: "open, and no arrowhead at its far end" };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
