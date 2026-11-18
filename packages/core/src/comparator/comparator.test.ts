import { SceneObject, type Point2, type Stroke } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import { createManualClock } from "../ports/index.ts";
import { createSceneStore, createStory, createStrokeStore, recordStroke } from "../scene/index.ts";
import {
  classifyShape,
  createComparator,
  crossRule,
  fitLine,
  INSTANT_LINE_LENGTH,
} from "./index.ts";

/** A hand-ish stroke along a path: points every few units, with a small wobble. */
function along(path: Point2[], step = 6, wobble = 0.8): Point2[] {
  const out: Point2[] = [];
  for (let k = 0; k + 1 < path.length; k++) {
    const [a, b] = [path[k]!, path[k + 1]!];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      out.push([
        a[0] + (b[0] - a[0]) * t + wobble * Math.sin(out.length),
        a[1] + (b[1] - a[1]) * t + wobble * Math.cos(out.length),
      ]);
    }
  }
  out.push(path.at(-1)!);
  return out;
}

let n = 0;
const stroke = (pts: Point2[]): Stroke => ({
  id: `s${++n}`,
  t0: 0,
  tool: "pen",
  color: "#222",
  width: 4,
  points: pts.map(([x, y], i) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10, 0.5, i * 8]),
});

const ellipse = (cx: number, cy: number, rx: number, ry: number): Point2[] =>
  Array.from({ length: 49 }, (_, i) => [
    cx + rx * Math.cos((i / 48) * 2 * Math.PI),
    cy + ry * Math.sin((i / 48) * 2 * Math.PI),
  ]);

describe("lines (D89 · D109)", () => {
  it("a long straight stroke is a line; a curve, a scribble or a dot isn't", () => {
    expect(
      fitLine(
        stroke(
          along([
            [0, 0],
            [500, 10],
          ]),
        ),
      ).line,
    ).toBe(true);
    expect(fitLine(stroke(ellipse(250, 250, 200, 200).slice(0, 20))).line).toBe(false);
    expect(
      fitLine(
        stroke(
          along([
            [0, 0],
            [300, 0],
            [0, 4],
            [300, 8],
          ]),
        ),
      ).line,
    ).toBe(false);
    expect(
      fitLine(
        stroke([
          [0, 0],
          [5, 5],
        ]),
      ).line,
    ).toBe(false);
  });
});

describe("one-stroke shapes", () => {
  it("a closed round stroke is a circle, wide or tall", () => {
    expect(classifyShape(stroke(ellipse(100, 100, 60, 60))).kind).toBe("circle");
    expect(classifyShape(stroke(ellipse(100, 100, 90, 40))).kind).toBe("circle");
  });

  it("a closed stroke with four square corners is a box", () => {
    expect(
      classifyShape(
        stroke(
          along([
            [0, 0],
            [200, 0],
            [200, 120],
            [0, 120],
            [0, 2],
          ]),
        ),
      ).kind,
    ).toBe("box");
  });

  it("a shaft with a head turning back at its far end is an arrow, from its start to its tip", () => {
    const verdict = classifyShape(
      stroke(
        along([
          [0, 100],
          [300, 100],
          [260, 75],
          [300, 100],
          [260, 125],
        ]),
      ),
    );
    expect(verdict).toMatchObject({ kind: "arrow", a: [expect.any(Number), expect.any(Number)] });
    if (verdict.kind === "arrow") expect(verdict.b[0]).toBeGreaterThan(290);
  });

  it("a plain open curve, or a closed triangle, is nothing yet", () => {
    expect(classifyShape(stroke(ellipse(100, 100, 60, 60).slice(0, 25))).kind).toBeNull();
    expect(
      classifyShape(
        stroke(
          along([
            [0, 0],
            [200, 0],
            [100, 170],
            [0, 2],
          ]),
        ),
      ).kind,
    ).toBeNull();
    expect(
      classifyShape(
        stroke(
          along([
            [0, 0],
            [8, 8],
          ]),
        ),
      ).kind,
    ).toBeNull();
  });
});

describe("the cross rule", () => {
  it("two short strokes crossing in the middle are an X; meeting at an end isn't", () => {
    expect(
      crossRule([
        along([
          [0, 0],
          [60, 60],
        ]),
        along([
          [60, 0],
          [0, 60],
        ]),
      ])?.score,
    ).toBeGreaterThan(0.8);
    expect(
      crossRule([
        along([
          [0, 0],
          [30, 60],
        ]),
        along([
          [60, 0],
          [30, 60],
        ]),
      ]),
    ).toBeUndefined();
  });
});

function play(strokes: Stroke[]) {
  const story = createStory(createManualClock());
  const scene = createSceneStore();
  const strokesStore = createStrokeStore();
  const comparator = createComparator({ scene, story });
  for (const s of strokes) comparator.onStroke(s, recordStroke(story, strokesStore, s));
  return { story, scene, comparator };
}

/** A # drawn big enough for D109: two lines down, two across, each 500 long. */
const grid = () => [
  stroke(
    along([
      [150, 0],
      [152, 500],
    ]),
  ),
  stroke(
    along([
      [300, 0],
      [298, 500],
    ]),
  ),
  stroke(
    along([
      [0, 170],
      [500, 168],
    ]),
  ),
  stroke(
    along([
      [0, 330],
      [500, 332],
    ]),
  ),
];

describe("the comparator (D64)", () => {
  it("a big # gives 4 lines and 4 crossings, each a recognized event caused by its stroke", () => {
    const { scene, story } = play(grid());
    const kinds = scene.all().map((o) => o.kind);
    expect(kinds.filter((k) => k === "line")).toHaveLength(4);
    expect(kinds.filter((k) => k === "crossing")).toHaveLength(4);
    for (const o of scene.all()) expect(SceneObject.parse(o)).toEqual(o);
    const recognizedLines = story
      .all()
      .filter((e) => e.type === "recognized" && e.detail?.["kind"] === "line");
    expect(recognizedLines.map((e) => story.get(e.cause!)?.type)).toEqual([
      "stroke",
      "stroke",
      "stroke",
      "stroke",
    ]);
    const x = scene.all().find((o) => o.kind === "crossing")!;
    expect(x.relations.filter((r) => r.type === "on")).toHaveLength(2);
  });

  it(`a straight stroke shorter than ${INSTANT_LINE_LENGTH} isn't a line at once (D109)`, () => {
    const { scene } = play([
      stroke(
        along([
          [0, 0],
          [200, 0],
        ]),
      ),
    ]);
    expect(scene.all()).toEqual([]);
  });

  it("a drawn circle, box and arrow become shapes objects owned by the user", () => {
    const { scene } = play([
      stroke(ellipse(700, 100, 50, 50)),
      stroke(
        along([
          [600, 300],
          [800, 300],
          [800, 400],
          [600, 400],
          [600, 302],
        ]),
      ),
      stroke(
        along([
          [600, 600],
          [900, 600],
          [860, 575],
          [900, 600],
          [860, 625],
        ]),
      ),
    ]);
    expect(scene.all().map((o) => [o.kind, o.pack])).toEqual([
      ["circle", "shapes"],
      ["box", "shapes"],
      ["arrow", "shapes"],
    ]);
    expect(scene.owner(scene.all()[0]!.id)).toBe("user");
  });

  it("knows what each stroke made, crossings included (for undo)", () => {
    const strokes = grid();
    const { comparator, scene } = play(strokes);
    const made = comparator.madeFrom(strokes[0]!.id);
    expect(made[0]).toMatch(/^l/);
    expect(made.filter((id) => scene.get(id)?.kind === "crossing")).toHaveLength(2);
  });
});

describe("replay (moved from T08)", () => {
  it("the same strokes give the same story and the same scene", () => {
    const strokes = [...grid(), stroke(ellipse(700, 100, 50, 50))];
    const first = play(strokes);
    const again = play(strokes);
    const shape = (e: {
      seq: number;
      who: string;
      type: string;
      target?: string;
      cause?: number;
    }) => [e.seq, e.who, e.type, e.target, e.cause];
    expect(again.story.all().map(shape)).toEqual(first.story.all().map(shape));
    expect(again.scene.all()).toEqual(first.scene.all());
  });
});
