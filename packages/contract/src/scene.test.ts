import { describe, expect, it } from "vitest";
import { SceneObject } from "./index.ts";

const line = {
  id: "l1",
  kind: "line",
  label: "line",
  pack: "shapes",
  parts: [],
  relations: [{ type: "crosses", to: "l3" }],
  box: [100, 0, 2, 300],
  confidence: 0.98,
  strokes: ["s1"],
  geom: { a: [100, 0], b: [101, 300] },
};

describe("SceneObject (D79 · D89)", () => {
  it("a line keeps its exact ends and the strokes that made it", () => {
    expect(SceneObject.parse(line)).toEqual(line);
  });

  it("a crossing keeps the point where two lines meet", () => {
    const crossing = { ...line, id: "x1", kind: "crossing", geom: { at: [100, 100] } };
    expect(SceneObject.parse(crossing).geom).toEqual({ at: [100, 100] });
  });

  it("a cell keeps the shape the lines make, 4 corners from the top left (D95)", () => {
    const poly = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    const cell = { ...line, id: "c1", kind: "cell", pack: "tictactoe", geom: { poly } };
    expect(SceneObject.parse(cell).geom).toEqual({ poly });
  });

  it("a mark is its own object inside its cell", () => {
    const mark = {
      id: "m1",
      kind: "mark",
      label: "O",
      pack: "tictactoe",
      relations: [{ type: "inside", to: "c5" }],
      box: [110, 110, 80, 80],
      confidence: 1,
    };
    const parsed = SceneObject.parse(mark);
    expect(parsed.parts).toEqual([]);
    expect(parsed.relations).toEqual([{ type: "inside", to: "c5" }]);
  });

  it("refuses a confidence above 1, a negative size and an empty id", () => {
    expect(SceneObject.safeParse({ ...line, confidence: 1.2 }).success).toBe(false);
    expect(SceneObject.safeParse({ ...line, box: [0, 0, -5, 10] }).success).toBe(false);
    expect(SceneObject.safeParse({ ...line, id: "" }).success).toBe(false);
  });
});
