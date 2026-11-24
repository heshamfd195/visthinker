import { SceneObject, TOOLS, type Box, type Point2 } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createPackRegistry } from "../packs/index.ts";
import { createManualClock } from "../ports/index.ts";
import { createToolHandler } from "../tools/index.ts";
import { createSceneStore, createStory, createStrokeStore, describeScene } from "./index.ts";

const o = (id: string, kind: string, box: Box, extra: Partial<SceneObject> = {}): SceneObject => ({
  id,
  kind,
  label: kind,
  pack: "builtin",
  parts: [],
  relations: [],
  box,
  confidence: 1,
  ...extra,
});
const arrow = (id: string, a: Point2, b: Point2) =>
  o(
    id,
    "arrow",
    [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])],
    { geom: { a, b } },
  );
const rel = (scene: SceneObject[], id: string) => scene.find((x) => x.id === id)!.relations;

describe("relations (T32)", () => {
  it("inside: an object in a box is inside it, and only its smallest container", () => {
    const scene = describeScene([
      o("b1", "box", [0, 0, 400, 400]),
      o("b2", "box", [50, 50, 200, 200]),
      o("o1", "circle", [100, 100, 50, 50]),
    ]);
    expect(rel(scene, "o1")).toEqual([{ type: "inside", to: "b2" }]);
    expect(rel(scene, "b2")).toEqual([{ type: "inside", to: "b1" }]);
    expect(rel(scene, "b1")).toEqual([]);
  });

  it("touching: two shapes side by side touch each other, both ways", () => {
    const scene = describeScene([
      o("b1", "box", [0, 0, 100, 100]),
      o("b2", "box", [103, 0, 100, 100]),
      o("b3", "box", [400, 0, 100, 100]),
    ]);
    expect(rel(scene, "b1")).toEqual([{ type: "touching", to: "b2" }]);
    expect(rel(scene, "b2")).toEqual([{ type: "touching", to: "b1" }]);
    expect(rel(scene, "b3")).toEqual([]);
  });

  it("connected: an arrow connects its tail's object, then its head's", () => {
    const scene = describeScene([
      o("b1", "box", [0, 0, 100, 100]),
      o("b2", "box", [300, 0, 100, 100]),
      arrow("a1", [100, 50], [298, 50]),
    ]);
    expect(rel(scene, "a1")).toEqual([
      { type: "connected", to: "b1" },
      { type: "connected", to: "b2" },
    ]);
  });

  it("on: a symbol drawn on a line is on it", () => {
    const line = o("l1", "line", [0, 100, 500, 0], {
      pack: "shapes",
      geom: { a: [0, 100], b: [500, 100] },
    });
    const scene = describeScene([line, o("y1", "symbol", [230, 85, 30, 30], { pack: "shapes" })]);
    expect(rel(scene, "y1")).toEqual([{ type: "on", to: "l1" }]);
  });

  it("keeps the relations the store holds, never twice, and leaves the store's objects untouched", () => {
    const inner = o("b5", "box", [100, 100, 100, 100]);
    const symbol = o("y1", "symbol", [120, 120, 60, 60], {
      relations: [{ type: "inside", to: "b5" }],
    });
    const input = [o("b0", "box", [0, 0, 300, 300]), inner, symbol];
    const scene = describeScene(input);
    expect(rel(scene, "y1")).toEqual([{ type: "inside", to: "b5" }]);
    expect(rel(scene, "b5")).toEqual([{ type: "inside", to: "b0" }]);
    expect(input[1]!.relations).toEqual([]);
    for (const x of scene) expect(SceneObject.parse(x)).toEqual(x);
  });

  it("get_scene gives the scene with its relations", async () => {
    const clock = createManualClock();
    const story = createStory(clock);
    const scene = createSceneStore();
    const handle = createToolHandler({
      clock,
      packs: createPackRegistry(),
      story,
      scene,
      strokes: createStrokeStore(),
    });
    scene.add(o("b1", "box", [0, 0, 300, 300]), "user");
    scene.add(o("o1", "circle", [100, 100, 50, 50]), "user");
    const { objects } = TOOLS.get_scene.result.parse(await handle("get_scene", {}));
    expect(objects.find((x) => x.id === "o1")!.relations).toEqual([{ type: "inside", to: "b1" }]);
    expect(scene.get("o1")!.relations).toEqual([]);
  });
});
