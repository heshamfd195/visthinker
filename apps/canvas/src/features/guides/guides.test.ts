import { describe, expect, it } from "vitest";
import { positions, snapPoint, visibleStep } from "./guides.utils.ts";

describe("snapPoint (D124)", () => {
  it("moves a point to the nearest grid crossing", () => {
    expect(snapPoint([13, 37], 24)).toEqual([24, 48]);
    expect(snapPoint([11, 35], 24)).toEqual([0, 24]);
    expect(snapPoint([-13, -5], 24)).toEqual([-24, 0]);
    expect(snapPoint([48, 72], 24)).toEqual([48, 72]);
  });

  it("leaves the point alone for a size that isn't positive", () => {
    expect(snapPoint([13, 37], 0)).toEqual([13, 37]);
    expect(snapPoint([13, 37], -4)).toEqual([13, 37]);
  });
});

describe("visibleStep", () => {
  it("keeps the size while guides are far enough apart on screen", () => {
    expect(visibleStep(24, 1)).toBe(24);
    expect(visibleStep(12, 0.5)).toBe(12);
  });

  it("doubles the step when zoomed out too far", () => {
    expect(visibleStep(12, 0.25)).toBe(24);
    expect(visibleStep(12, 0.1)).toBe(96);
  });
});

describe("positions", () => {
  it("lists the multiples of the step inside the range", () => {
    expect(positions(-30, 50, 24)).toEqual([-24, 0, 24, 48]);
    expect(positions(0, 48, 24)).toEqual([0, 24, 48]);
  });

  it("can start from an offset, for the writing middle line", () => {
    expect(positions(0, 100, 48, 24)).toEqual([24, 72]);
  });

  it("gives nothing for an empty range or a bad step", () => {
    expect(positions(10, 0, 24)).toEqual([]);
    expect(positions(0, 10, 0)).toEqual([]);
  });
});
