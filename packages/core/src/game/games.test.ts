import { SceneObject, TOOLS } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createPackRegistry, STARTER_PACKS } from "../packs/index.ts";
import { createManualClock } from "../ports/index.ts";
import { createSceneStore, createStory, createStrokeStore } from "../scene/index.ts";
import { createToolHandler } from "../tools/index.ts";

/** A board at (0,0) 300×300: cell k's centre is at column (k-1)%3, row (k-1)/3, 100 apart. */
const centre = (k: number): [number, number] => [
  ((k - 1) % 3) * 100 + 50,
  Math.floor((k - 1) / 3) * 100 + 50,
];

function setup() {
  const clock = createManualClock();
  const story = createStory(clock);
  const scene = createSceneStore();
  const handle = createToolHandler({
    clock,
    packs: createPackRegistry(STARTER_PACKS),
    story,
    scene,
    strokes: createStrokeStore(),
  });
  handle.games.placeBoard("tic-tac-toe", [0, 0, 300, 300]);
  const tap = (k: number) => handle.games.tap(centre(k));
  const claude = async (cell: string, shape = "O") =>
    TOOLS.act.result.parse(
      await handle("act", { actions: [{ op: "mark", target: cell, detail: { shape } }] }),
    );
  const end = () => story.all().find((e) => e.type === "end");
  return { story, scene, handle, tap, claude, end };
}

describe("a ready-made board (T25)", () => {
  it("places board1 with c1..c9 row by row, the board the user's and the cells the pack's", () => {
    const { scene, story } = setup();
    expect(SceneObject.parse(scene.get("board1"))).toMatchObject({
      kind: "board",
      box: [0, 0, 300, 300],
    });
    expect(scene.get("c5")).toMatchObject({ kind: "cell", box: [100, 100, 100, 100] });
    expect([scene.owner("board1"), scene.owner("c5")]).toEqual(["user", "fastbrain"]);
    expect(story.all()[0]).toMatchObject({
      who: "user",
      type: "place",
      target: "board1",
      detail: { kind: "board", pack: "tic-tac-toe" },
    });
  });

  it("one board at a time, and only from a pack with a grid", () => {
    const { handle } = setup();
    expect(() => handle.games.placeBoard("tic-tac-toe", [400, 0, 300, 300])).toThrow(/one board/);
    expect(() => handle.games.placeBoard("shapes", [400, 0, 300, 300])).toThrow(/no grid/);
  });
});

describe("taking turns (turns block)", () => {
  it("a tap on an empty cell is the user's X, with the mark caused by the tap", () => {
    const { story, scene, tap } = setup();
    const t = tap(5)!;
    expect(t).toMatchObject({ who: "user", type: "mark", target: "c5", detail: { shape: "X" } });
    expect(story.all().at(-1)).toMatchObject({
      who: "fastbrain",
      type: "place",
      target: "c5",
      detail: { shape: "X", by: "user" },
      cause: t.seq,
    });
    expect(scene.all().find((o) => o.kind === "mark")).toMatchObject({ label: "X" });
  });

  it("Claude plays O on its turn", async () => {
    const { tap, claude, scene } = setup();
    tap(5);
    expect((await claude("c1")).applied[0]).toMatchObject({ type: "place", target: "c1" });
    expect(scene.owner(scene.all().filter((o) => o.kind === "mark")[1]!.id)).toBe("claude");
  });

  it("Claude can't go first, can't play X, and can't play twice in a row", async () => {
    const { tap, claude } = setup();
    await expect(claude("c1")).rejects.toMatchObject({
      code: "not_allowed",
      message: expect.stringContaining("user's turn"),
    });
    tap(5);
    await expect(claude("c1", "X")).rejects.toMatchObject({
      message: expect.stringContaining("claude plays O"),
    });
    await claude("c1");
    await expect(claude("c2")).rejects.toMatchObject({ code: "not_allowed" });
  });

  it("two marks in one act batch count as two moves", async () => {
    const { tap, handle } = setup();
    tap(5);
    const two = [
      { op: "mark", target: "c1", detail: { shape: "O" } },
      { op: "mark", target: "c2", detail: { shape: "O" } },
    ];
    await expect(handle("act", { actions: two })).rejects.toMatchObject({ code: "not_allowed" });
  });

  it("the user can't tap out of turn, on a taken cell, or off the board", async () => {
    const { tap, claude } = setup();
    tap(5);
    expect(tap(1)).toBeUndefined();
    await claude("c1");
    expect(tap(1)).toBeUndefined();
    expect(tap(5)).toBeUndefined();
    expect(setup().handle.games.tap([900, 900])).toBeUndefined();
  });
});

describe("the end (line-of block)", () => {
  it("three X in a row: the user wins, and the end names the line", async () => {
    const { tap, claude, end } = setup();
    tap(1);
    await claude("c4");
    tap(2);
    await claude("c5");
    tap(3);
    expect(end()).toMatchObject({
      who: "fastbrain",
      type: "end",
      target: "board1",
      detail: { winner: "user", mark: "X", line: ["c1", "c2", "c3"] },
    });
  });

  it("Claude can win too, and then nobody can play", async () => {
    const { tap, claude, end } = setup();
    tap(1);
    await claude("c5");
    tap(2);
    await claude("c3");
    tap(4);
    await claude("c7");
    expect(end()?.detail).toMatchObject({ winner: "claude", mark: "O", line: ["c3", "c5", "c7"] });
    expect(tap(9)).toBeUndefined();
    await expect(claude("c9")).rejects.toMatchObject({ message: "the game is over" });
  });

  it("a full board without a line is a draw", async () => {
    const { tap, claude, end } = setup();
    // X: 1 3 4 8 9 · O: 2 5 6 7 → no line.
    tap(1);
    await claude("c2");
    tap(3);
    await claude("c5");
    tap(4);
    await claude("c6");
    tap(8);
    await claude("c7");
    tap(9);
    expect(end()?.detail).toEqual({ winner: null, mark: null, line: [] });
  });
});
