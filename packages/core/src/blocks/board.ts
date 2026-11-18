// Puts a planned grid into the scene: a `board` with the cells as `parts`, each cell `inside` it.
import type { GridRules, SceneObject } from "@visthinker/contract";
import type { SceneStore } from "../scene/store.ts";
import type { Story } from "../scene/story.ts";
import { planGrid } from "./grid.ts";

export interface BuiltBoard {
  board: SceneObject;
  cells: SceneObject[];
  /** Cells on the board's edge. */
  outer: string[];
}

export function buildBoard(opts: {
  scene: SceneStore;
  story: Story;
  pack: string;
  rules: GridRules;
  /** The seq that led to the build: the pack loading, or the stroke that completed the grid. */
  cause: number;
}): BuiltBoard | { error: string } {
  const { scene, story, pack, rules, cause } = opts;
  // Checked before anything changes: the scene never holds a board the story doesn't explain.
  if (!story.get(cause)) return { error: `cause ${cause} is not an event in the story` };
  const crossings = scene.all().filter((o) => o.kind === "crossing");
  const lines = scene.all().filter((o) => o.kind === "line");
  const plan = planGrid(rules, crossings, lines);
  if ("error" in plan) return plan;
  const taken = plan.cells.find((c) => scene.has(c.id));
  if (taken) return { error: `${taken.id} is already in the scene` };

  const confidence = Math.min(...crossings.map((c) => c.confidence));
  const board: SceneObject = {
    id: scene.nextId("board"),
    kind: "board",
    label: `${pack} board`,
    pack,
    parts: plan.cells.map((c) => c.id),
    relations: [],
    box: plan.board,
    confidence,
    // Built from the user's own lines: the canvas draws no lines of its own over them.
    geom: { from: "crossings" },
  };
  scene.add(board, "fastbrain");
  const cells = plan.cells.map((c): SceneObject => {
    const cell: SceneObject = {
      id: c.id,
      kind: "cell",
      label: c.label,
      pack,
      parts: [],
      relations: [{ type: "inside", to: board.id }],
      box: c.box,
      confidence,
      geom: { poly: c.poly },
    };
    scene.add(cell, "fastbrain");
    return cell;
  });
  story.append({
    who: "fastbrain",
    type: "recognized",
    target: board.id,
    detail: { kind: "board" },
    cause,
  });
  return { board, cells, outer: plan.cells.filter((c) => c.outer).map((c) => c.id) };
}
