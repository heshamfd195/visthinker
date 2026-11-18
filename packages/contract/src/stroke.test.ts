import { describe, expect, it } from "vitest";
import { Stroke } from "./index.ts";

const base = { id: "s1", t0: 0, tool: "pen", color: "#222", width: 4 };

describe("Stroke (D88)", () => {
  it("takes points as [x, y, pressure, dt]", () => {
    const stroke = {
      ...base,
      points: [
        [1, 2, 0.5, 0],
        [3.5, 4, 0.6, 16],
      ],
    };
    expect(Stroke.parse(stroke)).toEqual(stroke);
  });

  it("keeps pressure between 0 and 1", () => {
    expect(Stroke.safeParse({ ...base, points: [[1, 2, 1.5, 0]] }).success).toBe(false);
    expect(Stroke.safeParse({ ...base, points: [[1, 2, -0.1, 0]] }).success).toBe(false);
  });

  it("refuses points as objects, a negative dt and an empty stroke", () => {
    expect(Stroke.safeParse({ ...base, points: [{ x: 1, y: 2 }] }).success).toBe(false);
    expect(Stroke.safeParse({ ...base, points: [[1, 2, 0.5, -1]] }).success).toBe(false);
    expect(Stroke.safeParse({ ...base, points: [] }).success).toBe(false);
  });
});
