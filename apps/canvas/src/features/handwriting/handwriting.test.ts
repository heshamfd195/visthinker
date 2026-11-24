import type { LetterEventDetail, VisEvent } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { latestLetters, letterMarks, marksOf } from "./handwriting.utils.ts";

// An A in a 60 × 80 box at (100, 200): two legs meeting at the top, a bar crossing both.
const A: LetterEventDetail["features"] = {
  strokes: 3,
  box: [100, 200, 60, 80],
  aspect: 1.33,
  parts: [
    { kind: "line", stroke: 0, a: [0, 1], b: [0.5, 0], length: 1.07, angle: 69 },
    { kind: "line", stroke: 1, a: [0.5, 0], b: [1, 1], length: 1.07, angle: 111 },
    { kind: "line", stroke: 2, a: [0.17, 0.6], b: [0.83, 0.6], length: 0.5, angle: 0 },
  ],
  meets: [{ parts: [0, 1], ends: ["b", "a"], at: [0.5, 0], gap: 0 }],
  crossings: [{ parts: [0, 2], t: 0.4, u: 0.05, at: [0.2, 0.6], angle: 69 }],
  loops: [],
};
const O: LetterEventDetail["features"] = {
  strokes: 1,
  box: [200, 200, 60, 80],
  aspect: 1.33,
  parts: [{ kind: "curve", stroke: 0, a: [1, 0.5], b: [1, 0.5], length: 2.8 }],
  meets: [],
  crossings: [],
  loops: [{ stroke: 0, center: [0.5, 0.5], width: 0.75, height: 1 }],
};

const letter = (
  seq: number,
  word: string,
  cause: number,
  strokes: string[],
  features = A,
): VisEvent => ({
  seq,
  t: seq,
  who: "fastbrain",
  type: "letter",
  target: word,
  cause,
  detail: { index: 1, of: 1, strokes, features },
});
const read = (seq: number, word: string, letters?: string[][]): VisEvent => ({
  seq,
  t: seq,
  who: "fastbrain",
  type: "recognized",
  target: word,
  detail: letters ? { kind: "word", letters } : { kind: "symbol", label: "?" },
});

describe("the handwriting debug view (T51)", () => {
  it("draws each word's letters as its latest reading lists them, unchanged ones kept", () => {
    const events = [
      read(1, "w1", [["s1"]]),
      letter(2, "w1", 1, ["s1"]),
      read(3, "w1", [["s1"], ["s2"]]),
      letter(4, "w1", 3, ["s2"], O), // only the new letter was sent
      read(5, "w1", [["s1"], ["s2", "s3"]]),
      letter(6, "w1", 5, ["s3", "s2"]), // the second letter changed
      read(7, "w9", [["s9"]]), // undone: not on the canvas
      letter(8, "w9", 7, ["s9"]),
    ];
    const found = latestLetters(events, new Set(["w1"]));
    expect(found.map((l) => [l.detail.index, l.detail.of, l.detail.strokes])).toEqual([
      [1, 2, ["s1"]],
      [2, 2, ["s3", "s2"]],
    ]);
    expect(found[1]!.detail.features).toEqual(A);
    expect(letterMarks(events, new Set(["w1"])).map((m) => m.key)).toEqual(["w1-1", "w1-2"]);
  });

  it("a reading from an older build, with no letter list, shows the letters it caused", () => {
    const events = [
      read(1, "y1"),
      letter(2, "y1", 1, ["s1"]),
      read(3, "y1"),
      letter(4, "y1", 3, ["s1"], O),
      { seq: 5, t: 5, who: "fastbrain", type: "letter", target: "y1", detail: { bad: true } },
    ] as VisEvent[];
    expect(latestLetters(events, new Set(["y1"])).map((l) => l.detail.features)).toEqual([O]);
  });

  it("carries each letter's name and score for the label under it (D116)", () => {
    const reading = { label: "A", score: 100, clear: true, guesses: [{ char: "A", score: 100 }] };
    const detail = (features = A) => ({ index: 1, of: 1, strokes: ["s1"], features });
    expect(marksOf("y1-1", 1, { ...detail(), reading }).name).toEqual({
      label: "A",
      score: 100,
      clear: true,
    });
    expect(marksOf("y1-1", 1, { ...detail(), waiting: true }).name).toMatchObject({ label: "…" });
    expect(marksOf("y1-1", 1, detail()).name).toBeUndefined();
  });

  it("a letter read turned upright is drawn turned back, where you wrote it", () => {
    // Turned 90° clockwise about the A's box corner (100, 200): its top left stays put.
    const turned = marksOf("y1-1", 1, {
      index: 1,
      of: 1,
      strokes: ["s1"],
      features: A,
      turn: { deg: 90, about: [100, 200] },
    });
    expect(turned.turn).toBe(90);
    expect(turned.outline[0]).toEqual([100, 200]);
    const [x, y] = turned.outline[1]!; // the top right corner swings down
    expect([Math.round(x), Math.round(y)]).toEqual([100, 260]);
  });

  it("puts the parts, meets, crossings and loops back where you drew them", () => {
    const a = marksOf("y1-1", 1, { index: 1, of: 1, strokes: ["s1"], features: A });
    expect(a.parts[0]).toMatchObject({ kind: "line", a: [100, 280], b: [130, 200], label: "1" });
    expect(a.meets).toEqual([[130, 200]]);
    expect(a.crossings).toEqual([[112, 248]]);
    const o = marksOf("y2-1", 1, { index: 1, of: 1, strokes: ["s1"], features: O });
    expect(o.loops).toEqual([{ center: [230, 240], rx: 30, ry: 40 }]);
  });
});
