// Games (T25): a board from a pack whose rules have a grid, played by the pack's turns and ended
// by its line-of (D80). The turn comes from the marks on the board, so it can't drift.
import {
  ContractError,
  type Box,
  type LineOfRules,
  type Point2,
  type SceneObject,
  type VisEvent,
  type Who,
} from "@visthinker/contract";
import {
  buildBoard,
  checkLines,
  createTurns,
  inPolygon,
  planUniformGrid,
  type Turns,
} from "../blocks/index.ts";
import type { PackRegistry } from "../packs/loader.ts";
import type { SceneStore } from "../scene/store.ts";
import type { Story } from "../scene/story.ts";

export interface Game {
  pack: string;
  board: string;
  /** Cell ids in order, c1..c9: line-of's 1-based numbers index them. */
  order: string[];
  turns: Turns | undefined;
  lineOf: LineOfRules | undefined;
  /** The seq of the `end` event once the game is over. */
  ended?: number;
}

export interface Games {
  /** Places a ready-made board for a pack, owned by the user, with its cells built by the pack. */
  placeBoard(packName: string, box: Box): Game;
  /** Builds a pack's board from the lines and crossings the user drew, and starts its game (D68). */
  buildFromDrawing(packName: string, cause: number): Game;
  /** The game a cell belongs to. */
  gameOf(cellId: string): Game | undefined;
  /** The mark in a cell, if any. */
  markIn(cellId: string): SceneObject | undefined;
  movesMade(game: Game): number;
  /** Puts a mark in a cell, then ends the game if the mark wins or fills the board. */
  placeMark(cell: SceneObject, shape: string, by: Who, cause: number | undefined): VisEvent;
  /** The user taps the canvas: on an empty cell, on their turn, it's their move. */
  tap(at: Point2): VisEvent | undefined;
}

export function createGames({
  story,
  scene,
  packs,
}: {
  story: Story;
  scene: SceneStore;
  packs: PackRegistry;
}): Games {
  const games: Game[] = [];

  const markIn = (cellId: string) =>
    scene
      .all()
      .find(
        (o) => o.kind === "mark" && o.relations.some((r) => r.type === "inside" && r.to === cellId),
      );

  const gameOf = (cellId: string) => games.find((g) => g.order.includes(cellId));

  const movesMade = (game: Game) => game.order.filter((c) => markIn(c)).length;

  const checkEnd = (game: Game, place: VisEvent) => {
    if (!game.lineOf || game.ended !== undefined) return;
    const outcome = checkLines(game.lineOf, game.order, (c) => markIn(c)?.label);
    if (!outcome.over) return;
    const first = outcome.line[0];
    const winner = first === undefined ? null : (scene.owner(markIn(first)!.id) ?? null);
    game.ended = story.append({
      who: "fastbrain",
      type: "end",
      target: game.board,
      detail: { winner, mark: outcome.mark, line: outcome.line },
      cause: place.seq,
    }).seq;
  };

  const placeMark: Games["placeMark"] = (cell, shape, by, cause) => {
    const id = scene.nextId("m");
    scene.add(
      {
        id,
        kind: "mark",
        label: shape,
        pack: cell.pack,
        parts: [],
        relations: [{ type: "inside", to: cell.id }],
        box: [...cell.box],
        confidence: 1,
      },
      by,
    );
    const place = story.append({
      who: "fastbrain",
      type: "place",
      target: cell.id,
      detail: { shape, by, mark: id },
      cause,
    });
    const game = gameOf(cell.id);
    if (game) checkEnd(game, place);
    return place;
  };

  const rulesOf = (packName: string) => {
    const rules = packs.get(packName)?.pack["rules.json"];
    if (!rules?.grid) throw new ContractError("not_allowed", `pack ${packName} has no grid`);
    return { ...rules, grid: rules.grid };
  };

  const startGame = (packName: string, board: string, order: string[]): Game => {
    const rules = rulesOf(packName);
    const game: Game = {
      pack: packName,
      board,
      order,
      turns: rules.turns && createTurns(rules.turns),
      lineOf: rules["line-of"],
    };
    games.push(game);
    return game;
  };

  return {
    buildFromDrawing(packName, cause) {
      const built = buildBoard({
        scene,
        story,
        pack: packName,
        rules: rulesOf(packName).grid,
        cause,
      });
      if ("error" in built) throw new ContractError("not_allowed", built.error);
      return startGame(
        packName,
        built.board.id,
        built.cells.map((c) => c.id),
      );
    },

    placeBoard(packName, box) {
      const loaded = packs.get(packName);
      const rules = loaded?.pack["rules.json"];
      if (!rules?.grid) throw new ContractError("not_allowed", `pack ${packName} has no grid`);
      const plan = planUniformGrid(rules.grid, box);
      if ("error" in plan) throw new ContractError("bad_args", plan.error);
      const taken = plan.cells.find((c) => scene.has(c.id));
      if (taken)
        throw new ContractError(
          "not_allowed",
          `${taken.id} is already on the canvas: one board at a time`,
        );

      const board: SceneObject = {
        id: scene.nextId("board"),
        kind: "board",
        label: `${packName} board`,
        pack: packName,
        parts: plan.cells.map((c) => c.id),
        relations: [],
        box: plan.board,
        confidence: 1,
      };
      scene.add(board, "user");
      for (const c of plan.cells) {
        scene.add(
          {
            id: c.id,
            kind: "cell",
            label: c.label,
            pack: packName,
            parts: [],
            relations: [{ type: "inside", to: board.id }],
            box: c.box,
            confidence: 1,
            geom: { poly: c.poly },
          },
          "fastbrain",
        );
      }
      story.append({
        who: "user",
        type: "place",
        target: board.id,
        detail: { kind: "board", pack: packName, box: board.box },
      });
      return startGame(
        packName,
        board.id,
        plan.cells.map((c) => c.id),
      );
    },

    gameOf,
    markIn,
    movesMade,
    placeMark,

    tap(at) {
      const cell = scene
        .all()
        .find(
          (o) =>
            o.kind === "cell" &&
            o.geom &&
            "poly" in o.geom &&
            inPolygon(at, o.geom.poly as Point2[]),
        );
      if (!cell) return undefined;
      const game = gameOf(cell.id);
      if (!game || game.ended !== undefined || markIn(cell.id)) return undefined;
      if (game.turns && game.turns.whoseTurn(movesMade(game)) !== "user") return undefined;
      const shape = game.turns?.markFor("user") ?? "X";
      const tap = story.append({ who: "user", type: "mark", target: cell.id, detail: { shape } });
      placeMark(cell, shape, "user", tap.seq);
      return tap;
    },
  };
}
