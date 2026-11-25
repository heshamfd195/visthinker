import { describe, expect, it } from "vitest";
import { HandwritingExample, HandwritingExamples } from "./index.ts";

const example = {
  id: "e1",
  label: "A",
  strokes: [
    {
      t: 0,
      points: [
        [0, 40, 0.5, 0],
        [10, 0, 0.5, 120],
      ],
    },
    {
      t: 380,
      points: [
        [10, 0, 0.5, 0],
        [20, 40, 0.5, 110],
      ],
    },
  ],
  from: "you",
  at: "2026-11-25T10:00:00.000Z",
};

describe("HandwritingExample (D174)", () => {
  it("keeps the label, the raw strokes with their timing, who named it and when", () => {
    expect(HandwritingExample.parse(example)).toEqual(example);
  });

  it("takes letters, digits and marks of one or two characters", () => {
    for (const label of ["a", "7", "?", "ff"])
      expect(HandwritingExample.safeParse({ ...example, label }).success).toBe(true);
    expect(HandwritingExample.safeParse({ ...example, label: "" }).success).toBe(false);
    expect(HandwritingExample.safeParse({ ...example, label: "abc" }).success).toBe(false);
  });

  it("refuses an example with no strokes, a negative start or an unknown teacher", () => {
    expect(HandwritingExample.safeParse({ ...example, strokes: [] }).success).toBe(false);
    const late = { ...example, strokes: [{ ...example.strokes[0], t: -1 }] };
    expect(HandwritingExample.safeParse(late).success).toBe(false);
    expect(HandwritingExample.safeParse({ ...example, from: "api" }).success).toBe(false);
  });
});

describe("HandwritingExamples", () => {
  it("is a versioned list", () => {
    expect(HandwritingExamples.parse({ version: 1, examples: [example] }).examples).toHaveLength(1);
    expect(HandwritingExamples.safeParse({ version: 2, examples: [] }).success).toBe(false);
  });
});
