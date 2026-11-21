import type { SceneObject, Stroke } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createPackRegistry, STARTER_PACKS } from "../packs/index.ts";
import { createManualClock } from "../ports/index.ts";
import { createToolHandler } from "../tools/index.ts";
import {
  createSceneStore,
  createStory,
  createStrokeStore,
  placeObject,
  readSnapshot,
  recordStroke,
  takeSnapshot,
} from "./index.ts";
import {
  applyMatrix,
  canTransform,
  reshapeSelection,
  rotationOf,
  selectionBounds,
  selectionParts,
  transformObject,
  transformStroke,
  type Matrix,
} from "./transform.ts";

const line = (id: string, points: [number, number][]): Stroke => ({
  id,
  t0: 0,
  tool: "pen",
  color: "ink",
  width: 4,
  points: points.map(([x, y], i) => [x, y, 0.5, i * 16]),
});
const object = (id: string, kind: string, box: SceneObject["box"], extra = {}): SceneObject => ({
  id,
  kind,
  label: "",
  pack: "builtin",
  parts: [],
  relations: [],
  box,
  confidence: 1,
  ...extra,
});

const move = (dx: number, dy: number): Matrix => [1, 0, 0, 1, dx, dy];
const scale = (sx: number, sy: number): Matrix => [sx, 0, 0, sy, 0, 0];
/** A quarter turn clockwise (y points down) around a point. */
const quarterAround = (cx: number, cy: number): Matrix => [0, 1, -1, 0, cx + cy, cy - cx];

describe("the matrix", () => {
  it("moves, scales and turns points", () => {
    expect(applyMatrix(move(5, -2), [1, 1])).toEqual([6, -1]);
    expect(applyMatrix(scale(2, 3), [1, 1])).toEqual([2, 3]);
    expect(applyMatrix(quarterAround(0, 0), [10, 0])).toEqual([0, 10]);
  });
});

describe("ink through a transform", () => {
  it("carries every point and keeps pressure and timing", () => {
    const s = transformStroke(
      line("s1", [
        [0, 0],
        [10, 0],
      ]),
      scale(2, 2),
    );
    expect(s.points).toEqual([
      [0, 0, 0.5, 0],
      [20, 0, 0.5, 16],
    ]);
  });

  it("a symbol takes its box from its carried ink", () => {
    const ink = transformStroke(
      line("s1", [
        [0, 0],
        [10, 20],
      ]),
      move(100, 0),
    );
    const y = transformObject(
      object("y1", "symbol", [0, 0, 10, 20], { strokes: ["s1"] }),
      move(100, 0),
      new Map([["s1", ink]]),
    );
    expect(y.box).toEqual([100, 0, 10, 20]);
  });
});

describe("objects through a transform", () => {
  it("a box resizes around its new centre", () => {
    const b = transformObject(object("b1", "box", [0, 0, 100, 50]), scale(2, 2));
    expect(b.box).toEqual([0, 0, 200, 100]);
    expect(rotationOf(b)).toBe(0);
    expect(b.geom).toBeUndefined();
  });

  it("a box turns around its centre and keeps its size", () => {
    const b = transformObject(object("b1", "box", [0, 0, 100, 50]), quarterAround(50, 25));
    expect(b.box).toEqual([0, 0, 100, 50]);
    expect(rotationOf(b)).toBe(90);
  });

  it("an arrow's ends move point by point", () => {
    const a = transformObject(
      object("a1", "arrow", [0, 0, 100, 0], { geom: { a: [0, 0], b: [100, 0] } }),
      quarterAround(0, 0),
    );
    expect(a.geom).toEqual({ a: [0, 0], b: [0, 100] });
    expect(a.box).toEqual([0, 0, 0, 100]);
  });

  it("game pieces never take handles", () => {
    expect(canTransform(object("b1", "board", [0, 0, 90, 90]))).toBe(false);
    expect(canTransform(object("m1", "mark", [0, 0, 30, 30]))).toBe(false);
    expect(canTransform(object("t1", "text", [0, 0, 30, 30]))).toBe(true);
  });
});

describe("a selection", () => {
  const strokes = [
    line("s1", [
      [0, 0],
      [10, 10],
    ]),
    line("s2", [
      [50, 50],
      [60, 70],
    ]),
  ];
  const symbol = object("y1", "symbol", [0, 0, 10, 10], { strokes: ["s1"] });

  it("carries an object's ink along with it", () => {
    const parts = selectionParts(["y1"], strokes, [symbol]);
    expect(parts?.strokes.map((s) => s.id)).toEqual(["s1"]);
    expect(selectionBounds(parts!)).toEqual([0, 0, 10, 10]);
  });

  it("frames everything selected", () => {
    const parts = selectionParts(["y1", "s2"], strokes, [symbol]);
    expect(selectionBounds(parts!)).toEqual([0, 0, 60, 70]);
  });

  it("has no handles with a game piece in it", () => {
    const board = object("b1", "board", [0, 0, 90, 90]);
    expect(selectionParts(["b1", "s2"], strokes, [board])).toBeUndefined();
  });

  it("reshapes as a whole", () => {
    const parts = selectionParts(["y1", "s2"], strokes, [symbol])!;
    const out = reshapeSelection(parts, move(10, 10));
    expect(out.objects[0]!.box).toEqual([10, 10, 10, 10]);
    expect(out.strokes.find((s) => s.id === "s2")!.points[0]).toEqual([60, 60, 0.5, 0]);
  });
});

function setup() {
  const clock = createManualClock();
  const story = createStory(clock);
  const scene = createSceneStore();
  const strokes = createStrokeStore();
  const handle = createToolHandler({
    clock,
    packs: createPackRegistry(STARTER_PACKS),
    story,
    scene,
    strokes,
  });
  return { story, scene, strokes, history: handle.history };
}

describe("history.reshape", () => {
  it("is one undoable transform event; undo and redo put the exact geometry back", () => {
    const { story, scene, strokes, history } = setup();
    recordStroke(
      story,
      strokes,
      line("s1", [
        [0, 0],
        [10, 10],
      ]),
    );
    const { object: box } = placeObject(story, scene, {
      kind: "box",
      box: [0, 0, 40, 20],
      color: "ink",
    });
    const parts = selectionParts(["s1", box.id], strokes.all(), scene.all())!;
    const event = history.reshape(reshapeSelection(parts, quarterAround(20, 10)));

    expect(event).toMatchObject({ type: "transform", detail: { ids: [box.id, "s1"] } });
    expect(rotationOf(scene.get(box.id)!)).toBe(90);
    expect(strokes.get("s1")!.points[1]!.slice(0, 2)).toEqual([20, 0]);

    history.undo();
    expect(scene.get(box.id)).toEqual(box);
    expect(strokes.get("s1")!.points[1]!.slice(0, 2)).toEqual([10, 10]);

    history.redo();
    expect(rotationOf(scene.get(box.id)!)).toBe(90);
    expect(strokes.get("s1")!.points[1]!.slice(0, 2)).toEqual([20, 0]);
  });

  it("survives a save: undo still works on the reopened project", () => {
    const { story, scene, strokes, history } = setup();
    const { object: box } = placeObject(story, scene, {
      kind: "box",
      box: [0, 0, 40, 20],
      color: "ink",
    });
    history.reshape(reshapeSelection(selectionParts([box.id], [], scene.all())!, scale(2, 2)));

    const parts = readSnapshot(
      JSON.parse(JSON.stringify(takeSnapshot({ story, scene, strokes, history }))),
    );
    const clock = createManualClock();
    const again = {
      story: createStory(clock, parts.events),
      scene: createSceneStore(parts.objects, parts.usedIds),
      strokes: createStrokeStore(parts.strokes),
    };
    const reopened = createToolHandler({
      clock,
      packs: createPackRegistry(STARTER_PACKS),
      ...again,
      history: parts.history,
    }).history;
    expect(again.scene.get(box.id)!.box).toEqual([0, 0, 80, 40]);
    reopened.undo();
    expect(again.scene.get(box.id)!.box).toEqual([0, 0, 40, 20]);
  });

  it("skips what isn't on the canvas", () => {
    const { history } = setup();
    expect(history.reshape({ strokes: [], objects: [object("zz", "box", [0, 0, 1, 1])] })).toBe(
      undefined,
    );
  });
});
