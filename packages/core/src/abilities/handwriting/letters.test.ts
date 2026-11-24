import type { Point2, Stroke } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import hello from "./fixtures/hello.json" with { type: "json" };
import { readWord, splitLetters } from "./index.ts";

const first = hello.first as Stroke[];
const second = hello.second as Stroke[];
const ids = (letters: Stroke[][]) => letters.map((l) => l.map((s) => s.id));

let next = 0;
const stroke = (points: Point2[]): Stroke => ({
  id: `t${next++}`,
  t0: 0,
  tool: "pen",
  color: "#fff",
  width: 2,
  points: points.map(([x, y], i) => [x, y, 0.5, i * 8]),
});
const line = (a: Point2, b: Point2, n = 12): Point2[] =>
  Array.from({ length: n + 1 }, (_, i) => [
    a[0] + ((b[0] - a[0]) * i) / n,
    a[1] + ((b[1] - a[1]) * i) / n,
  ]);
const L = (x: number, y = 0): Point2[] => [
  ...line([x, y], [x, y + 100]),
  ...line([x, y + 100], [x + 55, y + 100]).slice(1),
];

describe("splitting a word into letters (D114 · T51)", () => {
  it("your first HELLO is five letters, the two L's apart", () => {
    expect(ids(splitLetters(first))).toEqual([
      ["s62", "s63", "s64"],
      ["s65", "s66", "s67", "s68"],
      ["s69"],
      ["s70"],
      ["s71"],
    ]);
  });

  it("your second HELLO is five letters too, in any drawing order", () => {
    const want = [["s72", "s73", "s74"], ["s75", "s76", "s77", "s78"], ["s79"], ["s80"], ["s81"]];
    expect(ids(splitLetters(second))).toEqual(want);
    expect(ids(splitLetters([...second].reverse())).map((l) => l.sort())).toEqual(
      want.map((l) => [...l].sort()),
    );
  });

  it("two L's whose foot nearly reaches the next one are still two letters", () => {
    // As you wrote them: the second L stands a little higher, 3 to the right of the first's foot.
    const close = [stroke(L(0)), stroke(L(58, -20))];
    expect(splitLetters(close)).toHaveLength(2);
  });

  it("an H whose bar stops a little short of both legs is still one letter", () => {
    const h = [line([0, 0], [0, 100]), line([60, 0], [60, 100]), line([4, 50], [56, 50])];
    expect(splitLetters(h.map(stroke))).toHaveLength(1);
  });

  it("letters that touch stay joined, for Claude to read (D114)", () => {
    expect(splitLetters([stroke(L(0)), stroke(L(55))])).toHaveLength(1);
  });

  it("two rows read top to bottom, each left to right", () => {
    const [a, b, c] = [stroke(L(100)), stroke(L(0)), stroke(L(0, 200))];
    expect(splitLetters([c, a, b]).map((l) => l[0]!.id)).toEqual([b.id, a.id, c.id]);
  });
});

describe("reading your HELLO letter by letter (T51)", () => {
  const read = (strokes: Stroke[]) =>
    readWord(strokes).map(({ features: f }) => ({
      lines: f.parts.filter((p) => p.kind === "line").length,
      curves: f.parts.filter((p) => p.kind === "curve").length,
      crossings: f.crossings.length,
      loops: f.loops.length,
    }));

  it("H, E, L, L, O: lines where you drew lines, one loop for the O", () => {
    for (const word of [first, second]) {
      const [h, e, l1, l2, o] = read(word);
      expect(h).toMatchObject({ lines: 3, curves: 0, crossings: 2 });
      expect(e).toMatchObject({ lines: 4, curves: 0 });
      expect(l1!.curves).toBe(0);
      expect(l2).toMatchObject({ lines: 2, curves: 0 });
      expect(o).toMatchObject({ curves: 1, loops: 1 });
    }
  });

  it("the rounded L reads as lines: down, the bend, the foot", () => {
    const l = readWord(second)[2]!.features;
    expect(
      l.parts.map((p) => (p.kind === "line" ? Math.round(p.angle / 10) * 10 : "curve")),
    ).toEqual([90, 120, 30]);
  });

  it("no meet reaches across the two L's: each has only its own corners", () => {
    for (const word of [first, second]) {
      const [, , l1, l2] = readWord(word);
      for (const l of [l1!, l2!]) {
        expect(l.strokes).toHaveLength(1);
        expect(l.features.meets.every((m) => m.gap < 0.05)).toBe(true);
      }
    }
  });
});
