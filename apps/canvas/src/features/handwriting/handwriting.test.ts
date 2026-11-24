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
  index: number,
  features = A,
): VisEvent => ({
  seq,
  t: seq,
  who: "fastbrain",
  type: "letter",
  target: word,
  cause,
  detail: { index, of: 2, strokes: ["s1"], features },
});

describe("the handwriting debug view (T51)", () => {
  it("draws each word's latest reading only, and only words still on the canvas", () => {
    const events = [
      letter(2, "y1", 1, 1),
      letter(3, "y1", 1, 2),
      letter(5, "y1", 4, 1), // read again after a late stroke: replaces both above
      letter(7, "y2", 6, 1, O),
      letter(9, "y3", 8, 1), // undone: not on the canvas
      { seq: 10, t: 10, who: "fastbrain", type: "letter", target: "y1", detail: { bad: true } },
    ] as VisEvent[];
    const found = latestLetters(events, new Set(["y1", "y2"]));
    expect(found.map((l) => [l.word, l.detail.index])).toEqual([
      ["y1", 1],
      ["y2", 1],
    ]);
    expect(letterMarks(events, new Set(["y1", "y2"])).map((m) => m.key)).toEqual(["y1-1", "y2-1"]);
  });

  it("puts the parts, meets, crossings and loops back where you drew them", () => {
    const a = marksOf("y1-1", 1, A);
    expect(a.parts[0]).toMatchObject({ kind: "line", a: [100, 280], b: [130, 200], label: "1" });
    expect(a.meets).toEqual([[130, 200]]);
    expect(a.crossings).toEqual([[112, 248]]);
    const o = marksOf("y2-1", 1, O);
    expect(o.loops).toEqual([{ center: [230, 240], rx: 30, ry: 40 }]);
  });
});
