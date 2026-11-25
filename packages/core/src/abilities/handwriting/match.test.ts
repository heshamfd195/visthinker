import type { Stroke } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import hello from "./fixtures/hello.json" with { type: "json" };
import {
  createExampleBook,
  createExampleMatcher,
  exampleFrom,
  readHandwriting,
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

describe("the fast matcher (D118 · D174)", () => {
  it("knows nothing before you teach it", () => {
    const matcher = createExampleMatcher(createExampleBook());
    expect(matcher.match(writing("first"))).toBeUndefined();
  });

  it("reads your four HELLOs, each taught by the other three: 19 of 20 letters sure, none wrong", () => {
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
    expect(sure).toHaveLength(19);
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
      // Each a slightly stretched copy of a real letter, so the prefilter lets most through.
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
    const start = Date.now();
    for (let i = 0; i < 20; i++) for (const l of word) matcher.match(l.strokes, l.features);
    const each = (Date.now() - start) / (20 * word.length);
    expect(each).toBeLessThan(10);
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
