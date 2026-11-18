import { CounterRules, PackRules, SceneObject, type Point2 } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createManualClock } from "../ports/index.ts";
import { createSceneStore, createStory } from "../scene/index.ts";
import {
  buildBoard,
  checkLines,
  countIn,
  createTurns,
  inPolygon,
  parseIds,
  planGrid,
} from "./index.ts";

const GRID = { from: "crossings", rows: 3, cols: 3, ids: "c1..c9" } as const;
const TURNS = { order: ["user", "claude"], marks: { user: "X", claude: "O" } } as const;
const WIN = {
  length: 3,
  win: [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [1, 4, 7],
    [2, 5, 8],
    [3, 6, 9],
    [1, 5, 9],
    [3, 5, 7],
  ],
};

const base = {
  label: "",
  pack: "shapes",
  parts: [],
  box: [0, 0, 0, 0] as SceneObject["box"],
  confidence: 1,
};
const line = (id: string, a: Point2, b: Point2): SceneObject => ({
  ...base,
  id,
  kind: "line",
  relations: [],
  geom: { a, b },
});
const crossing = (id: string, at: Point2, on: [string, string]): SceneObject => ({
  ...base,
  id,
  kind: "crossing",
  relations: on.map((to) => ({ type: "on", to })),
  geom: { at },
});

/** A # drawn as two vertical and two horizontal lines, crossing at (150|250, 100|160). */
function hash(tilt = 0): { lines: SceneObject[]; crossings: SceneObject[] } {
  const t = (x: number, y: number): Point2 => [x + tilt * y, y];
  return {
    lines: [
      line("v1", t(150, 0), t(150, 300)),
      line("v2", t(250, 0), t(250, 300)),
      line("h1", t(0, 100), t(400, 100)),
      line("h2", t(0, 160), t(400, 160)),
    ],
    crossings: [
      crossing("a", t(150, 100), ["v1", "h1"]),
      crossing("b", t(250, 100), ["h1", "v2"]),
      crossing("c", t(150, 160), ["v1", "h2"]),
      crossing("d", t(250, 160), ["v2", "h2"]),
    ],
  };
}

describe("grid block (D95)", () => {
  it("sizes cells from the crossing spacing, copying the middle cell outward", () => {
    const { lines, crossings } = hash();
    const plan = planGrid(GRID, crossings, lines);
    if ("error" in plan) throw new Error(plan.error);
    expect(plan.board).toEqual([50, 40, 300, 180]);
    expect(plan.cells[4]).toEqual({
      id: "c5",
      label: "cell 5",
      box: [150, 100, 100, 60],
      poly: [
        [150, 100],
        [250, 100],
        [250, 160],
        [150, 160],
      ],
      outer: false,
    });
    expect(plan.cells.filter((c) => c.outer)).toHaveLength(8);
  });

  it("numbers cells row by row from the top left, whatever order the crossings come in", () => {
    const { lines, crossings } = hash();
    const plan = planGrid(GRID, [...crossings].reverse(), lines);
    if ("error" in plan) throw new Error(plan.error);
    expect(plan.cells.map((c) => c.id)).toEqual([
      "c1",
      "c2",
      "c3",
      "c4",
      "c5",
      "c6",
      "c7",
      "c8",
      "c9",
    ]);
    expect(plan.cells[0]!.box[0]).toBeLessThan(plan.cells[2]!.box[0]);
  });

  it("on a tilted grid, cells follow the lines: a tap in the slanted c5 lands in c5", () => {
    const { lines, crossings } = hash(0.3);
    const plan = planGrid(GRID, crossings, lines);
    if ("error" in plan) throw new Error(plan.error);
    const c5 = plan.cells[4]!.poly;
    expect(inPolygon([200 + 0.3 * 130, 130], c5)).toBe(true);
    expect(inPolygon([200, 40], c5)).toBe(false);
  });

  it("refuses too few crossings, mismatched ids, and crossings not on two lines", () => {
    expect(planGrid(GRID, [], [])).toEqual({ error: expect.stringMatching(/0 crossings/) });
    expect(planGrid({ ...GRID, ids: "c1..c8" }, [], [])).toEqual({
      error: expect.stringMatching(/8 cells/),
    });
    const { lines, crossings } = hash();
    const loose = [{ ...crossings[0]!, relations: [] }, ...crossings.slice(1)];
    expect(planGrid(GRID, loose, lines)).toEqual({
      error: expect.stringMatching(/not on two lines/),
    });
    expect(parseIds("cell1..cell16")).toEqual({ prefix: "cell", count: 16 });
  });

  it("builds board1 and its cells into the scene, owned by the Fast Brain, and says so", () => {
    const story = createStory(createManualClock());
    const scene = createSceneStore();
    const { lines, crossings } = hash();
    for (const o of [...lines, ...crossings]) scene.add(o, "fastbrain");
    // A board with no cause in the story is refused before the scene changes.
    expect(buildBoard({ scene, story, pack: "tic-tac-toe", rules: GRID, cause: 1 })).toEqual({
      error: expect.stringMatching(/not an event/),
    });
    expect(scene.has("board1")).toBe(false);
    story.append({ who: "user", type: "stroke", target: "s4" });
    const built = buildBoard({ scene, story, pack: "tic-tac-toe", rules: GRID, cause: 1 });
    if ("error" in built) throw new Error(built.error);
    expect(SceneObject.parse(built.board)).toEqual(built.board);
    expect(built.board).toMatchObject({
      id: "board1",
      kind: "board",
      parts: built.cells.map((c) => c.id),
    });
    expect(scene.get("c5")).toMatchObject({
      kind: "cell",
      relations: [{ type: "inside", to: "board1" }],
    });
    expect(scene.owner("c5")).toBe("fastbrain");
    expect(story.all().at(-1)).toMatchObject({
      who: "fastbrain",
      type: "recognized",
      target: "board1",
      cause: 1,
    });
    expect(buildBoard({ scene, story, pack: "tic-tac-toe", rules: GRID, cause: 1 })).toEqual({
      error: expect.stringMatching(/already in the scene/),
    });
  });
});

describe("turns block", () => {
  it("user X first, then claude O, and around again", () => {
    const turns = createTurns(TURNS as never);
    expect([0, 1, 2, 3].map(turns.whoseTurn)).toEqual(["user", "claude", "user", "claude"]);
    expect([turns.markFor("user"), turns.markFor("claude"), turns.markFor("api")]).toEqual([
      "X",
      "O",
      undefined,
    ]);
  });
});

describe("line-of block", () => {
  const cells = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9"];
  const board = (marks: string) => (id: string) => {
    const m = marks[cells.indexOf(id)];
    return m === "." ? undefined : m;
  };

  it("finds three in a row, column or diagonal", () => {
    expect(checkLines(WIN, cells, board("XXX.O.O.."))).toEqual({
      over: true,
      mark: "X",
      line: ["c1", "c2", "c3"],
    });
    expect(checkLines(WIN, cells, board(".O..O..O."))).toEqual({
      over: true,
      mark: "O",
      line: ["c2", "c5", "c8"],
    });
    expect(checkLines(WIN, cells, board("X.O.X.O.X"))).toMatchObject({
      over: true,
      mark: "X",
      line: ["c1", "c5", "c9"],
    });
  });

  it("a full board with no line is a draw; otherwise play goes on", () => {
    expect(checkLines(WIN, cells, board("XOXXOOOXX"))).toEqual({
      over: true,
      mark: null,
      line: [],
    });
    expect(checkLines(WIN, cells, board("XO.......")).over).toBe(false);
  });
});

describe("counter block", () => {
  const mark = (id: string, label: string): SceneObject => ({
    ...base,
    id,
    kind: "mark",
    label,
    relations: [],
  });
  const scene = [
    mark("m1", "X"),
    mark("m2", "O"),
    mark("m3", "X"),
    { ...mark("b1", "box"), kind: "box" },
  ];

  it("counts objects of a kind, or of one label, against a limit", () => {
    expect(countIn(CounterRules.parse({ of: "mark" }), scene)).toEqual({
      count: 3,
      reached: false,
    });
    expect(countIn(CounterRules.parse({ of: "mark", label: "X" }), scene)).toEqual({
      count: 2,
      reached: false,
    });
    expect(countIn(CounterRules.parse({ of: "mark", limit: 3 }), scene)).toEqual({
      count: 3,
      reached: true,
    });
  });

  it("a pack can wire it in rules.json", () => {
    expect(PackRules.safeParse({ counter: { of: "mark", limit: 9 } }).success).toBe(true);
    expect(PackRules.safeParse({ counter: { of: "", limit: 0 } }).success).toBe(false);
  });
});
