import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, guidesFromOld } from "../shell/index.ts";
import {
  canSnap,
  dottedDash,
  GUIDE_OPACITY,
  positions,
  snapPoint,
  visibleStep,
} from "./guides.utils.ts";

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

describe("one guide at a time", () => {
  it("snaps only to dots or a grid, and only when asked", () => {
    expect(canSnap({ kind: "dots", snap: true })).toBe(true);
    expect(canSnap({ kind: "grid", snap: true })).toBe(true);
    expect(canSnap({ kind: "lines", snap: true })).toBe(false);
    expect(canSnap({ kind: "none", snap: true })).toBe(false);
    expect(canSnap({ kind: "grid", snap: false })).toBe(false);
  });

  it("has three strengths, faint to strong", () => {
    expect(GUIDE_OPACITY.faint).toBeLessThan(GUIDE_OPACITY.soft);
    expect(GUIDE_OPACITY.soft).toBeLessThan(GUIDE_OPACITY.strong);
  });

  it("dots a dotted line in screen pixels", () => {
    expect(dottedDash(1)).toEqual([1, 4]);
    expect(dottedDash(0.5)).toEqual([0.5, 2]);
  });
});

describe("a look saved with separate grid and lines", () => {
  it("keeps the grid, which was drawn on top, when both were on", () => {
    expect(
      guidesFromOld({
        grid: { kind: "squares", size: 32, snap: true },
        lines: { kind: "ruled", spacing: 48 },
      }),
    ).toMatchObject({ kind: "grid", size: 32, snap: true });
    expect(guidesFromOld({ grid: { kind: "dots", size: 20 } })).toMatchObject({
      kind: "dots",
      size: 20,
    });
  });

  it("turns writing lines into lines with the writing guide", () => {
    expect(
      guidesFromOld({ grid: { kind: "none" }, lines: { kind: "writing", spacing: 56 } }),
    ).toMatchObject({ kind: "lines", size: 56, writing: true });
  });

  it("starts with no guide when neither was on", () => {
    expect(guidesFromOld({})).toEqual(DEFAULT_LOOK.guides);
  });
});
