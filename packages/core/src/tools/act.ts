// act (D91): Claude names targets by id, never pixels, and the Fast Brain decides where things go
// (D24). Every action is checked first and only then applied, so a batch is all or nothing.
// Moving or removing the user's own drawing becomes a proposal the user accepts (Policy ✅ 9).
// A mark follows the pack's turns, and a winning or last mark ends the game (T25).
import {
  ContractError,
  type ActArgs,
  type ActResult,
  type Action,
  type Box,
  type SceneObject,
  type VisEvent,
  type Who,
} from "@visthinker/contract";
import type { Game, Games } from "../game/games.ts";
import type { SceneStore } from "../scene/store.ts";
import type { Story } from "../scene/story.ts";

type Applied = ActResult["applied"][number];
type Step = (cause: number | undefined) => Applied;
type Batch = { marked: Set<string>; moves: Map<Game, number> };

/** Kinds only the Fast Brain or a pack makes: Claude marks a cell, it doesn't add one. */
const RESERVED_KINDS = new Set(["mark", "cell", "board"]);

export interface Actor {
  act(args: ActArgs): ActResult;
  /** The user answers an ask or a proposal; accepting a proposal applies it. */
  answer(askSeq: number, choice: string): VisEvent | undefined;
}

export function createActor({
  story,
  scene,
  games,
}: {
  story: Story;
  scene: SceneStore;
  games: Games;
}): Actor {
  const mustExist = (id: string): SceneObject => {
    const object = scene.get(id);
    if (!object) throw new ContractError("unknown_target", `no object ${id}`);
    return object;
  };

  const lastUserSeq = () => [...story.all()].reverse().find((e) => e.who === "user")?.seq;

  const emit = (event: Parameters<Story["append"]>[0]) => story.append(event);

  /** Where the anchor puts an object: centred inside it, or just to its right. */
  const placeBy = (anchor: Box, size: [number, number], where: "inside" | "near"): Box => {
    const [x, y, w, h] = anchor;
    const [sw, sh] = size;
    return where === "inside"
      ? [x + (w - sw) / 2, y + (h - sh) / 2, sw, sh]
      : [x + w + 10, y, sw, sh];
  };

  const moveOrRemove = (
    action: Extract<Action, { op: "move" | "remove" }>,
    target: SceneObject,
    cause: number | undefined,
    by: Who,
  ): VisEvent => {
    if (action.op === "remove") {
      scene.remove(target.id);
      return emit({ who: "fastbrain", type: "remove", target: target.id, detail: { by }, cause });
    }
    const [where, to] = Object.entries(action.detail)[0] as ["inside" | "near", string];
    const anchor = mustExist(to);
    scene.update(target.id, (o) => ({
      ...o,
      relations: [
        ...o.relations.filter((r) => r.type !== "inside" && r.type !== "near"),
        { type: where, to },
      ],
      box: placeBy(anchor.box, [o.box[2], o.box[3]], where),
    }));
    return emit({
      who: "fastbrain",
      type: "move",
      target: target.id,
      detail: { [where]: to, by },
      cause,
    });
  };

  /** Checks one action against the scene and the batch so far; returns how to apply it. */
  const plan = (action: Action, batch: Batch): Step => {
    const target = mustExist(action.target);
    const owner = scene.owner(target.id);
    switch (action.op) {
      case "mark": {
        if (target.kind !== "cell") {
          throw new ContractError("not_allowed", `${target.id} is a ${target.kind}, not a cell`);
        }
        if (games.markIn(target.id) || batch.marked.has(target.id)) {
          throw new ContractError("not_allowed", `${target.id} is already marked`);
        }
        // The pack's turns decide whose move it is and which mark Claude makes (D80).
        const game = games.gameOf(target.id);
        if (game?.ended !== undefined) throw new ContractError("not_allowed", "the game is over");
        if (game?.turns) {
          const moves = batch.moves.get(game) ?? games.movesMade(game);
          const turn = game.turns.whoseTurn(moves);
          if (turn !== "claude") {
            throw new ContractError("not_allowed", `it's the ${turn}'s turn, not claude's`);
          }
          const shape = game.turns.markFor("claude");
          if (shape && shape !== action.detail.shape) {
            throw new ContractError(
              "not_allowed",
              `claude plays ${shape}, not ${action.detail.shape}`,
            );
          }
          batch.moves.set(game, moves + 1);
        }
        batch.marked.add(target.id);
        return (cause) => {
          const e = games.placeMark(target, action.detail.shape, "claude", cause);
          return { seq: e.seq, type: "place", target: target.id };
        };
      }
      case "label":
        return (cause) => {
          scene.update(target.id, (o) => ({ ...o, label: action.detail.text }));
          const e = emit({
            who: "fastbrain",
            type: "label",
            target: target.id,
            detail: { text: action.detail.text, by: "claude" },
            cause,
          });
          return { seq: e.seq, type: "place", target: target.id };
        };
      case "add": {
        const { kind, label, where } = action.detail;
        if (RESERVED_KINDS.has(kind)) {
          throw new ContractError("not_allowed", `add can't make a ${kind}: use mark, or a pack`);
        }
        return (cause) => {
          const id = scene.nextId(kind.toLowerCase().replace(/[^a-z]/g, "") || "obj");
          const [, , w, h] = target.box;
          const size: [number, number] = where === "inside" ? [w * 0.6, h * 0.6] : [w, h];
          scene.add(
            {
              id,
              kind,
              label: label ?? kind,
              pack: target.pack,
              parts: [],
              relations: [{ type: where, to: target.id }],
              box: placeBy(target.box, size, where),
              confidence: 1,
            },
            "claude",
          );
          const e = emit({
            who: "fastbrain",
            type: "place",
            target: id,
            detail: { kind, label: label ?? kind, [where]: target.id, by: "claude" },
            cause,
          });
          return { seq: e.seq, type: "place", target: id };
        };
      }
      case "move":
      case "remove": {
        if (target.kind === "mark")
          throw new ContractError("not_allowed", "marks stay where they are");
        if (owner === "fastbrain")
          throw new ContractError("not_allowed", `${target.id} is built by its pack`);
        if (action.op === "move") mustExist(Object.values(action.detail)[0]!);
        if (owner === "user") {
          // The user's own drawing: a proposal they accept (D91 · Policy ✅ 9).
          return (cause) => {
            const e = emit({
              who: "claude",
              type: "propose",
              target: target.id,
              detail: { op: action.op, ...(action.detail ?? {}) },
              cause,
            });
            return { seq: e.seq, type: "propose", target: target.id };
          };
        }
        return (cause) => ({
          seq: moveOrRemove(action, target, cause, "claude").seq,
          type: "place",
          target: target.id,
        });
      }
    }
  };

  return {
    act({ actions }) {
      // Check every action first, then apply them in order: all or nothing (D91).
      const batch: Batch = { marked: new Set(), moves: new Map() };
      const steps = actions.map((action) => plan(action, batch));
      const cause = lastUserSeq();
      return { applied: steps.map((step) => step(cause)) };
    },

    answer(askSeq, choice) {
      const asked = story.get(askSeq);
      if (!asked || !["ask", "propose"].includes(asked.type)) return undefined;
      if (story.all().some((e) => e.type === "answer" && e.cause === askSeq)) return undefined;
      const answer = emit({ who: "user", type: "answer", detail: { choice }, cause: askSeq });
      if (asked.type !== "propose" || !/^(accept|yes|ok)$/i.test(choice)) return answer;
      const target = asked.target ? scene.get(asked.target) : undefined;
      if (!target) return answer;
      const { op, ...detail } = asked.detail as { op: "move" | "remove" };
      try {
        moveOrRemove(
          { op, target: target.id, detail } as Extract<Action, { op: "move" | "remove" }>,
          target,
          answer.seq,
          "user",
        );
      } catch {
        // The anchor is gone since the proposal: nothing to apply.
      }
      return answer;
    },
  };
}
