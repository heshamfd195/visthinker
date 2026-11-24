import { CharacterCard, type Point2, type Stroke } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import hello from "./fixtures/hello.json" with { type: "json" };
import { CARDS, letterFeatures, readHandwriting, readLetter, readWord } from "./index.ts";

let next = 0;
const stroke = (points: Point2[]): Stroke => ({
  id: `c${next++}`,
  t0: 0,
  tool: "pen",
  color: "#fff",
  width: 2,
  points: points.map(([x, y], i) => [x, y, 0.5, i * 8]),
});
const line = (a: Point2, b: Point2, n = 16): Point2[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const off = i === 0 || i === n ? 0 : 0.8 * Math.sin(i * 2.1);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [
      a[0] + ((b[0] - a[0]) * i) / n + (-(b[1] - a[1]) / len) * off,
      a[1] + ((b[1] - a[1]) * i) / n + ((b[0] - a[0]) / len) * off,
    ];
  });
const path = (...corners: Point2[]): Point2[] =>
  corners.slice(1).flatMap((c, i) => line(corners[i]!, c).slice(i === 0 ? 0 : 1));
const read = (...paths: Point2[][]) => readLetter(letterFeatures(paths.map(stroke)), CARDS);
const word = (strokes: Stroke[]) =>
  readWord(strokes)
    .map((l) => readLetter(l.features, CARDS).reading.label)
    .join("");

describe("the character cards (D112 · T52)", () => {
  it("every card is a valid card whose weights add up to 100", () => {
    for (const card of CARDS) expect(() => CharacterCard.parse(card)).not.toThrow();
    expect(CARDS.map((c) => c.char)).toEqual(["A", "H", "E", "L", "O"]);
  });

  it("your three HELLOs read HELLO, every letter clear", () => {
    for (const strokes of [hello.first, hello.second, hello.third] as Stroke[][]) {
      expect(word(strokes)).toBe("HELLO");
      for (const l of readWord(strokes))
        expect(readLetter(l.features, CARDS).reading.clear).toBe(true);
    }
  });
});

describe("your other letters (24 Nov)", () => {
  const one = (strokes: Stroke[]) => readHandwriting(strokes)[0]!;

  it("an A turned about 20° reads A once turned upright", () => {
    const a = one(hello.tiltedA as Stroke[]);
    expect(a.reading).toMatchObject({ label: "A", clear: true });
    expect(a.turn?.deg).toBe(-20);
  });

  it("a four-sided O is a loop of straight lines and reads O", () => {
    const o = readHandwriting(hello.fourth as Stroke[]).at(-1)!;
    expect(o.features.loops).toHaveLength(1);
    expect(o.reading).toMatchObject({ label: "O", score: 80, clear: true });
  });

  it("neither B passes for an E: the angular one's top bar runs into its bowl", () => {
    for (const b of [hello.roundB, hello.angularB] as Stroke[][])
      expect(one(b).reading.clear).toBe(false);
  });

  it("upright letters stay upright: your HELLOs are never turned", () => {
    for (const word of [hello.first, hello.second, hello.third, hello.fourth] as Stroke[][])
      expect(readHandwriting(word).every((l) => l.turn === undefined)).toBe(true);
  });

  it("ink a card can't explain costs 20 a part: an L with an extra bar on top", () => {
    const l = letterFeatures([
      stroke(path([0, 0], [0, 100], [55, 100])),
      stroke(line([0, 0], [50, 0])),
    ]);
    const card = readLetter(l, CARDS).scores.find((s) => s.char === "L")!;
    expect(card.unexplained).toBe(1);
  });
});

describe("scoring (D113 · T53)", () => {
  const BL: Point2 = [0, 80];
  const APEX: Point2 = [30, 0];
  const BR: Point2 = [60, 80];
  const BAR: [Point2, Point2] = [
    [10, 48],
    [50, 48],
  ];

  it("an A in 3 strokes, 2 (∧ and a bar), or 1 that runs back for the bar is clearly A", () => {
    const three = read(line(BL, APEX), line(APEX, BR), line(...BAR));
    expect(three.reading).toMatchObject({ label: "A", score: 100, clear: true });
    expect(read(path(BL, APEX, BR), line(...BAR)).reading).toMatchObject({
      label: "A",
      clear: true,
    });
    // One stroke loses the stroke-count check (10) and is still clear.
    expect(read(path(BL, APEX, BR, [48, 48], [10, 48])).reading).toMatchObject({
      label: "A",
      score: 90,
      clear: true,
    });
  });

  it("an H and an A don't pass for each other: the other card scores half or less", () => {
    const h = read(line([0, 0], [0, 80]), line([50, 0], [50, 80]), line([0, 40], [50, 40]));
    expect(h.reading.label).toBe("H");
    expect(h.scores.find((s) => s.char === "A")!.score).toBeLessThanOrEqual(50);
    const a = read(line(BL, APEX), line(APEX, BR), line(...BAR));
    expect(a.scores.find((s) => s.char === "H")!.score).toBeLessThanOrEqual(50);
  });

  it("an A without its bar is unsure: ? with its two best guesses", () => {
    const { reading } = read(path(BL, APEX, BR));
    expect(reading.label).toBe("?");
    expect(reading.clear).toBe(false);
    expect(reading.guesses[0]!.char).toBe("A");
    expect(reading.guesses).toHaveLength(2);
  });

  it("a mark no card knows (an X) is unsure, never a letter by luck", () => {
    expect(read(line([0, 0], [60, 60]), line([60, 0], [0, 60])).reading.clear).toBe(false);
  });

  it("clear needs 70 or more and a lead of 15 or more", () => {
    const card = (char: string, pass: number) =>
      CharacterCard.parse({
        char,
        checks: [
          {
            label: "passes",
            weight: pass,
            tests: [{ test: "count", parts: {}, min: 0 }], // explains every part
          },
          { label: "fails", weight: 100 - pass, tests: [{ test: "strokes", min: 9, max: 9 }] },
        ],
      });
    const f = letterFeatures([stroke(line([0, 0], [0, 80]))]);
    expect(readLetter(f, [card("A", 75), card("B", 65)]).reading).toMatchObject({
      label: "?",
      score: 75,
    });
    expect(readLetter(f, [card("A", 80), card("B", 65)]).reading).toMatchObject({
      label: "A",
      clear: true,
    });
    expect(readLetter(f, [card("A", 65), card("B", 10)]).reading).toMatchObject({
      label: "?",
      score: 65,
    });
  });
});
