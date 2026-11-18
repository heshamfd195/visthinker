import { describe, expect, it } from "vitest";
import {
  CLAUDE_COLOR,
  dragBox,
  isRealDrag,
  markColors,
  symbolTags,
  USER_COLOR,
} from "./objects.utils.ts";

describe("placing by drag", () => {
  it("the box covers the drag in any direction", () => {
    expect(dragBox([10, 10], [60, 40])).toEqual([10, 10, 50, 30]);
    expect(dragBox([60, 40], [10, 10])).toEqual([10, 10, 50, 30]);
  });

  it("a click or a tiny drag is not a shape", () => {
    expect(isRealDrag([0, 0], [2, 3])).toBe(false);
    expect(isRealDrag([0, 0], [10, 0])).toBe(true);
  });
});

describe("mark colours", () => {
  it("your marks are ink, Claude's are its own colour", () => {
    const place = (seq: number, mark: string, by: string) =>
      ({
        seq,
        t: 0,
        who: "fastbrain",
        type: "place",
        target: "c1",
        detail: { shape: "X", by, mark },
      }) as const;
    expect([...markColors([place(1, "m1", "user"), place(2, "m2", "claude")])]).toEqual([
      ["m1", USER_COLOR],
      ["m2", CLAUDE_COLOR],
    ]);
  });
});

describe("symbol tags (D97)", () => {
  const read = (target: string, label: string, score: number, alternatives: unknown[] = []) =>
    ({
      seq: 1,
      t: 0,
      who: "fastbrain",
      type: "recognized",
      target,
      detail: { kind: "symbol", label, score, alternatives },
    }) as const;

  it("shows the label and score, '?' when unsure, and the runner-up when it came close", () => {
    const tags = symbolTags([
      read("y1", "X", 0.87),
      read("y2", "?", 0.3),
      read("y3", "O", 0.61, [{ label: "X", score: 0.58 }]),
    ]);
    expect([...tags]).toEqual([
      ["y1", "X 87%"],
      ["y2", "?"],
      ["y3", "O 61% · X?"],
    ]);
  });
});
