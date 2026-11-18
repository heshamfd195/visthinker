import { TOOLS } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createManualClock } from "../ports/index.ts";
import {
  createSceneStore,
  createStory,
  createStrokeStore,
  placeObject,
  recordStroke,
} from "../scene/index.ts";
import { createToolHandler } from "./index.ts";

const stroke = (id: string) => ({
  id,
  t0: 0,
  tool: "pen",
  color: "#222",
  width: 4,
  points: [
    [0, 0, 0.5, 0],
    [100, 0, 0.5, 16],
  ],
});

function setup() {
  const story = createStory(createManualClock());
  const scene = createSceneStore();
  const strokes = createStrokeStore();
  const handle = createToolHandler({ story, scene, strokes });
  return { story, scene, strokes, handle };
}

describe("get_events (D77)", () => {
  it("gives only the events since the last read", async () => {
    const { story, strokes, handle } = setup();
    recordStroke(story, strokes, stroke("s1"));
    const first = TOOLS.get_events.result.parse(await handle("get_events", {}));
    expect(first.events.map((e) => e.seq)).toEqual([1]);
    expect(TOOLS.get_events.result.parse(await handle("get_events", {})).events).toEqual([]);
    recordStroke(story, strokes, stroke("s2"));
    const next = TOOLS.get_events.result.parse(await handle("get_events", {}));
    expect(next.events.map((e) => e.target)).toEqual(["s2"]);
  });
});

describe("get_scene (D77)", () => {
  it("gives the whole current scene, fitting the contract", async () => {
    const { story, scene, handle } = setup();
    placeObject(story, scene, { kind: "box", box: [0, 0, 10, 10], color: "#222" });
    const result = TOOLS.get_scene.result.parse(await handle("get_scene", {}));
    expect(result.objects.map((o) => o.id)).toEqual(["b1"]);
  });
});

describe("get_strokes (D76)", () => {
  it("gives a stroke's own raw points by its id", async () => {
    const { story, strokes, handle } = setup();
    recordStroke(story, strokes, stroke("s1"));
    const result = TOOLS.get_strokes.result.parse(await handle("get_strokes", { target: "s1" }));
    expect(result.strokes).toEqual([stroke("s1")]);
  });

  it("gives the strokes that made an object", async () => {
    const { story, scene, strokes, handle } = setup();
    recordStroke(story, strokes, stroke("s1"));
    recordStroke(story, strokes, stroke("s2"));
    scene.add(
      {
        id: "l1",
        kind: "line",
        label: "line",
        pack: "shapes",
        parts: [],
        relations: [],
        box: [0, 0, 100, 0],
        confidence: 0.9,
        strokes: ["s1", "s2"],
      },
      "fastbrain",
    );
    const result = TOOLS.get_strokes.result.parse(await handle("get_strokes", { target: "l1" }));
    expect(result.strokes.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("a pre-built object was never drawn, so it has no strokes", async () => {
    const { story, scene, handle } = setup();
    placeObject(story, scene, { kind: "box", box: [0, 0, 10, 10], color: "#222" });
    expect(await handle("get_strokes", { target: "b1" })).toEqual({ strokes: [] });
  });

  it("an unknown target says so", async () => {
    await expect(setup().handle("get_strokes", { target: "nope" })).rejects.toMatchObject({
      code: "unknown_target",
    });
  });
});

describe("every call", () => {
  it("checks args against the contract", async () => {
    await expect(setup().handle("get_strokes", {})).rejects.toMatchObject({ code: "bad_args" });
  });

  it("a call not built yet names the task that brings it", async () => {
    await expect(setup().handle("act", { actions: [] })).rejects.toMatchObject({
      code: "unknown_call",
      message: expect.stringContaining("T21"),
    });
  });
});
