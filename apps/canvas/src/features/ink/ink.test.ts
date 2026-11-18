import { Stroke } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createInkManager } from "./ink.manager.ts";
import type { RawPoint } from "./ink.types.ts";
import { isTap, outline, pressureOf, toStroke } from "./ink.utils.ts";

const at = (x: number, y: number, time: number, pressure = 0.5): RawPoint => ({
  x,
  y,
  pressure,
  time,
});
const ids = () => {
  let n = 0;
  return () => `s${++n}`;
};

describe("pressure (D88)", () => {
  it("a mouse is 0.5; a pen is kept between 0 and 1", () => {
    expect(pressureOf("mouse", 0.9)).toBe(0.5);
    expect(pressureOf("pen", 0.7)).toBe(0.7);
    expect(pressureOf("pen", 1.4)).toBe(1);
    expect(pressureOf("pen", 0)).toBe(0.5);
    expect(pressureOf("touch", Number.NaN)).toBe(0.5);
  });
});

describe("toStroke (D88)", () => {
  it("gives a contract stroke: one decimal, time since the first point, raw", () => {
    const stroke = toStroke("s1", [at(10.04, 20.06, 1_000, 0.333), at(50, 20, 1_016.4)]);
    expect(Stroke.parse(stroke)).toEqual(stroke);
    expect(stroke.t0).toBe(1_000);
    expect(stroke.points).toEqual([
      [10, 20.1, 0.33, 0],
      [50, 20, 0.5, 16],
    ]);
  });
});

describe("taps and strokes", () => {
  it("a short press that barely moves is a tap", () => {
    expect(isTap([at(0, 0, 0), at(3, 2, 120)])).toBe(true);
    expect(isTap([at(0, 0, 0), at(30, 0, 120)])).toBe(false);
    expect(isTap([at(0, 0, 0), at(1, 0, 900)])).toBe(false);
  });

  it("the manager turns a drag into a stroke with the next id", () => {
    const ink = createInkManager(ids());
    ink.begin(at(0, 0, 0));
    ink.extend(at(40, 0, 20));
    ink.extend(at(80, 5, 40));
    expect(ink.live()).toHaveLength(3);
    const result = ink.end();
    expect(result?.kind).toBe("stroke");
    if (result?.kind === "stroke") expect(result.stroke.id).toBe("s1");
    expect(ink.drawing()).toBe(false);
  });

  it("a tap uses no id, and ending twice gives nothing", () => {
    const next = ids();
    const ink = createInkManager(next);
    ink.begin(at(5, 5, 0));
    expect(ink.end()?.kind).toBe("tap");
    expect(ink.end()).toBeNull();
    expect(next()).toBe("s1");
  });

  it("moving without pressing draws nothing", () => {
    const ink = createInkManager(ids());
    ink.extend(at(1, 1, 0));
    expect(ink.live()).toEqual([]);
    expect(ink.end()).toBeNull();
  });
});

describe("outline", () => {
  it("perfect-freehand gives a closed shape as flat x, y pairs", () => {
    const shape = outline([at(0, 0, 0), at(50, 0, 16), at(100, 10, 32)]);
    expect(shape.length).toBeGreaterThan(4);
    expect(shape.length % 2).toBe(0);
  });

  it("a finished stroke's outline reaches its last point", () => {
    const pts = [at(0, 0, 0), at(100, 0, 16), at(200, 0, 32)];
    const xs = (o: number[]) => o.filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs(outline(pts, 4, true)))).toBeGreaterThan(
      Math.max(...xs(outline(pts, 4, false))),
    );
    expect(Math.max(...xs(outline(pts, 4, true)))).toBeGreaterThanOrEqual(199);
  });
});
