import { describe, expect, it } from "vitest";
import { dragBox, isRealDrag } from "./objects.utils.ts";

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
