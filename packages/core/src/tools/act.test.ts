import { TOOLS, type SceneObject } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createManualClock } from "../ports/index.ts";
import { createSceneStore, createStory, createStrokeStore, placeObject } from "../scene/index.ts";
import { createToolHandler } from "./index.ts";

const object = (id: string, kind: string, box: SceneObject["box"]): SceneObject => ({
  id,
  kind,
  label: kind,
  pack: "tic-tac-toe",
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
  const handle = createToolHandler({ clock, story, scene, strokes });
  // A cell built by a pack, and a box the user placed.
  scene.add(object("c5", "cell", [200, 200, 100, 100]), "fastbrain");
  placeObject(story, scene, { kind: "box", box: [0, 0, 50, 50], color: "#222" });
  const act = async (actions: unknown[]) =>
    TOOLS.act.result.parse(await handle("act", { actions }));
  return { story, scene, handle, act };
}

describe("act: mark (D91)", () => {
  it("marks a cell by id; the Fast Brain puts the mark in the cell", async () => {
    const { scene, story, act } = setup();
    const result = await act([{ op: "mark", target: "c5", detail: { shape: "O" } }]);
    expect(result.applied).toEqual([{ seq: 2, type: "place", target: "c5" }]);
    const mark = scene.all().find((o) => o.kind === "mark")!;
    expect(mark).toMatchObject({
      label: "O",
      box: [200, 200, 100, 100],
      relations: [{ type: "inside", to: "c5" }],
    });
    expect(scene.owner(mark.id)).toBe("claude");
    expect(story.get(2)).toMatchObject({ who: "fastbrain", type: "place", cause: 1 });
  });

  it("refuses a cell that's already marked, or marked twice in one batch", async () => {
    const { act } = setup();
    const mark = { op: "mark", target: "c5", detail: { shape: "O" } };
    await expect(act([mark, mark])).rejects.toMatchObject({ code: "not_allowed" });
    await act([mark]);
    await expect(act([mark])).rejects.toMatchObject({ code: "not_allowed" });
  });

  it("refuses to mark something that isn't a cell, or isn't there", async () => {
    const { act } = setup();
    await expect(act([{ op: "mark", target: "b1", detail: { shape: "O" } }])).rejects.toMatchObject(
      { code: "not_allowed" },
    );
    await expect(act([{ op: "mark", target: "c9", detail: { shape: "O" } }])).rejects.toMatchObject(
      { code: "unknown_target" },
    );
  });
});

describe("act: all or nothing (D91)", () => {
  it("one bad action applies nothing at all", async () => {
    const { scene, story, act } = setup();
    const before = story.all().length;
    await expect(
      act([
        { op: "label", target: "c5", detail: { text: "centre" } },
        { op: "mark", target: "nope", detail: { shape: "O" } },
      ]),
    ).rejects.toMatchObject({ code: "unknown_target" });
    expect(story.all()).toHaveLength(before);
    expect(scene.get("c5")!.label).toBe("cell");
  });

  it("applies a good batch in order", async () => {
    const { act } = setup();
    const result = await act([
      { op: "label", target: "c5", detail: { text: "centre" } },
      { op: "mark", target: "c5", detail: { shape: "O" } },
    ]);
    expect(result.applied.map((a) => a.seq)).toEqual([2, 3]);
  });
});

describe("act: add, label (D24)", () => {
  it("adds next to an anchor; the Fast Brain picks the box", async () => {
    const { scene, act } = setup();
    const result = await act([
      { op: "add", target: "c5", detail: { kind: "note", label: "your turn", where: "near" } },
    ]);
    const note = scene.get(result.applied[0]!.target)!;
    expect(note).toMatchObject({ kind: "note", label: "your turn", box: [310, 200, 100, 100] });
    expect(note.relations).toEqual([{ type: "near", to: "c5" }]);
  });

  it("can't add a mark, cell or board", async () => {
    const { act } = setup();
    for (const kind of ["mark", "cell", "board"]) {
      await expect(act([{ op: "add", target: "c5", detail: { kind } }])).rejects.toMatchObject({
        code: "not_allowed",
      });
    }
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
    const result = await act([{ op: "move", target: "b1", detail: { near: "c5" } }]);
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

  it("Claude's own objects move at once; pack-built ones and marks never", async () => {
    const { scene, act } = setup();
    const { applied } = await act([
      { op: "add", target: "c5", detail: { kind: "note", where: "near" } },
    ]);
    const note = applied[0]!.target;
    await act([{ op: "remove", target: note }]);
    expect(scene.has(note)).toBe(false);
    await expect(act([{ op: "remove", target: "c5" }])).rejects.toMatchObject({
      code: "not_allowed",
    });
    await act([{ op: "mark", target: "c5", detail: { shape: "O" } }]);
    const mark = scene.all().find((o) => o.kind === "mark")!.id;
    await expect(act([{ op: "move", target: mark, detail: { near: "b1" } }])).rejects.toMatchObject(
      { code: "not_allowed" },
    );
  });
});

describe("say and ask", () => {
  it("say shows a message and returns its seq", async () => {
    const { story, handle } = setup();
    const { seq } = TOOLS.say.result.parse(
      await handle("say", { text: "Your move", target: "c5" }),
    );
    expect(story.get(seq)).toMatchObject({
      who: "claude",
      type: "say",
      target: "c5",
      detail: { text: "Your move" },
    });
  });

  it("ask's answer comes back as an answer event caused by the ask", async () => {
    const { story, handle } = setup();
    const { seq } = TOOLS.ask.result.parse(
      await handle("ask", { text: "Tic-tac-toe?", choices: ["yes", "no"] }),
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
