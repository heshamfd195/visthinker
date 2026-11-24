import type { Point2, Snapshot, Stroke } from "../../packages/contract/src/index.ts";
import { describe as suite, expect, it } from "vitest";
import { describe, lettersOf, read } from "./letters.ts";

const line = (a: Point2, b: Point2, n = 12): Point2[] =>
  Array.from({ length: n + 1 }, (_, i) => [
    a[0] + ((b[0] - a[0]) * i) / n,
    a[1] + ((b[1] - a[1]) * i) / n,
  ]);
const stroke = (id: string, points: Point2[]): Stroke => ({
  id,
  t0: 0,
  tool: "pen",
  color: "#fff",
  width: 2,
  points: points.map(([x, y], i) => [x, y, 0.5, i * 8]),
});
const at = (dx: number, dy: number, points: Point2[]): Point2[] =>
  points.map(([x, y]) => [x + dx, y + dy]);
const snapshot = (strokes: Stroke[], hidden: string[] = []): Snapshot => ({
  version: 1,
  events: [],
  strokes,
  objects: [],
  history: { hidden, saved: [] },
});

// H at x 100, A at x 0 (drawn second), a scribble that was undone, and an L on the next row.
const H = [
  stroke("h1", at(100, 0, line([0, 0], [0, 80]))),
  stroke("h2", at(100, 0, line([50, 0], [50, 80]))),
  stroke("h3", at(100, 0, line([0, 40], [50, 40]))),
];
const A = [
  stroke("a1", line([0, 80], [30, 0])),
  stroke("a2", line([30, 0], [60, 80])),
  stroke("a3", line([10, 48], [50, 48])),
];
const undone = stroke("gone", line([200, 0], [260, 80]));
const L = [stroke("l1", [...line([0, 150], [0, 230]), ...line([0, 230], [45, 230]).slice(1)])];

suite("try-letters (T51)", () => {
  it("splits the canvas into letters in reading order, leaving out what was undone", () => {
    const letters = lettersOf(snapshot([...H, ...A, undone, ...L], ["gone"]));
    expect(letters.map((l) => l.strokes.map((s) => s.id))).toEqual([
      ["a1", "a2", "a3"],
      ["h1", "h2", "h3"],
      ["l1"],
    ]);
  });

  it("says what was measured in plain words", () => {
    const [a, h] = read(lettersOf(snapshot([...A, ...H])));
    const textA = describe(a!, 1);
    expect(textA).toContain("Letter 1 · 3 strokes · 60 × 80, tall");
    expect(textA).toContain("1b and 2a meet at (0.50, 0.00) top centre");
    expect(textA).toContain("1 and 3 touch at (0.20, 0.60) middle left");
    expect(textA).toContain("loops      none");
    expect(describe(h!, 2)).toContain("1 and 3 touch at (0.00, 0.50) middle left");
  });

  it("an empty canvas has no letters", () => {
    expect(lettersOf(snapshot([]))).toEqual([]);
  });
});
