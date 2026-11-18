import { SceneObject, VisEvent } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createManualClock } from "../ports/index.ts";
import {
  colorsFromStory,
  createSceneStore,
  createStory,
  moveObject,
  placeObject,
} from "./index.ts";

const setup = () => ({ story: createStory(createManualClock()), scene: createSceneStore() });

describe("pre-built objects (D67)", () => {
  it("placing a box adds a data object and a place event", () => {
    const { story, scene } = setup();
    const { object, event } = placeObject(story, scene, {
      kind: "box",
      box: [10.04, 20, 100, 50],
      color: "#2f9e44",
    });
    expect(SceneObject.parse(object)).toEqual(object);
    expect(object).toMatchObject({ id: "b1", kind: "box", pack: "builtin", confidence: 1 });
    expect(object.box).toEqual([10, 20, 100, 50]);
    expect(VisEvent.parse(event)).toMatchObject({
      type: "place",
      who: "user",
      target: "b1",
      detail: { kind: "box", color: "#2f9e44" },
    });
    expect(scene.owner("b1")).toBe("user");
  });

  it("each kind gets its own ids", () => {
    const { story, scene } = setup();
    const ids = (["box", "circle", "arrow", "box"] as const).map(
      (kind) => placeObject(story, scene, { kind, box: [0, 0, 1, 1], color: "#222" }).object.id,
    );
    expect(ids).toEqual(["b1", "o1", "a1", "b2"]);
  });

  it("an arrow keeps its two ends", () => {
    const { story, scene } = setup();
    const { object } = placeObject(story, scene, {
      kind: "arrow",
      box: [0, 0, 100, 40],
      ends: { a: [0, 40], b: [100, 0] },
      color: "#e03131",
    });
    expect(object.geom).toEqual({ a: [0, 40], b: [100, 0] });
  });

  it("refuses an unknown kind", () => {
    const { story, scene } = setup();
    expect(() =>
      placeObject(story, scene, { kind: "star" as never, box: [0, 0, 1, 1], color: "#222" }),
    ).toThrow();
    expect(story.all()).toHaveLength(0);
  });
});

describe("moving", () => {
  it("moves the box and an arrow's ends, and records from and to", () => {
    const { story, scene } = setup();
    placeObject(story, scene, {
      kind: "arrow",
      box: [0, 0, 100, 40],
      ends: { a: [0, 40], b: [100, 0] },
      color: "#222",
    });
    const event = moveObject(story, scene, "a1", { dx: 10, dy: -5 });
    expect(scene.get("a1")).toMatchObject({
      box: [10, -5, 100, 40],
      geom: { a: [10, 35], b: [110, -5] },
    });
    expect(event).toMatchObject({
      type: "move",
      target: "a1",
      detail: { from: [0, 0, 100, 40], to: [10, -5, 100, 40] },
    });
  });

  it("refuses to move something that isn't there", () => {
    const { story, scene } = setup();
    expect(() => moveObject(story, scene, "b9", { dx: 1, dy: 1 })).toThrow();
  });
});

describe("colours", () => {
  it("are read back from the place events", () => {
    const { story, scene } = setup();
    placeObject(story, scene, { kind: "box", box: [0, 0, 1, 1], color: "#2f9e44" });
    placeObject(story, scene, { kind: "circle", box: [0, 0, 1, 1], color: "#e03131" });
    expect([...colorsFromStory(story.all())]).toEqual([
      ["b1", "#2f9e44"],
      ["o1", "#e03131"],
    ]);
  });
});
