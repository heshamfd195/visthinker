import type { Point2 } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { STARTER_PACKS } from "../packs/index.ts";
import { createRecognizer, parseSymbolRules, symbolSetsFrom } from "./index.ts";

const line = (a: Point2, b: Point2, n = 12): Point2[] =>
  Array.from({ length: n + 1 }, (_, i) => [
    a[0] + ((b[0] - a[0]) * i) / n,
    a[1] + ((b[1] - a[1]) * i) / n,
  ]);
const ring = (cx: number, cy: number, rx: number, ry: number, from = 0, turns = 1): Point2[] =>
  Array.from({ length: 33 }, (_, i) => {
    const t = from + (i / 32) * turns * 2 * Math.PI;
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  });

const sets = symbolSetsFrom(STARTER_PACKS);
const recognizer = createRecognizer(sets);
const pOnly = createRecognizer(sets, { crossRule: false });

describe("symbol sets from packs (D96)", () => {
  it("shapes lists the symbol block and holds the X and O templates; tic-tac-toe has none", () => {
    expect(sets.map((s) => s.pack)).toEqual(["shapes"]);
    expect(new Set(sets[0]!.rules.templates.map((t) => t.label))).toEqual(new Set(["X", "O"]));
  });

  it("a broken symbol block is skipped, not trusted", () => {
    expect(parseSymbolRules({ points: 32, threshold: 0.4, templates: [] })).toBeUndefined();
    expect(
      parseSymbolRules({
        points: 4,
        threshold: 0.4,
        templates: [{ label: "X", strokes: [[[0, 0]]] }],
      }),
    ).toBeUndefined();
  });
});

describe("reading X and O", () => {
  it("two crossed strokes are an X by the cross rule, and also by $P alone", () => {
    const x = [line([0, 0], [60, 60]), line([60, 0], [0, 60])];
    expect(recognizer.recognize(x)).toMatchObject({ label: "X", via: "cross", pack: "shapes" });
    expect(pOnly.recognize(x)).toMatchObject({ label: "X", via: "$P" });
  });

  it("an X drawn in the other order or direction is still an X ($P is blind to both)", () => {
    expect(pOnly.recognize([line([0, 60], [60, 0]), line([60, 60], [0, 0])]).label).toBe("X");
  });

  it("a round stroke is an O, clockwise or not, round or oval", () => {
    expect(recognizer.recognize([ring(50, 50, 30, 30)])).toMatchObject({ label: "O", via: "$P" });
    expect(recognizer.recognize([ring(50, 50, 30, 30, Math.PI / 2, -1)]).label).toBe("O");
    expect(recognizer.recognize([ring(50, 50, 40, 22)]).label).toBe("O");
  });

  it("one straight line can't be an X: a drawing never matches a template with more strokes", () => {
    expect(pOnly.recognize([line([0, 0], [60, 60])]).label).not.toBe("X");
  });

  it("gives a score and the runner-up; a one-stroke O has none, since X needs two strokes", () => {
    const o = recognizer.recognize([ring(50, 50, 30, 30)]);
    expect(o.score).toBeGreaterThan(0.45);
    expect(o.alternatives).toEqual([]);
    const x = pOnly.recognize([line([0, 0], [60, 60]), line([60, 0], [0, 60])]);
    expect(x.alternatives.map((a) => a.label)).toEqual(["O"]);
  });

  it("a scribble scores under the threshold and reads as '?'", () => {
    const zigzag: Point2[] = Array.from({ length: 30 }, (_, i) => [i * 4, i % 2 ? 0 : 50]);
    expect(pOnly.recognize([zigzag]).label).toBe("?");
  });
});
