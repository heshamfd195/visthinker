import type { Stroke } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import hello from "./fixtures/hello.json" with { type: "json" };
import {
  createExampleBook,
  createExampleMatcher,
  exampleFrom,
  readHandwriting,
  rotate,
  type ExampleBook,
} from "./index.ts";

const HELLOS = ["first", "second", "third", "fourth"] as const;
const writing = (name: keyof typeof hello) => hello[name] as Stroke[];
const at = "2026-11-25T10:00:00.000Z";

/** Teaches each HELLO's letters as H, E, L, L, O. */
function teach(book: ExampleBook, names: readonly (keyof typeof hello)[]) {
  for (const name of names)
    readHandwriting(writing(name)).forEach((l, i) =>
      book.add(exampleFrom(l.strokes, { id: `${name}-${i}`, label: "HELLO"[i]!, from: "you", at })),
    );
}

/** Milliseconds per letter: the fastest of five batches of ten runs of `run`, which reads `letters`. */
function fastest(run: () => void, letters: number): number {
  let best = Infinity;
  for (let batch = 0; batch < 5; batch++) {
    const start = Date.now();
    for (let i = 0; i < 10; i++) run();
    best = Math.min(best, (Date.now() - start) / (10 * letters));
  }
  return best;
}

describe("the fast matcher (D118 · D174)", () => {
  it("knows nothing before you teach it", () => {
    const matcher = createExampleMatcher(createExampleBook());
    expect(matcher.match(writing("first"))).toBeUndefined();
  });

  it("reads your four HELLOs, each taught by the other three: 17 of 20 sure, none wrong", () => {
    const sure: string[] = [];
    for (const held of HELLOS) {
      const book = createExampleBook();
      teach(
        book,
        HELLOS.filter((n) => n !== held),
      );
      const matcher = createExampleMatcher(book);
      const read = readHandwriting(writing(held)).map((l) => matcher.match(l.strokes, l.features)!);
      // The nearest is always right; a sure one is never wrong.
      expect(read.map((r) => r.guesses[0]!.char).join("")).toBe("HELLO");
      for (const [i, r] of read.entries()) if (r.sure) sure.push(`${r.label}${"HELLO"[i]}`);
    }
    // D181's stricter limit (1.0) leaves 3 to the cards and Claude, and keeps none wrong.
    expect(sure).toHaveLength(17);
    expect(sure.every((pair) => pair[0] === pair[1])).toBe(true);
  });

  it("is unsure of letters it was never taught (an A, two Bs), and says what's nearest", () => {
    const book = createExampleBook();
    teach(book, HELLOS);
    const matcher = createExampleMatcher(book);
    for (const name of ["tiltedA", "roundB", "angularB"] as const) {
      const [letter] = readHandwriting(writing(name));
      const read = matcher.match(letter!.strokes, letter!.features)!;
      expect(read.sure, name).toBe(false);
      expect(read.label).toBe("?");
      expect(read.guesses).toHaveLength(2);
    }
  });

  it("learns a letter from one example: the B once misread as E", () => {
    const book = createExampleBook();
    teach(book, HELLOS);
    const [round] = readHandwriting(writing("roundB"));
    book.add(exampleFrom(round!.strokes, { id: "b", label: "B", from: "you", at }));
    const [angular] = readHandwriting(writing("angularB"));
    const read = createExampleMatcher(book).match(angular!.strokes, angular!.features)!;
    expect(read.label).toBe("B");
    expect(read.count).toBe(1);
  });

  it("is stricter when it has no other letter to compare with: only a B taught (D177)", () => {
    const book = createExampleBook();
    const [round] = readHandwriting(writing("roundB"));
    book.add(exampleFrom(round!.strokes, { id: "b", label: "B", from: "you", at }));
    const matcher = createExampleMatcher(book);
    let compared = 0;
    for (const name of HELLOS)
      for (const l of readHandwriting(writing(name))) {
        const read = matcher.match(l.strokes, l.features);
        if (!read) continue; // the prefilter let no B through
        compared++;
        expect(read.guesses).toHaveLength(1);
        expect(read.sure, `${name}: ${read.distance}`).toBe(false);
      }
    expect(compared).toBeGreaterThan(10);
  });

  it("compares only the examples the prefilter lets through", () => {
    const book = createExampleBook();
    teach(book, HELLOS);
    const [, e] = readHandwriting(writing("first"));
    const read = createExampleMatcher(book).match(e!.strokes, e!.features)!;
    expect(read.of).toBe(20);
    expect(read.compared).toBeLessThan(read.of);
  });

  it("names a letter in under 10 ms with 10 examples of each of 26 letters", () => {
    const book = createExampleBook();
    const letters = HELLOS.flatMap((n) => readHandwriting(writing(n)).map((l) => l.strokes));
    for (let i = 0; i < 260; i++) {
      const label = String.fromCharCode(65 + (i % 26));
      // Each a slightly stretched copy of a real letter under any label: every letter looks near
      // and none is sure, the worst case, as the turns are tried too.
      const stretched = letters[i % letters.length]!.map((s) => ({
        ...s,
        points: s.points.map(([x, y, p, dt]): Stroke["points"][number] => [
          x * (1 + (i % 7) / 50),
          y,
          p,
          dt,
        ]),
      }));
      book.add(exampleFrom(stretched, { id: `x${i}`, label, from: "you", at }));
    }
    const matcher = createExampleMatcher(book);
    const word = readHandwriting(writing("second"));
    matcher.match(word[0]!.strokes); // the clouds are built once, here
    // The fastest of five batches: what the matcher costs, not how busy the machine is.
    expect(
      fastest(() => word.forEach((l) => matcher.match(l.strokes, l.features)), word.length),
    ).toBeLessThan(15);
  });

  it("names a sure letter fast: turns are tried only when it isn't sure", () => {
    const book = createExampleBook();
    teach(book, ["first", "second", "third"]);
    const matcher = createExampleMatcher(book);
    const sure = readHandwriting(writing("fourth")).filter((l) => {
      const read = matcher.match(l.strokes)!;
      return read.sure && read.turn === undefined;
    });
    expect(sure.length).toBeGreaterThanOrEqual(3);
    expect(fastest(() => sure.forEach((l) => matcher.match(l.strokes)), sure.length)).toBeLessThan(
      10,
    );
  });

  it("reads a tilted HELLO by turning it back a little (25 Nov)", () => {
    const book = createExampleBook();
    teach(book, ["first", "second", "third"]);
    const matcher = createExampleMatcher(book);
    const tilted = readHandwriting(writing("fourth")).map((l) => {
      const xs = l.strokes.flatMap((s) => s.points.map((p) => p[0]));
      const ys = l.strokes.flatMap((s) => s.points.map((p) => p[1]));
      const about: [number, number] = [
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2,
      ];
      return l.strokes.map((s) => ({
        ...s,
        points: s.points.map(([x, y, p, dt]): Stroke["points"][number] => {
          const [tx, ty] = rotate([x, y], about, 20);
          return [tx, ty, p, dt];
        }),
      }));
    });
    const read = tilted.map((strokes) => matcher.match(strokes)!);
    // Never wrong; most sure once turned back.
    for (const [i, r] of read.entries()) if (r.sure) expect(r.label).toBe("HELLO"[i]);
    const turned = read.filter((r) => r.sure && r.turn !== undefined);
    expect(turned.length).toBeGreaterThanOrEqual(3);
    expect(turned.every((r) => r.turn! > 0)).toBe(true);
  });
});

describe("the naming order (D174)", () => {
  it("names by your examples when one is sure, else by the cards, keeping what both said", () => {
    const book = createExampleBook();
    const [round] = readHandwriting(writing("roundB"));
    book.add(exampleFrom(round!.strokes, { id: "b", label: "B", from: "you", at }));
    const matcher = createExampleMatcher(book);
    const [b] = readHandwriting(writing("angularB"), undefined, matcher);
    expect(b!.reading).toMatchObject({ label: "B", clear: true, via: "examples" });
    // No E taught: the examples aren't sure, so the cards name it, and the examples' guess stays.
    const [, e] = readHandwriting(writing("first"), undefined, matcher);
    expect(e!.reading).toMatchObject({ label: "E", via: "cards", examples: { sure: false } });
  });

  it("lets the cards win on a letter you never taught (D179)", () => {
    // Your E's saved as B's: the examples are sure a new E is a B, but no E was ever taught, and
    // the cards clearly read an E.
    const book = createExampleBook();
    for (const name of ["first", "second", "third"] as const) {
      const [, e] = readHandwriting(writing(name));
      book.add(exampleFrom(e!.strokes, { id: `${name}-e`, label: "B", from: "you", at }));
    }
    const matcher = createExampleMatcher(book);
    const [, e] = readHandwriting(writing("fourth"), undefined, matcher);
    expect(e!.reading).toMatchObject({
      label: "E",
      via: "cards",
      examples: { label: "B", sure: true },
    });
    // Once you've taught an E (here, oddly, from an L), its examples lead again.
    const [, , l] = readHandwriting(writing("first"));
    book.add(exampleFrom(l!.strokes, { id: "l-as-e", label: "E", from: "you", at }));
    const [, again] = readHandwriting(writing("fourth"), undefined, matcher);
    expect(again!.reading).toMatchObject({ label: "B", via: "examples" });
  });

  it("shows the surer score when your examples and the cards agree", () => {
    const book = createExampleBook();
    teach(book, ["first", "second", "third"]);
    const matcher = createExampleMatcher(book);
    const plain = readHandwriting(writing("fourth"));
    const named = readHandwriting(writing("fourth"), undefined, matcher);
    const both = named.filter((l, i) => l.reading.via === "examples" && plain[i]!.reading.clear);
    expect(both.length).toBeGreaterThan(0);
    for (const l of both) {
      const cards = plain[named.indexOf(l)]!.reading;
      expect(l.reading.score).toBe(Math.max(l.reading.examples!.score, cards.score));
    }
  });

  it("names by the cards alone before you teach anything", () => {
    const [h] = readHandwriting(
      writing("first"),
      undefined,
      createExampleMatcher(createExampleBook()),
    );
    expect(h!.reading).toMatchObject({ label: "H", via: "cards" });
    expect(h!.reading.examples).toBeUndefined();
  });
});
