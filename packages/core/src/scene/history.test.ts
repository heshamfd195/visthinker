import { describe, expect, it } from "vitest";
import { createPackRegistry, STARTER_PACKS } from "../packs/index.ts";
import { createManualClock } from "../ports/index.ts";
import { createToolHandler } from "../tools/index.ts";
import { currentMode, setMode } from "../modes/index.ts";
import {
  createSceneStore,
  createStory,
  createStrokeStore,
  moveObject,
  placeObject,
  readSnapshot,
  recordStroke,
  requestTakeBack,
  sendMessage,
  takeSnapshot,
} from "./index.ts";

const stroke = (id: string, x = 0) => ({
  id,
  t0: 0,
  tool: "pen",
  color: "ink",
  width: 4,
  points: [
    [x, 0, 0.5, 0],
    [x + 100, 0, 0.5, 16],
  ],
});

function setup() {
  const clock = createManualClock();
  const story = createStory(clock);
  const scene = createSceneStore();
  const strokes = createStrokeStore();
  const packs = createPackRegistry(STARTER_PACKS);
  const handle = createToolHandler({ clock, packs, story, scene, strokes });
  return { clock, story, scene, strokes, packs, handle, history: handle.history };
}

const centre = (b: readonly number[]): [number, number] => [b[0]! + b[2]! / 2, b[1]! + b[3]! / 2];

const box = {
  kind: "box" as const,
  box: [10, 10, 50, 40] as [number, number, number, number],
  color: "ink",
};

describe("undo, redo and clear change the canvas (D130–D133 · D141)", () => {
  it("an undone stroke hides its ink, and redo brings it back", () => {
    const { story, strokes, history } = setup();
    recordStroke(story, strokes, stroke("s1"));
    expect(history.undo()).toMatchObject({ type: "undo", cause: 1, target: "s1" });
    expect(history.hiddenStrokes().has("s1")).toBe(true);
    expect(history.redo()).toMatchObject({ type: "redo", cause: 2, target: "s1" });
    expect(history.hiddenStrokes().has("s1")).toBe(false);
  });

  it("an undone placed object leaves the scene and comes back on redo", () => {
    const { story, scene, history } = setup();
    const { object } = placeObject(story, scene, box);
    history.undo();
    expect(scene.has(object.id)).toBe(false);
    history.redo();
    expect(scene.get(object.id)?.box).toEqual([10, 10, 50, 40]);
  });

  it("the canvas has already changed when the event arrives, so the screen redraws right", () => {
    const { story, scene, history } = setup();
    const { object } = placeObject(story, scene, box);
    const seen: boolean[] = [];
    story.subscribe(() => seen.push(scene.has(object.id)));
    history.undo();
    history.redo();
    history.clear();
    expect(seen).toEqual([false, true, false]);
  });

  it("an undone move goes back", () => {
    const { story, scene, history } = setup();
    const { object } = placeObject(story, scene, box);
    moveObject(story, scene, object.id, { dx: 30, dy: 5 });
    history.undo();
    expect(scene.get(object.id)?.box).toEqual([10, 10, 50, 40]);
    history.redo();
    expect(scene.get(object.id)?.box).toEqual([40, 15, 50, 40]);
  });

  it("a new action ends the redo chain (D133)", () => {
    const { story, strokes, history } = setup();
    recordStroke(story, strokes, stroke("s1"));
    history.undo();
    recordStroke(story, strokes, stroke("s2", 200));
    expect(history.canRedo()).toBe(false);
    expect(history.redo()).toBeUndefined();
  });

  it("clear hides everything in one event, and one undo brings it all back (D132)", () => {
    const { story, scene, strokes, history } = setup();
    recordStroke(story, strokes, stroke("s1"));
    const { object } = placeObject(story, scene, box);
    const clear = history.clear();
    expect(clear).toMatchObject({ type: "clear", who: "user" });
    expect(scene.all()).toHaveLength(0);
    expect(history.hiddenStrokes().has("s1")).toBe(true);
    expect(history.clear()).toBeUndefined();
    history.undo();
    expect(scene.has(object.id)).toBe(true);
    expect(history.hiddenStrokes().has("s1")).toBe(false);
  });

  it("the eraser hides ink and removes objects in one undoable event", () => {
    const { story, scene, strokes, history } = setup();
    recordStroke(story, strokes, stroke("s1"));
    const { object } = placeObject(story, scene, box);
    expect(history.erase(["s1", object.id, "nothing"])).toMatchObject({
      type: "erase",
      detail: { ids: ["s1", object.id] },
    });
    expect(history.hiddenStrokes().has("s1")).toBe(true);
    expect(scene.has(object.id)).toBe(false);
    history.undo();
    expect(history.hiddenStrokes().has("s1")).toBe(false);
    expect(scene.has(object.id)).toBe(true);
    expect(history.erase(["nothing"])).toBeUndefined();
  });

  it("undo only takes back the user's own actions (D130)", () => {
    const { story, scene, history } = setup();
    placeObject(story, scene, box, "claude");
    expect(history.canUndo()).toBe(false);
    expect(history.undo()).toBeUndefined();
  });
});

describe("take back in a game (D131)", () => {
  it("asks Claude once it has answered, and an accepted take-back undoes both moves", async () => {
    const { story, scene, handle, history } = setup();
    const board = handle.games.placeBoard("tic-tac-toe", [0, 0, 300, 300]);
    const [c1, c2] = board.order;
    const mine = handle.games.tap(centre(scene.get(c1!)!.box))!;
    // Before Claude answers, undo simply takes back the move.
    expect(history.takeBack()).toBeUndefined();
    await handle("act", { actions: [{ op: "mark", target: c2!, detail: { shape: "O" } }] });
    const theirs = story.all().find((e) => e.type === "place" && e.detail?.["by"] === "claude")!;
    expect(history.takeBack()).toMatchObject({
      mine: { seq: mine.seq },
      theirs: { seq: theirs.seq },
    });

    const request = requestTakeBack(story, history)!;
    expect(request).toMatchObject({ type: "takeback", cause: mine.seq, who: "user" });
    expect(requestTakeBack(story, history)).toBeUndefined();

    await handle("answer", { cause: request.seq, accept: true, text: "Sure" });
    expect(handle.games.markIn(c1!)).toBeUndefined();
    expect(handle.games.markIn(c2!)).toBeUndefined();
    const undos = story.all().filter((e) => e.type === "undo");
    expect(undos.map((e) => [e.who, e.cause])).toEqual([
      ["claude", theirs.seq],
      ["user", mine.seq],
    ]);
  });

  it("a refused take-back leaves the board as it is", async () => {
    const { story, scene, handle, history } = setup();
    const board = handle.games.placeBoard("tic-tac-toe", [0, 0, 300, 300]);
    handle.games.tap(centre(scene.get(board.order[0]!)!.box));
    await handle("act", {
      actions: [{ op: "mark", target: board.order[1]!, detail: { shape: "O" } }],
    });
    const request = requestTakeBack(story, history)!;
    await handle("answer", { cause: request.seq, accept: false });
    expect(handle.games.movesMade(board)).toBe(2);
    await expect(handle("answer", { cause: request.seq, accept: true })).rejects.toThrow(
      /already answered/,
    );
  });
});

describe("modes (D129 · D138 · D139)", () => {
  it("Claude switches with a reason and gets the mode's card", async () => {
    const { story, handle } = setup();
    const result = (await handle("set_mode", { mode: "playing", reason: "you drew a board" })) as {
      card?: string;
    };
    expect(result.card).toMatch(/opponent/);
    expect(currentMode(story.all())).toMatchObject({
      mode: "playing",
      manual: false,
      by: "claude",
    });
  });

  it("a mode picked by hand holds until the person chooses auto", async () => {
    const { story, packs, handle } = setup();
    setMode(story, packs, { mode: "teaching", manual: true, by: "user" });
    await expect(handle("set_mode", { mode: "playing", reason: "a board" })).rejects.toThrow(
      /by hand/,
    );
    setMode(story, packs, { mode: undefined, manual: false, by: "user" });
    await handle("set_mode", { mode: "playing", reason: "a board" });
    expect(currentMode(story.all()).mode).toBe("playing");
  });
});

describe("talking and saving (D135 · D142)", () => {
  it("a message carries what was selected", () => {
    const { story } = setup();
    const event = sendMessage(story, { text: "  what is this? ", refs: ["b1"], chat: "main" });
    expect(event).toMatchObject({
      who: "user",
      type: "message",
      detail: { text: "what is this?", refs: ["b1"], chat: "main" },
    });
    expect(() => sendMessage(story, { text: "   " })).toThrow();
  });

  it("a snapshot brings the canvas back, ids keep counting up", () => {
    const { story, scene, strokes, history } = setup();
    recordStroke(story, strokes, stroke("s1"));
    placeObject(story, scene, box);
    history.undo();
    const parts = readSnapshot(
      JSON.parse(JSON.stringify(takeSnapshot({ story, scene, strokes, history }))),
    );
    const clock = createManualClock();
    const story2 = createStory(clock, parts.events);
    const scene2 = createSceneStore(parts.objects, parts.usedIds);
    const strokes2 = createStrokeStore(parts.strokes);
    const handle2 = createToolHandler({
      clock,
      packs: createPackRegistry(STARTER_PACKS),
      story: story2,
      scene: scene2,
      strokes: strokes2,
      history: parts.history,
    });
    expect(story2.all()).toHaveLength(3);
    expect(story2.unread()).toHaveLength(0);
    expect(strokes2.nextId()).toBe("s2");
    expect(scene2.nextId("b")).toBe("b2");
    handle2.history.redo();
    expect(scene2.all().map((o) => o.id)).toEqual(["b1"]);
  });
});
