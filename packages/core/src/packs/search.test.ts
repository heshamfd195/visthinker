import type { Point2, Stroke } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createComparator } from "../comparator/index.ts";
import { createGames } from "../game/index.ts";
import { createManualClock } from "../ports/index.ts";
import { createSceneStore, createStory, createStrokeStore, recordStroke } from "../scene/index.ts";
import { createActor } from "../tools/act.ts";
import { createPackRegistry, createPackSearch, STARTER_PACKS } from "./index.ts";

let n = 0;
const line = (a: Point2, b: Point2): Stroke => ({
  id: `s${++n}`,
  t0: 0,
  tool: "pen",
  color: "#222",
  width: 4,
  points: Array.from({ length: 21 }, (_, i) => [
    a[0] + ((b[0] - a[0]) * i) / 20,
    a[1] + ((b[1] - a[1]) * i) / 20,
    0.5,
    i * 8,
  ]),
});

/** Let queued microtasks run (the search waits for the whole change). */
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise<void>((r) => queueMicrotask(r));
};

function setup() {
  const clock = createManualClock();
  const story = createStory(clock);
  const scene = createSceneStore();
  const strokes = createStrokeStore();
  const packs = createPackRegistry(STARTER_PACKS);
  const games = createGames({ story, scene, packs });
  const actor = createActor({ story, scene, games });
  const comparator = createComparator({ scene, story, strokes, clock, packs: () => STARTER_PACKS });
  createPackSearch({ story, scene, packs, games });
  const draw = (s: Stroke) => comparator.onStroke(s, recordStroke(story, strokes, s));
  const drawGrid = () => {
    draw(line([150, 0], [152, 500]));
    draw(line([300, 0], [298, 500]));
    draw(line([0, 170], [500, 168]));
    draw(line([0, 330], [500, 332]));
  };
  const asks = () => story.all().filter((e) => e.type === "ask");
  return { story, scene, games, actor, draw, drawGrid, asks };
}

describe("pack search (D68)", () => {
  it("a drawn # makes the Fast Brain ask 'Tic-tac-toe?', once the 4th line is in", async () => {
    const { draw, asks } = setup();
    draw(line([150, 0], [152, 500]));
    draw(line([300, 0], [298, 500]));
    draw(line([0, 170], [500, 168]));
    await settle();
    expect(asks()).toEqual([]);
    draw(line([0, 330], [500, 332]));
    await settle();
    expect(asks()).toEqual([
      expect.objectContaining({
        who: "fastbrain",
        type: "ask",
        detail: {
          text: "Tic-tac-toe? Shall I build it and continue?",
          choices: ["yes", "no"],
          pack: "tic-tac-toe",
        },
      }),
    ]);
  });

  it("yes builds the board from your own lines, and the game starts", async () => {
    const { scene, story, games, actor, drawGrid, asks } = setup();
    drawGrid();
    await settle();
    const answer = actor.answer(asks()[0]!.seq, "yes")!;
    await settle();
    expect(scene.get("board1")).toMatchObject({
      kind: "board",
      pack: "tic-tac-toe",
      geom: { from: "crossings" },
    });
    expect(scene.all().filter((o) => o.kind === "cell")).toHaveLength(9);
    expect(story.all().find((e) => e.type === "recognized" && e.target === "board1")?.cause).toBe(
      answer.seq,
    );
    // c5 sits between the crossings: (150..300, 170..330)
    expect(games.tap([225, 250])).toMatchObject({ type: "mark", target: "c5" });
  });

  it("no builds nothing, and the same lines are never asked about again", async () => {
    const { scene, actor, drawGrid, asks, draw } = setup();
    drawGrid();
    await settle();
    actor.answer(asks()[0]!.seq, "no");
    draw(line([700, 700], [740, 740]));
    await settle();
    expect(scene.all().some((o) => o.kind === "board")).toBe(false);
    expect(asks()).toHaveLength(1);
  });

  it("doesn't ask while a board for that pack is already on the canvas", async () => {
    const { games, drawGrid, asks } = setup();
    games.placeBoard("tic-tac-toe", [600, 600, 300, 300]);
    drawGrid();
    await settle();
    expect(asks()).toEqual([]);
  });
});
