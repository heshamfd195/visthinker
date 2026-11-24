import { TOOLS, type SceneObject } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createManualClock } from "../ports/index.ts";
import { createSceneStore, createStory, createStrokeStore, placeObject } from "../scene/index.ts";
import { createPackRegistry } from "../packs/index.ts";
import { createToolHandler } from "./index.ts";

const object = (id: string, kind: string, box: SceneObject["box"]): SceneObject => ({
  id,
  kind,
  label: kind,
  pack: "shapes",
  parts: [],
  relations: [],
  box,
  confidence: 1,
});

function setup() {
  const clock = createManualClock();
  const story = createStory(clock);
  const scene = createSceneStore();
  const strokes = createStrokeStore();
  const handle = createToolHandler({ clock, packs: createPackRegistry(), story, scene, strokes });
  // A symbol built by a pack, and a box the user placed.
  scene.add(object("y5", "symbol", [200, 200, 100, 100]), "fastbrain");
  placeObject(story, scene, { kind: "box", box: [0, 0, 50, 50], color: "#222" });
  const act = async (actions: unknown[]) =>
    TOOLS.act.result.parse(await handle("act", { actions }));
  return { story, scene, handle, act };
}

describe("act: all or nothing (D91)", () => {
  it("one bad action applies nothing at all", async () => {
    const { scene, story, act } = setup();
    const before = story.all().length;
    await expect(
      act([
        { op: "label", target: "y5", detail: { text: "centre" } },
        { op: "remove", target: "nope" },
      ]),
    ).rejects.toMatchObject({ code: "unknown_target" });
    expect(story.all()).toHaveLength(before);
    expect(scene.get("y5")!.label).toBe("symbol");
  });

  it("applies a good batch in order", async () => {
    const { act } = setup();
    const result = await act([
      { op: "label", target: "y5", detail: { text: "centre" } },
      { op: "add", target: "y5", detail: { kind: "note", where: "near" } },
    ]);
    expect(result.applied.map((a) => a.seq)).toEqual([2, 3]);
  });
});

describe("act: add, label (D24)", () => {
  it("adds next to an anchor; the Fast Brain picks the box", async () => {
    const { scene, act } = setup();
    const result = await act([
      { op: "add", target: "y5", detail: { kind: "note", label: "your turn", where: "near" } },
    ]);
    const note = scene.get(result.applied[0]!.target)!;
    expect(note).toMatchObject({ kind: "note", label: "your turn", box: [310, 200, 100, 100] });
    expect(note.relations).toEqual([{ type: "near", to: "y5" }]);
  });

  it("relabels an object", async () => {
    const { scene, act } = setup();
    await act([{ op: "label", target: "b1", detail: { text: "start" } }]);
    expect(scene.get("b1")!.label).toBe("start");
  });
});

describe("act: move and remove (Policy ✅ 9)", () => {
  it("never silently changes the user's drawing: it becomes a proposal", async () => {
    const { scene, act } = setup();
    const result = await act([{ op: "remove", target: "b1" }]);
    expect(result.applied[0]).toMatchObject({ type: "propose", target: "b1" });
    expect(scene.has("b1")).toBe(true);
  });

  it("the user accepting the proposal applies it", async () => {
    const { scene, story, handle, act } = setup();
    const result = await act([{ op: "move", target: "b1", detail: { near: "y5" } }]);
    const answer = handle.actor.answer(result.applied[0]!.seq, "accept");
    expect(answer).toMatchObject({ who: "user", type: "answer", detail: { choice: "accept" } });
    expect(scene.get("b1")!.box).toEqual([310, 200, 50, 50]);
    expect(story.all().at(-1)).toMatchObject({
      type: "move",
      target: "b1",
      detail: { by: "user" },
    });
  });

  it("declining leaves it, and a proposal is answered once", async () => {
    const { scene, handle, act } = setup();
    const { applied } = await act([{ op: "remove", target: "b1" }]);
    handle.actor.answer(applied[0]!.seq, "decline");
    expect(handle.actor.answer(applied[0]!.seq, "accept")).toBeUndefined();
    expect(scene.has("b1")).toBe(true);
  });

  it("Claude's own objects move at once; pack-built ones never", async () => {
    const { scene, act } = setup();
    const { applied } = await act([
      { op: "add", target: "y5", detail: { kind: "note", where: "near" } },
    ]);
    const note = applied[0]!.target;
    await act([{ op: "remove", target: note }]);
    expect(scene.has(note)).toBe(false);
    await expect(act([{ op: "remove", target: "y5" }])).rejects.toMatchObject({
      code: "not_allowed",
    });
    await expect(act([{ op: "move", target: "y5", detail: { near: "b1" } }])).rejects.toMatchObject(
      { code: "not_allowed" },
    );
  });
});

describe("say and ask", () => {
  it("say shows a message and returns its seq", async () => {
    const { story, handle } = setup();
    const { seq } = TOOLS.say.result.parse(
      await handle("say", { text: "Your move", target: "y5" }),
    );
    expect(story.get(seq)).toMatchObject({
      who: "claude",
      type: "say",
      target: "y5",
      detail: { text: "Your move" },
    });
  });

  it("ask's answer comes back as an answer event caused by the ask", async () => {
    const { story, handle } = setup();
    const { seq } = TOOLS.ask.result.parse(
      await handle("ask", { text: "Start with a box?", choices: ["yes", "no"] }),
    );
    handle.actor.answer(seq, "yes");
    expect(story.all().at(-1)).toMatchObject({
      who: "user",
      type: "answer",
      cause: seq,
      detail: { choice: "yes" },
    });
  });

  it("refuses a target that isn't there", async () => {
    await expect(setup().handle("say", { text: "hi", target: "zz" })).rejects.toMatchObject({
      code: "unknown_target",
    });
  });
});
