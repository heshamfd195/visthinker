import type { Point2, Stroke } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createComparator } from "../comparator/index.ts";
import { createPackRegistry, STARTER_PACKS } from "../packs/index.ts";
import { createManualClock } from "../ports/index.ts";
import { createSceneStore, createStory, createStrokeStore, recordStroke } from "../scene/index.ts";
import { createActor } from "../tools/act.ts";
import { createGames } from "./index.ts";

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
  // A ready-made board at (0,0) 300×300: c5 spans (100..200, 100..200).
  games.placeBoard("tic-tac-toe", [0, 0, 300, 300]);
  let n = 0;
  const stroke = (pts: Point2[]): Stroke => ({
    id: `s${++n}`,
    t0: clock.now(),
    tool: "pen",
    color: "#222",
    width: 4,
    points: pts.map(([x, y], i) => [x, y, 0.5, i * 6]),
  });
  const line = (a: Point2, b: Point2): Point2[] =>
    Array.from({ length: 13 }, (_, i) => [
      a[0] + ((b[0] - a[0]) * i) / 12,
      a[1] + ((b[1] - a[1]) * i) / 12,
    ]);
  const ring = (cx: number, cy: number, r: number): Point2[] =>
    Array.from({ length: 33 }, (_, i) => [
      cx + r * Math.cos((i / 32) * 2 * Math.PI),
      cy + r * Math.sin((i / 32) * 2 * Math.PI),
    ]);
  const draw = (pts: Point2[]) => {
    const s = stroke(pts);
    comparator.onStroke(s, recordStroke(story, strokes, s));
    clock.advance(100);
    return s;
  };
  /** Draws an X centred at (cx, cy), then waits for it to be read. */
  const drawX = async (cx: number, cy: number) => {
    const a = draw(line([cx - 30, cy - 30], [cx + 30, cy + 30]));
    const b = draw(line([cx + 30, cy - 30], [cx - 30, cy + 30]));
    clock.advance(600);
    await settle();
    return [a.id, b.id];
  };
  /** An X whose second stroke comes 0.9 s after the first (D110). */
  const drawSlowX = async (cx: number, cy: number) => {
    draw(line([cx - 30, cy - 30], [cx + 30, cy + 30]));
    clock.advance(800);
    await settle();
    draw(line([cx + 30, cy - 30], [cx - 30, cy + 30]));
    clock.advance(600);
    await settle();
  };
  const drawO = async (cx: number, cy: number) => {
    draw(ring(cx, cy, 30));
    clock.advance(600);
    await settle();
  };
  return { story, scene, games, actor, drawX, drawSlowX, drawO };
}

describe("playing by drawing (T31)", () => {
  it("an X drawn in an empty cell on your turn is your move, via drawn", async () => {
    const { story, scene, drawX } = setup();
    const ids = await drawX(150, 150);
    const move = story.all().find((e) => e.type === "mark")!;
    expect(move).toMatchObject({ who: "user", target: "c5", detail: { shape: "X", via: "drawn" } });
    expect(story.get(move.cause!)).toMatchObject({
      type: "recognized",
      detail: { kind: "symbol", label: "X" },
    });
    const mark = scene.all().find((o) => o.kind === "mark")!;
    expect(mark).toMatchObject({
      label: "X",
      strokes: ids,
      relations: [{ type: "inside", to: "c5" }],
    });
    expect(scene.all().some((o) => o.kind === "symbol")).toBe(false);
  });

  it("then it's Claude's turn: act plays O as usual", async () => {
    const { actor, drawX } = setup();
    await drawX(150, 150);
    expect(
      actor.act({ actions: [{ op: "mark", target: "c1", detail: { shape: "O" } }] }).applied,
    ).toHaveLength(1);
  });

  it("an O on your turn isn't your mark: it stays a symbol, uncorrected", async () => {
    const { story, scene, drawO } = setup();
    await drawO(150, 150);
    expect(story.all().some((e) => e.type === "mark")).toBe(false);
    expect(scene.all().find((o) => o.kind === "symbol")).toMatchObject({ label: "O" });
  });

  it("an X out of turn, or in a taken cell, isn't a move either", async () => {
    const { story, actor, drawX } = setup();
    await drawX(150, 150);
    await drawX(50, 50); // Claude's turn now
    expect(story.all().filter((e) => e.type === "mark")).toHaveLength(1);
    actor.act({ actions: [{ op: "mark", target: "c9", detail: { shape: "O" } }] });
    await drawX(150, 150); // c5 is taken
    expect(story.all().filter((e) => e.type === "mark")).toHaveLength(1);
  });

  it("a drawn winning line ends the game", async () => {
    const { story, actor, drawX } = setup();
    await drawX(50, 50);
    actor.act({ actions: [{ op: "mark", target: "c4", detail: { shape: "O" } }] });
    await drawX(150, 50);
    actor.act({ actions: [{ op: "mark", target: "c5", detail: { shape: "O" } }] });
    await drawX(250, 50);
    expect(story.all().find((e) => e.type === "end")?.detail).toMatchObject({
      winner: "user",
      line: ["c1", "c2", "c3"],
    });
  });

  it("D110: a slow X in a cell still plays your move once its second stroke arrives", async () => {
    const t = setup();
    // drawX's strokes are 100 ms apart; this one waits 0.9 s between them, like a real hand.
    const { story } = t;
    const before = story.all().length;
    await t.drawSlowX(150, 150);
    const move = story
      .all()
      .slice(before)
      .find((e) => e.type === "mark");
    expect(move).toMatchObject({ who: "user", target: "c5", detail: { shape: "X", via: "drawn" } });
  });
});
