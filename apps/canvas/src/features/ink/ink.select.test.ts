import type { SceneObject, Stroke } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { inRegion, liveSelection, regionSpan, selectInRegion, type Region } from "./ink.select.ts";

const stroke = (id: string, points: [number, number][]): Stroke => ({
  id,
  t0: 0,
  tool: "pen",
  color: "ink",
  width: 4,
  points: points.map(([x, y], i) => [x, y, 0.5, i * 16]),
});
const object = (
  id: string,
  box: [number, number, number, number],
  extra: Partial<SceneObject> = {},
): SceneObject =>
  ({
    id,
    kind: "box",
    label: "",
    pack: "builtin",
    parts: [],
    relations: [],
    box,
    ...extra,
  }) as SceneObject;

const box = (x1: number, y1: number, x2: number, y2: number): Region => ({
  kind: "box",
  from: [x1, y1],
  to: [x2, y2],
});
// A square loop from (0,0) to (100,100).
const lasso: Region = {
  kind: "lasso",
  points: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ],
};

describe("regions", () => {
  it("a box works whichever corner the drag started from", () => {
    expect(inRegion([50, 50], box(100, 100, 0, 0))).toBe(true);
    expect(inRegion([150, 50], box(0, 0, 100, 100))).toBe(false);
  });

  it("a lasso holds what its loop goes around", () => {
    expect(inRegion([50, 50], lasso)).toBe(true);
    expect(inRegion([150, 50], lasso)).toBe(false);
    // A concave loop: an L shape leaves its notch out.
    const l: Region = {
      kind: "lasso",
      points: [
        [0, 0],
        [40, 0],
        [40, 60],
        [100, 60],
        [100, 100],
        [0, 100],
      ],
    };
    expect(inRegion([20, 20], l)).toBe(true);
    expect(inRegion([70, 20], l)).toBe(false);
  });

  it("a lasso of two points holds nothing", () => {
    expect(
      inRegion([5, 5], {
        kind: "lasso",
        points: [
          [0, 0],
          [10, 10],
        ],
      }),
    ).toBe(false);
  });

  it("measures a drag, to tell it from a click", () => {
    expect(regionSpan(box(10, 10, 12, 11))).toBe(2);
    expect(regionSpan(lasso)).toBe(100);
  });
});

describe("selectInRegion", () => {
  it("selects only what lies wholly inside", () => {
    const strokes = [
      stroke("s1", [
        [10, 10],
        [40, 40],
      ]),
      stroke("s2", [
        [80, 80],
        [140, 90],
      ]),
    ];
    const objects = [object("b1", [20, 20, 30, 30]), object("b2", [90, 90, 30, 30])];
    expect(selectInRegion(box(0, 0, 100, 100), strokes, objects)).toEqual(["b1", "s1"]);
    expect(selectInRegion(lasso, strokes, objects)).toEqual(["b1", "s1"]);
  });

  it("ink that made an object goes with it, never alone", () => {
    const strokes = [
      stroke("s1", [
        [10, 10],
        [30, 30],
      ]),
      stroke("s2", [
        [30, 10],
        [10, 30],
      ]),
    ];
    const symbol = object("y1", [10, 10, 20, 20], { kind: "symbol", strokes: ["s1", "s2"] });
    expect(selectInRegion(box(0, 0, 50, 50), strokes, [symbol])).toEqual(["y1"]);
    // Half the symbol inside: neither it nor its ink.
    expect(selectInRegion(box(0, 0, 20, 50), strokes, [symbol])).toEqual([]);
  });

  it("a group takes its parts along instead of listing them", () => {
    const group = object("g1", [0, 0, 90, 90], { kind: "group", parts: ["p1", "p2"] });
    const parts = [
      object("p1", [0, 0, 30, 30], { kind: "box" }),
      object("p2", [30, 0, 30, 30], { kind: "box" }),
    ];
    expect(selectInRegion(box(-5, -5, 95, 95), [], [group, ...parts])).toEqual(["g1"]);
    // Around one part only: that part.
    expect(selectInRegion(box(-5, -5, 32, 32), [], [group, ...parts])).toEqual(["p1"]);
  });
});

describe("liveSelection", () => {
  const strokes = [
    stroke("s1", [
      [0, 0],
      [1, 1],
    ]),
  ];
  const objects = [object("b1", [0, 0, 10, 10])];

  it("drops what has left the canvas, e.g. undone or erased", () => {
    expect(liveSelection(["s1", "y22", "b1", "b5"], strokes, objects)).toEqual(["s1", "b1"]);
    expect(liveSelection(["y22"], [], [])).toEqual([]);
  });

  it("gives the same selection back when nothing left", () => {
    const selection = ["s1", "b1"];
    expect(liveSelection(selection, strokes, objects)).toBe(selection);
  });
});
