import type { Point2, Stroke } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import type { LetterFeatures } from "@visthinker/contract";
import { letterFeatures } from "./index.ts";

/** A hand-drawn line: evenly spaced points with a small steady wobble across it. */
const line = (a: Point2, b: Point2, n = 16, wobble = 0.8): Point2[] => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const normal: Point2 = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
  return Array.from({ length: n + 1 }, (_, i) => {
    const off = i === 0 || i === n ? 0 : wobble * Math.sin(i * 2.1);
    return [
      a[0] + ((b[0] - a[0]) * i) / n + normal[0] * off,
      a[1] + ((b[1] - a[1]) * i) / n + normal[1] * off,
    ];
  });
};
/** Several lines drawn without lifting the pen. */
const path = (...corners: Point2[]): Point2[] =>
  corners.slice(1).flatMap((c, i) => line(corners[i]!, c).slice(i === 0 ? 0 : 1));
const ring = (cx: number, cy: number, rx: number, ry: number, turns = 1): Point2[] =>
  Array.from({ length: 49 }, (_, i) => {
    const t = (i / 48) * turns * 2 * Math.PI;
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  });

let next = 0;
const stroke = (points: Point2[]): Stroke => ({
  id: `s${next++}`,
  t0: 0,
  tool: "pen",
  color: "#fff",
  width: 2,
  points: points.map(([x, y], i) => [x, y, 0.5, i * 8]),
});
const read = (...paths: Point2[][]) => letterFeatures(paths.map(stroke));
const scaled = (strokes: Stroke[], k: number, dx: number, dy: number): Stroke[] =>
  strokes.map((s) => ({
    ...s,
    points: s.points.map((p) => [p[0] * k + dx, p[1] * k + dy, p[2], p[3]]),
  }));

// An A in a 60 × 80 box (y grows down): legs from the bottom corners to the apex, a bar 60% down.
const BL: Point2 = [0, 80];
const APEX: Point2 = [30, 0];
const BR: Point2 = [60, 80];
const BAR: [Point2, Point2] = [
  [10, 48],
  [50, 48],
];

/** What the A card will check, read off the features (order free). */
function readA(f: LetterFeatures) {
  const lines = f.parts.flatMap((p, i) => (p.kind === "line" ? [{ ...p, i }] : []));
  const legs = lines.filter((l) => l.length >= 0.7);
  const bars = lines.filter((l) => l.length < 0.7);
  const isLeg = (i: number) => legs.some((l) => l.i === i);
  const apex = f.meets.find((m) => isLeg(m.parts[0]) && isLeg(m.parts[1]));
  const bar = bars.length === 1 ? bars[0]!.i : -1;
  const crossings = f.crossings.filter(
    (c) => c.parts.includes(bar) && isLeg(c.parts[0] === bar ? c.parts[1] : c.parts[0]),
  );
  const round = (n: number) => Math.round(n * 10) / 10 || 0;
  return {
    legs: legs.length,
    bars: bars.length,
    slants: legs.map((l) => (l.angle < 90 ? "/" : "\\")).sort(),
    legsTilt60to80: legs.every(
      (l) => Math.min(l.angle, 180 - l.angle) >= 60 && Math.min(l.angle, 180 - l.angle) <= 80,
    ),
    apexY: apex ? round(apex.at[1]) : null,
    barCrossesLegs: crossings.length,
    barY: crossings.length
      ? round(crossings.reduce((s, c) => s + c.at[1], 0) / crossings.length)
      : null,
    loops: f.loops.length,
  };
}

const A_READ = {
  legs: 2,
  bars: 1,
  slants: ["/", "\\"],
  legsTilt60to80: true,
  apexY: 0,
  barCrossesLegs: 2,
  barY: 0.6,
  loops: 0,
};

describe("letter features: an A (T51 · D112)", () => {
  it("three strokes: two legs that meet at the top, a bar crossing both 60% down", () => {
    const f = read(line(BL, APEX), line(APEX, BR), line(...BAR));
    expect(f.strokes).toBe(3);
    expect(f.box).toEqual([0, 0, 60, 80]);
    expect(f.parts.map((p) => p.kind)).toEqual(["line", "line", "line"]);
    const [left, right, bar] = f.parts as Extract<(typeof f.parts)[number], { kind: "line" }>[];
    expect(left!.angle).toBeCloseTo(69.4, 0);
    expect(right!.angle).toBeCloseTo(110.6, 0);
    expect(Math.min(bar!.angle, 180 - bar!.angle)).toBeLessThan(2);
    expect(bar!.length).toBeCloseTo(0.5, 1);
    expect(f.meets).toEqual([{ parts: [0, 1], ends: ["b", "a"], at: [0.5, 0], gap: 0 }]);
    expect(f.crossings).toHaveLength(2);
    expect(f.crossings.map((c) => [c.parts, c.t, c.u])).toEqual([
      [[0, 2], 0.4, 0.05],
      [[1, 2], 0.6, 0.95],
    ]);
    expect(f.loops).toEqual([]);
    expect(readA(f)).toEqual(A_READ);
  });

  it("two strokes, a ∧ and a bar, read the same as three", () => {
    expect(readA(read(path(BL, APEX, BR), line(...BAR)))).toEqual(A_READ);
  });

  it("one stroke that runs back up the right leg to draw the bar reads the same", () => {
    const f = read(path(BL, APEX, BR, [48, 48], [10, 48]));
    expect(f.parts).toHaveLength(3);
    expect(readA(f)).toEqual(A_READ);
  });

  it("order and direction never count: bar first, legs drawn downward", () => {
    expect(readA(read(line(BAR[1], BAR[0]), line(APEX, BR), line(APEX, BL)))).toEqual(A_READ);
  });

  it("a ∧ with a rounded top and a left leg that bows (as real writing does) still has two legs", () => {
    // The left leg bows 6% of its length to the left, then rounds over the top.
    const bowed = Array.from({ length: 25 }, (_, i): Point2 => {
      const s = i / 24;
      return [30 * s - 0.06 * 85 * 4 * s * (1 - s), 80 - 76 * s];
    });
    const top: Point2[] = [
      [31, 1],
      [33, 0],
      [35, 1],
    ];
    const f = read([...bowed, ...top, ...line([36, 2], BR).slice(1)], line(...BAR));
    expect(f.parts.map((p) => p.kind)).toEqual(["line", "line", "line"]);
    expect(readA(f)).toEqual(A_READ);
  });

  it("legs that almost meet still meet, and a bar that stops short still crosses", () => {
    const f = read(line(BL, [27, 5]), line([32, 3], BR), line([15, 48], [45, 48]));
    expect(readA(f)).toEqual(A_READ);
    expect(f.meets[0]!.gap).toBeGreaterThan(0);
  });

  it("a tiny A and a huge one, anywhere, read the same: every check is a share of the box", () => {
    const strokes = [line(BL, APEX), line(APEX, BR), line(...BAR)].map(stroke);
    const small = letterFeatures(scaled(strokes, 0.25, 500, -40));
    const big = letterFeatures(scaled(strokes, 8, -2000, 300));
    expect(readA(small)).toEqual(A_READ);
    expect(readA(big)).toEqual(A_READ);
    small.parts.forEach((p, i) => {
      const q = big.parts[i]!;
      expect(Math.abs(p.length - q.length)).toBeLessThan(0.03);
      if (p.kind === "line" && q.kind === "line")
        expect(Math.abs(p.angle - q.angle)).toBeLessThan(1);
    });
  });
});

describe("letter features: H, O and the rest", () => {
  it("H: two upright legs and a bar that touches each one halfway down", () => {
    const f = read(line([0, 0], [0, 80]), line([50, 0], [50, 80]), line([0, 40], [50, 40]));
    const angles = f.parts.map((p) => (p.kind === "line" ? Math.round(p.angle) : null));
    expect(angles.slice(0, 2).every((a) => a !== null && Math.abs(a - 90) <= 2)).toBe(true);
    expect(f.meets).toEqual([]);
    expect(f.crossings.map((c) => [c.parts, c.t, c.u])).toEqual([
      [[0, 2], 0.5, 0],
      [[1, 2], 0.5, 1],
    ]);
    expect(f.crossings.every((c) => c.at[1] === 0.5 && c.angle > 85)).toBe(true);
  });

  it("O: one curve and one loop around the middle; an overshoot or a small gap still closes", () => {
    for (const turns of [1, 1.1, 0.96]) {
      const f = read(ring(30, 40, 30, 40, turns));
      expect(f.parts.map((p) => p.kind)).toEqual(["curve"]);
      expect(f.loops).toHaveLength(1);
      expect(f.loops[0]!.center[0]).toBeCloseTo(0.5, 1);
      expect(f.loops[0]!.center[1]).toBeCloseTo(0.5, 1);
    }
  });

  it("C: an open curve is not a loop", () => {
    const f = read(ring(30, 40, 30, 40, 0.7));
    expect(f.parts.map((p) => p.kind)).toEqual(["curve"]);
    expect(f.loops).toEqual([]);
  });

  it("a closed shape of straight lines is not a loop (an A drawn in one stroke has none, D112)", () => {
    expect(read(path([0, 80], [30, 0], [60, 80], [0, 80])).loops).toEqual([]);
  });

  it("D: a back and a bowl drawn apart meet at both ends", () => {
    const bowl = Array.from({ length: 33 }, (_, i): Point2 => {
      const t = -Math.PI / 2 + (i / 32) * Math.PI;
      return [50 * Math.cos(t), 40 + 40 * Math.sin(t)];
    });
    const f = read(line([0, 0], [0, 80]), bowl);
    expect(f.parts.map((p) => p.kind)).toEqual(["line", "curve"]);
    expect(f.meets.map((m) => [m.parts, m.ends])).toEqual([
      [
        [0, 1],
        ["a", "a"],
      ],
      [
        [0, 1],
        ["b", "b"],
      ],
    ]);
  });

  it("L: one stroke splits at its corner into two lines that meet there", () => {
    const f = read(path([0, 0], [0, 80], [45, 80]));
    expect(f.parts.map((p) => p.kind)).toEqual(["line", "line"]);
    expect(f.meets).toMatchObject([{ parts: [0, 1], ends: ["b", "a"], gap: 0 }]);
    expect(f.meets[0]!.at[0]).toBeCloseTo(0, 1);
    expect(f.meets[0]!.at[1]).toBeCloseTo(1, 1);
  });

  it("a gentle knee between two straight runs is two lines, not a curve", () => {
    // Down, then bending only 35° into a diagonal: too soft for a corner.
    const f = read(path([0, 0], [0, 60], [40, 117]));
    expect(f.parts.map((p) => p.kind)).toEqual(["line", "line"]);
  });

  it("round letters stay curves when the knee cut tries them: P's bowl, S, U", () => {
    const half = (cx: number, cy: number, r: number, from: number, turns: number) =>
      ring(cx, cy, r, r, turns).map(([x, y]): Point2 => {
        const t = Math.atan2(y - cy, x - cx) + from;
        return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
      });
    const bowl = half(0, 20, 20, -Math.PI / 2, 0.5);
    expect(read(line([0, 0], [0, 80]), bowl).parts.map((p) => p.kind)).toEqual(["line", "curve"]);
    const s = [...half(30, 20, 20, -0.3, -0.75), ...half(30, 60, 20, -Math.PI / 2, 0.75).slice(1)];
    expect(read(s).parts.every((p) => p.kind === "curve")).toBe(true);
    const u = [...line([0, 0], [0, 50]), ...half(25, 50, 25, Math.PI, -0.5).slice(1)];
    expect(
      read([...u, ...line([50, 50], [50, 0]).slice(1)]).parts.some((p) => p.kind === "curve"),
    ).toBe(true);
  });

  it("a little hook at the end of a stroke is dropped", () => {
    const f = read([...line([0, 0], [0, 80]), [2, 79], [4, 77]]);
    expect(f.parts).toHaveLength(1);
    expect(f.parts[0]).toMatchObject({ kind: "line" });
  });

  it("the box's shape is height over width: a flat dash is 0, an H is 1.6", () => {
    expect(read(line([0, 0], [60, 0], 16, 0)).aspect).toBe(0);
    expect(read(line([0, 0], [0, 80], 16, 0), line([50, 0], [50, 80], 16, 0)).aspect).toBe(1.6);
  });

  it("nothing to read gives empty features, not an error", () => {
    expect(letterFeatures([])).toMatchObject({ strokes: 0, parts: [], meets: [], loops: [] });
    expect(read([[5, 5]])).toMatchObject({ strokes: 1, parts: [], crossings: [] });
  });
});
