import {
  LetterEventDetail,
  NOT_A_LETTER,
  SceneObject,
  WordReading,
  type LetterReading,
  type Point2,
  type TaughtDetail,
  type Stroke,
} from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import hello from "../abilities/handwriting/fixtures/hello.json" with { type: "json" };
import {
  createExampleBook,
  exampleFrom,
  readHandwriting,
  type ExampleBook,
} from "../abilities/handwriting/index.ts";
import { STARTER_PACKS } from "../packs/index.ts";
import { createManualClock } from "../ports/index.ts";
import { createSceneStore, createStory, createStrokeStore, recordStroke } from "../scene/index.ts";
import {
  classifyShape,
  createComparator,
  crossRule,
  fitLine,
  GROUP_MS,
  INSTANT_LINE_LENGTH,
  SETTLE_MS,
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
  const clock = createManualClock();
  const story = createStory(clock);
  const scene = createSceneStore();
  const strokesStore = createStrokeStore();
  const comparator = createComparator({
    scene,
    story,
    strokes: strokesStore,
    clock,
    packs: () => STARTER_PACKS,
  });
  // Each stroke a second apart, so none of them group with the one before.
  for (const s of strokes) {
    comparator.onStroke(s, recordStroke(story, strokesStore, s));
    clock.advance(1_000);
  }
  return { story, scene, comparator, clock, strokesStore };
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

  it(`a straight stroke shorter than ${INSTANT_LINE_LENGTH} isn't a line at once (D109): it's read as a symbol`, () => {
    const { scene } = play([
      stroke(
        along([
          [0, 0],
          [200, 0],
        ]),
      ),
    ]);
    expect(scene.all().map((o) => o.kind)).toEqual(["symbol"]);
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

describe("grouping (D96 · D97)", () => {
  function setup(options: { handwriting?: boolean; examples?: ExampleBook } = {}) {
    const clock = createManualClock();
    const story = createStory(clock);
    const scene = createSceneStore();
    const strokesStore = createStrokeStore();
    const comparator = createComparator({
      scene,
      story,
      strokes: strokesStore,
      clock,
      packs: () => STARTER_PACKS,
      ...options,
    });
    /** Draws a stroke that starts now and takes 80 ms. */
    const draw = (pts: Point2[]) => {
      const s = { ...stroke(pts), t0: clock.now() };
      s.points = s.points.map(([x, y, p], i, all) => [
        x,
        y,
        p,
        Math.round((80 * i) / Math.max(1, all.length - 1)),
      ]);
      comparator.onStroke(s, recordStroke(story, strokesStore, s));
      clock.advance(80);
      return s;
    };
    /** Feeds a saved stroke when it ended, as the canvas does when you lift the pen. */
    const replay = (saved: Stroke) => {
      const end = saved.t0 + (saved.points.at(-1)?.[3] ?? 0);
      clock.advance(Math.max(0, end - clock.now()));
      comparator.onStroke(saved, recordStroke(story, strokesStore, saved));
    };
    return { clock, story, scene, comparator, draw, replay };
  }

  it("two quick strokes close together are one group, read as an X 0.6 s after the last one", () => {
    const { clock, scene, story, draw } = setup();
    draw(
      along([
        [0, 0],
        [60, 60],
      ]),
    );
    clock.advance(200);
    const second = draw(
      along([
        [60, 0],
        [0, 60],
      ]),
    );
    clock.advance(500);
    expect(scene.all()).toEqual([]);
    clock.advance(100);
    const symbol = scene.all()[0]!;
    expect(symbol).toMatchObject({
      kind: "symbol",
      label: "X",
      strokes: [expect.any(String), second.id],
    });
    const event = story.all().findLast((e) => e.type === "recognized")!;
    expect(event).toMatchObject({
      type: "recognized",
      target: symbol.id,
      detail: { kind: "symbol", label: "X" },
    });
    expect(story.get(event.cause!)?.target).toBe(second.id);
    expect(symbol.confidence).toBeGreaterThan(0.6);
  });

  it("the handwriting ability adds a letter event per letter, caused by the word's reading (T51)", () => {
    const { clock, scene, story, draw } = setup();
    const first = draw(
      along([
        [0, 0],
        [0, 100],
        [55, 100],
      ]),
    );
    clock.advance(200);
    const second = draw(
      along([
        [80, -20],
        [80, 80],
        [135, 80],
      ]),
    );
    clock.advance(600);
    const word = scene.all()[0]!;
    const reading = story.all().findLast((e) => e.type === "recognized")!;
    const letters = story.all().filter((e) => e.type === "letter");
    expect(letters.map((e) => [e.target, e.cause, e.detail?.["index"], e.detail?.["of"]])).toEqual([
      [word.id, reading.seq, 1, 2],
      [word.id, reading.seq, 2, 2],
    ]);
    expect(letters.map((e) => LetterEventDetail.parse(e.detail).strokes)).toEqual([
      [first.id],
      [second.id],
    ]);
    expect(LetterEventDetail.parse(letters[0]!.detail).features.parts).toHaveLength(2);
  });

  it("a wide H whose legs are read apart comes back together when its bar joins them (D110)", () => {
    const { clock, scene, story, draw } = setup();
    const left = draw(
      along([
        [0, 0],
        [0, 120],
      ]),
    );
    clock.advance(200);
    // 70 apart: further than half the letter's height, so the right leg starts a new group.
    const right = draw(
      along([
        [70, 0],
        [70, 120],
      ]),
    );
    clock.advance(200);
    const bar = draw(
      along([
        [-2, 60],
        [72, 60],
      ]),
    );
    clock.advance(SETTLE_MS);
    const words = scene.all().filter((o) => o.kind === "word" || o.kind === "symbol");
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ kind: "word", label: "H" });
    expect(words[0]!.strokes).toEqual([left.id, right.id, bar.id]);
    const named = story.all().findLast((e) => e.type === "letter" && e.detail?.["reading"])!;
    expect(LetterEventDetail.parse(named.detail)).toMatchObject({
      strokes: [left.id, right.id, bar.id],
      reading: { label: "H", clear: true },
    });
  });

  it("a slow H: each leg already read on its own, the bar merges both into one word (D110)", () => {
    const { clock, scene, story, draw } = setup();
    const left = draw(
      along([
        [0, 0],
        [0, 120],
      ]),
    );
    clock.advance(700);
    const right = draw(
      along([
        [70, 0],
        [70, 120],
      ]),
    );
    clock.advance(700);
    expect(scene.all().filter((o) => o.kind === "symbol")).toHaveLength(2);
    const [first, second] = scene.all().filter((o) => o.kind === "symbol");
    const bar = draw(
      along([
        [-2, 60],
        [72, 60],
      ]),
    );
    clock.advance(SETTLE_MS);
    const words = scene.all().filter((o) => o.kind === "word" || o.kind === "symbol");
    expect(words.map((o) => [o.id, o.kind, o.label, o.strokes])).toEqual([
      [first!.id, "word", "H", [left.id, right.id, bar.id]],
    ]);
    expect(story.all().find((e) => e.type === "remove")).toMatchObject({
      who: "fastbrain",
      type: "remove",
      target: second!.id,
      detail: { into: first!.id },
    });
  });

  it("two or more letters are a written word: no X or O guess, its letters listed (T51)", () => {
    const { clock, scene, story, draw } = setup();
    const first = draw(
      along([
        [0, 0],
        [0, 100],
        [55, 100],
      ]),
    );
    const second = draw(
      along([
        [80, -20],
        [80, 80],
        [135, 80],
      ]),
    );
    clock.advance(SETTLE_MS);
    const [word] = scene.all();
    expect(word).toMatchObject({ kind: "word", label: "LL", pack: "handwriting" });
    const reading = story.all().findLast((e) => e.type === "recognized")!;
    expect(WordReading.parse(reading.detail)).toEqual({
      kind: "word",
      letters: [[first.id], [second.id]],
      text: "LL",
    });
    expect(reading.detail).not.toHaveProperty("alternatives");
    const named = story.all().filter((e) => e.type === "letter" && e.detail?.["reading"]);
    expect(named.map((e) => LetterEventDetail.parse(e.detail).reading)).toMatchObject([
      { label: "L", clear: true },
      { label: "L", clear: true },
    ]);
  });

  it("the letter you're still writing waits for its name until you pause (no flash of a wrong one)", () => {
    const { clock, scene, story, draw } = setup();
    draw(
      along([
        [0, 0],
        [0, 100],
        [55, 100],
      ]),
    ); // an L
    clock.advance(800);
    // An E's back and two bars: on their own they would read L.
    draw(
      along([
        [90, 0],
        [90, 100],
      ]),
    );
    draw(
      along([
        [90, 0],
        [140, 0],
      ]),
    );
    draw(
      along([
        [90, 100],
        [140, 100],
      ]),
    );
    clock.advance(700);
    expect(scene.all()[0]).toMatchObject({ kind: "word", label: "L…" });
    const waiting = story.all().findLast((e) => e.type === "letter")!;
    expect(LetterEventDetail.parse(waiting.detail)).toMatchObject({ index: 2, waiting: true });
    expect(waiting.detail).not.toHaveProperty("reading");
    draw(
      along([
        [90, 50],
        [130, 50],
      ]),
    ); // the middle bar, before the pause
    clock.advance(SETTLE_MS);
    expect(scene.all()[0]).toMatchObject({ label: "LE" });
    const names = story
      .all()
      .filter((e) => e.type === "letter" && e.detail?.["reading"])
      .map((e) => LetterEventDetail.parse(e.detail).reading!.label);
    expect(names).toEqual(["L", "E"]);
  });

  it("a written word waits 5 s for its next letter beside it, not 2 (D169)", () => {
    const { clock, scene, draw } = setup();
    draw(
      along([
        [0, 0],
        [0, 100],
        [55, 100],
      ]),
    );
    clock.advance(3_000); // a long pause after the first letter
    draw(
      along([
        [80, 0],
        [80, 100],
        [135, 100],
      ]),
    );
    clock.advance(SETTLE_MS);
    expect(scene.all().map((o) => [o.kind, o.label])).toEqual([["word", "LL"]]);
  });

  it("your fourth HELLO, replayed with its real timing, is one word: HELLO (D169)", () => {
    const { clock, scene, replay } = setup();
    // A 2.4 s pause after the H once split it from ELLO; its O is drawn with four straight sides.
    for (const stroke of hello.fourth as Stroke[]) replay(stroke);
    clock.advance(SETTLE_MS);
    expect(scene.all().map((o) => [o.kind, o.label])).toEqual([["word", "HELLO"]]);
  });

  it("names each letter of your fourth HELLO by your examples from the other three (D174)", () => {
    const examples = createExampleBook();
    for (const name of ["first", "second", "third"] as const)
      readHandwriting(hello[name] as Stroke[]).forEach((l, i) =>
        examples.add(
          exampleFrom(l.strokes, {
            id: `${name}-${i}`,
            label: "HELLO"[i]!,
            from: "you",
            at: "now",
          }),
        ),
      );
    const { clock, scene, story, replay } = setup({ examples });
    for (const stroke of hello.fourth as Stroke[]) replay(stroke);
    clock.advance(SETTLE_MS);
    expect(scene.all().map((o) => [o.kind, o.label])).toEqual([["word", "HELLO"]]);
    const named = story
      .all()
      .filter((e) => e.type === "letter" && e.detail?.["reading"])
      .map((e) => e.detail!["reading"] as LetterReading);
    expect(named.slice(-5).map((r) => `${r.label} ${r.via}`)).toEqual(
      ["H", "E", "L", "L", "O"].map((c) => `${c} examples`),
    );
    expect(named.at(-1)!.examples).toMatchObject({ sure: true, count: 3, of: 15 });
  });

  it("saves each letter of a word Claude labels as an example, then reads the next by it (D175)", () => {
    const examples = createExampleBook();
    const { clock, scene, story, replay } = setup({ examples });
    for (const stroke of hello.first as Stroke[]) replay(stroke);
    clock.advance(SETTLE_MS);
    const word = scene.all()[0]!;
    // You said "it's HELLO" in the chat, and Claude labelled the word (act → label).
    const label = story.append({
      who: "fastbrain",
      type: "label",
      target: word.id,
      detail: { text: "HELLO", by: "claude" },
    });
    clock.advance(0);
    expect(examples.all().map((e) => `${e.label} ${e.from}`)).toEqual(
      ["H", "E", "L", "L", "O"].map((c) => `${c} claude`),
    );
    const taught = story.all().find((e) => e.type === "taught")!;
    expect(taught).toMatchObject({ target: word.id, cause: label.seq });
    expect((taught.detail as TaughtDetail).examples).toHaveLength(5);
    const named = story
      .all()
      .filter((e) => e.type === "letter" && e.cause === taught.seq)
      .map((e) => (e.detail as LetterEventDetail).reading!);
    expect(named.map((r) => `${r.label} ${r.via}`).join(" ")).toBe(
      "H claude E claude L claude L claude O claude",
    );

    // Your third HELLO, written later. With one example each, only some letters are close enough
    // to be sure (its L's, its O turned back 10°); the cards name the rest, and it reads HELLO.
    for (const stroke of hello.third as Stroke[]) replay(stroke);
    clock.advance(SETTLE_MS);
    const next = story
      .all()
      .filter(
        (e) =>
          e.type === "letter" && e.target !== word.id && (e.detail as LetterEventDetail).reading,
      )
      .map((e) => (e.detail as LetterEventDetail).reading!);
    const third = scene.all().find((o) => o.id !== word.id)!;
    expect(third.label).toBe("HELLO");
    const byExamples = next.filter((r) => r.via === "examples").map((r) => r.label);
    expect(byExamples).toContain("L");
    expect(byExamples.every((c) => "HELO".includes(c))).toBe(true);
  });

  it("a tilted lone letter Claude names keeps its turn on the taught letter (D175)", () => {
    const examples = createExampleBook();
    const { clock, scene, story, replay } = setup({ examples });
    for (const stroke of hello.tiltedA as Stroke[]) replay(stroke);
    clock.advance(SETTLE_MS);
    const read = story.all().findLast((e) => e.type === "letter")!.detail as LetterEventDetail;
    expect(read.turn).toBeDefined();
    story.append({
      who: "fastbrain",
      type: "label",
      target: scene.all()[0]!.id,
      detail: { text: "A", by: "claude" },
    });
    clock.advance(0);
    const taught = story.all().at(-1)!;
    expect(taught.type).toBe("letter");
    expect((taught.detail as LetterEventDetail).turn).toEqual(read.turn);
    expect((taught.detail as LetterEventDetail).features).toEqual(read.features);
  });

  it("a mark you call not a letter is left out of words from then on (D182)", () => {
    const examples = createExampleBook();
    const { clock, scene, story, draw } = setup({ examples });
    const mark = (x: number) =>
      draw(
        along([
          [x, 0],
          [x, 100],
          [x + 55, 100],
        ]),
      );
    // An L the cards read clearly; you say it isn't a letter.
    mark(0);
    clock.advance(SETTLE_MS);
    expect(scene.all()[0]).toMatchObject({ kind: "word", label: "L" });
    story.append({
      who: "fastbrain",
      type: "label",
      target: scene.all()[0]!.id,
      detail: { text: "not a letter", by: "claude" },
    });
    clock.advance(0);
    expect(examples.all().map((e) => e.label)).toEqual([NOT_A_LETTER]);
    // The next one like it is a plain mark, even though the cards read L: your word stands.
    clock.advance(10_000);
    mark(400);
    clock.advance(SETTLE_MS);
    const next = scene.all().at(-1)!;
    expect(next.kind).toBe("symbol");
    const reading = story.all().findLast((e) => e.type === "letter")!.detail as LetterEventDetail;
    expect(reading.reading).toMatchObject({ label: NOT_A_LETTER, via: "examples" });
  });

  it("a Q's tail joins its circle; an arrow drawn up to a circle doesn't (D183)", () => {
    const { clock, scene, draw } = setup({ examples: createExampleBook() });
    draw(ellipse(100, 100, 60, 60));
    clock.advance(GROUP_MS + 200);
    expect(scene.all().map((o) => o.kind)).toEqual(["circle"]);
    // The tail, from inside the circle out past its edge, a second later.
    clock.advance(1_000);
    draw(
      along([
        [120, 120],
        [175, 175],
      ]),
    );
    clock.advance(SETTLE_MS);
    expect(scene.all()).toHaveLength(1);
    expect(scene.all()[0]!.kind).not.toBe("circle");
    expect(scene.all()[0]!.strokes).toHaveLength(2);

    const other = setup({ examples: createExampleBook() });
    other.draw(ellipse(100, 100, 60, 60));
    other.clock.advance(GROUP_MS + 1_000);
    // An arrow from far away up to the circle's edge: bigger than a tail, and mostly outside it.
    other.draw(
      along([
        [400, 100],
        [165, 100],
        [185, 85],
        [165, 100],
        [185, 115],
      ]),
    );
    other.clock.advance(SETTLE_MS);
    expect(other.scene.all().map((o) => o.kind)).toContain("circle");
    expect(other.scene.all()).toHaveLength(2);
  });

  it("a circle you call O is taught, and the next round O is a letter, not a circle (D183)", () => {
    const examples = createExampleBook();
    const { clock, scene, story, draw } = setup({ examples });
    draw(ellipse(100, 100, 40, 50));
    clock.advance(GROUP_MS + 200);
    const circle = scene.all()[0]!;
    expect(circle.kind).toBe("circle");
    story.append({
      who: "fastbrain",
      type: "label",
      target: circle.id,
      detail: { text: "O", by: "claude" },
    });
    clock.advance(0);
    expect(examples.all().map((e) => e.label)).toEqual(["O"]);
    expect(scene.get(circle.id)).toMatchObject({ kind: "word", label: "O" });
    // Later, another round O elsewhere: your example knows it.
    clock.advance(10_000);
    draw(ellipse(500, 100, 42, 52));
    clock.advance(SETTLE_MS);
    expect(scene.all().at(-1)).toMatchObject({ kind: "word", label: "O" });
    // A circle much wider than your O is still a circle.
    clock.advance(10_000);
    draw(ellipse(900, 100, 120, 40));
    clock.advance(SETTLE_MS);
    expect(scene.all().at(-1)!.kind).toBe("circle");
  });

  it("saves nothing when the label doesn't fit the letters, and says why (D175)", () => {
    const examples = createExampleBook();
    const { clock, scene, story, replay } = setup({ examples });
    for (const stroke of hello.first as Stroke[]) replay(stroke);
    clock.advance(SETTLE_MS);
    const word = scene.all()[0]!;
    story.append({
      who: "fastbrain",
      type: "label",
      target: word.id,
      detail: { text: "HELO", by: "claude" },
    });
    clock.advance(0);
    expect(examples.all()).toHaveLength(0);
    expect(story.all().at(-1)).toMatchObject({
      type: "taught",
      detail: { examples: [], skipped: 'the word has 5 letters but "HELO" has 4' },
    });
  });

  it("a lone letter the cards read clearly is a word; a mark they don't know is a symbol", () => {
    const { clock, scene, story, draw } = setup();
    const l = draw(
      along([
        [0, 0],
        [0, 100],
        [55, 100],
      ]),
    );
    clock.advance(SETTLE_MS);
    expect(scene.all()[0]).toMatchObject({ kind: "word", label: "L" });
    expect(story.all().findLast((e) => e.type === "recognized")?.detail).toMatchObject({
      kind: "word",
      letters: [[l.id]],
      text: "L",
    });
    const x = draw(
      along([
        [300, 0],
        [360, 60],
      ]),
    );
    draw(
      along([
        [360, 0],
        [300, 60],
      ]),
    );
    clock.advance(700);
    expect(scene.all()[1]).toMatchObject({ kind: "symbol", label: "X" });
    expect(story.all().findLast((e) => e.type === "recognized")?.detail).toMatchObject({
      kind: "symbol",
      letters: [[x.id, expect.any(String)]],
    });
  });

  it("a word read again sends only letters that are new, changed, or just named", () => {
    const { clock, story, draw } = setup();
    const sent = () =>
      story
        .all()
        .filter((e) => e.type === "letter")
        .map((e) => {
          const d = LetterEventDetail.parse(e.detail);
          return [d.strokes, d.reading?.label ?? "…"];
        });
    const first = draw(
      along([
        [0, 0],
        [0, 100],
        [55, 100],
      ]),
    );
    clock.advance(SETTLE_MS); // read alone, then named
    const second = draw(
      along([
        [80, 0],
        [80, 100],
      ]),
    ); // rejoins: a new letter, waiting
    clock.advance(700);
    expect(sent()).toEqual([
      [[first.id], "…"],
      [[first.id], "L"],
      [[second.id], "…"],
    ]);
    const bar = draw(
      along([
        [78, 100],
        [130, 100],
      ]),
    ); // its foot: the same letter, changed
    clock.advance(SETTLE_MS);
    expect(sent().slice(3)).toEqual([
      [[second.id, bar.id], "…"],
      [[second.id, bar.id], "L"],
    ]);
    const reading = story.all().findLast((e) => e.type === "recognized")!;
    expect(WordReading.parse(reading.detail)).toMatchObject({
      letters: [[first.id], [second.id, bar.id]],
      text: "LL",
    });
  });

  it("with the handwriting ability switched off, a word gets no letter events (D161)", () => {
    const { clock, story, draw } = setup({ handwriting: false });
    draw(
      along([
        [0, 0],
        [0, 100],
        [55, 100],
      ]),
    );
    clock.advance(700);
    expect(story.all().some((e) => e.type === "recognized")).toBe(true);
    expect(story.all().some((e) => e.type === "letter")).toBe(false);
  });

  it("a stroke far away, or much later, starts a new group", () => {
    const { clock, scene, draw } = setup();
    draw(
      along([
        [0, 0],
        [60, 60],
      ]),
    );
    draw(
      along([
        [600, 0],
        [660, 60],
      ]),
    );
    clock.advance(600);
    expect(scene.all().filter((o) => o.kind === "symbol")).toHaveLength(2);
    // Past D176's 5 s (D110's 2 s without handwriting), a stroke never rejoins: a new symbol.
    const later = setup();
    later.draw(
      along([
        [0, 0],
        [60, 60],
      ]),
    );
    later.clock.advance(5_100);
    later.draw(
      along([
        [60, 0],
        [0, 60],
      ]),
    );
    later.clock.advance(600);
    expect(later.scene.all().map((o) => o.label)).not.toContain("X");
  });

  it("a slow H is one letter: a lone leg waits 5 s for the next (D176)", () => {
    // Hesham's H on 25 Nov: the right leg came 2.4 s after the left, the bar 1.2 s after that.
    for (const handwriting of [true, false]) {
      const { clock, scene, replay } = setup({ handwriting });
      const leg = (x: number, t0: number, id: string): Stroke => ({
        ...stroke(
          along([
            [x, 300],
            [x, 520],
          ]),
        ),
        id,
        t0,
      });
      replay(leg(1070, 4395, "h1"));
      replay(leg(1230, 6796, "h2"));
      replay({
        ...stroke(
          along([
            [1032, 410],
            [1250, 410],
          ]),
        ),
        id: "h3",
        t0: 7971,
      });
      clock.advance(SETTLE_MS + 1_000);
      const groups = scene.all().map((o) => o.strokes);
      // Without handwriting, D110's 2 s still holds and the first leg stays apart.
      expect(groups, `handwriting ${handwriting}`).toEqual(
        handwriting ? [["h1", "h2", "h3"]] : [["h1"], ["h2", "h3"]],
      );
      if (handwriting) expect(scene.all()[0]).toMatchObject({ kind: "word", label: "H" });
    }
  });

  it("a grid line ends the open group at once", () => {
    const { scene, draw } = setup();
    draw(
      along([
        [700, 700],
        [740, 740],
      ]),
    );
    draw(
      along([
        [0, 10],
        [500, 12],
      ]),
    );
    expect(scene.all().map((o) => o.kind)).toEqual(["symbol", "line"]);
  });

  it("flush reads the open group now", () => {
    const { scene, comparator, draw } = setup();
    draw(
      along([
        [0, 0],
        [60, 60],
      ]),
    );
    comparator.flush();
    expect(scene.all()).toHaveLength(1);
  });

  it("D110: an X whose second stroke comes 0.9 s late is re-read as one X, same symbol (the first real game)", () => {
    const { clock, scene, story, draw } = setup();
    draw(
      along([
        [0, 0],
        [60, 60],
      ]),
    );
    clock.advance(600); // read alone: "?"
    const first = scene.all().find((o) => o.kind === "symbol")!;
    expect(first.label).not.toBe("X");
    clock.advance(220); // the second stroke starts about 0.9 s after the first ended
    draw(
      along([
        [60, 0],
        [0, 60],
      ]),
    );
    clock.advance(600);
    const symbols = scene.all().filter((o) => o.kind === "symbol");
    expect(symbols).toHaveLength(1);
    expect(symbols[0]).toMatchObject({ id: first.id, label: "X" });
    expect(symbols[0]!.strokes).toHaveLength(2);
    const readings = story.all().filter((e) => e.type === "recognized" && e.target === first.id);
    expect(readings.map((e) => e.detail?.["label"])).toEqual([first.label, "X"]);
  });

  it("D110: a late stroke far away doesn't rejoin", () => {
    const { clock, scene, draw } = setup();
    draw(
      along([
        [0, 0],
        [60, 60],
      ]),
    );
    clock.advance(800);
    draw(
      along([
        [600, 600],
        [540, 660],
      ]),
    );
    clock.advance(600);
    expect(scene.all().filter((o) => o.kind === "symbol")).toHaveLength(2);
  });
});
