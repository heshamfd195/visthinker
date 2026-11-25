import { HandwritingExample, type Stroke } from "@visthinker/contract";
import { describe, expect, it } from "vitest";
import hello from "./fixtures/hello.json" with { type: "json" };
import { createExampleBook, exampleFrom, keepNewest, splitLetters } from "./index.ts";

const at = "2026-11-25T10:00:00.000Z";
const example = (id: string, label: string): HandwritingExample => ({
  id,
  label,
  strokes: [{ t: 0, points: [[0, 0, 0.5, 0]] }],
  from: "you",
  at,
});

describe("your examples (D118 · D174)", () => {
  it("keeps the newest 10 of each letter, in order", () => {
    const many = [
      ...Array.from({ length: 12 }, (_, i) => example(`a${i}`, "A")),
      example("b0", "B"),
    ];
    const kept = keepNewest(many);
    expect(kept.filter((e) => e.label === "A").map((e) => e.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `a${i + 2}`),
    );
    expect(kept.at(-1)!.id).toBe("b0");
  });

  it("tells listeners about each change, and whether it was loaded or added", () => {
    const book = createExampleBook();
    const heard: string[] = [];
    book.subscribe((all, why) => heard.push(`${why} ${all.length}`));
    book.load([example("e1", "A")]);
    book.add(example("e2", "A"));
    expect(heard).toEqual(["load 1", "add 2"]);
    expect(book.counts()).toEqual(new Map([["A", 2]]));
  });

  it("puts examples loaded late before the ones you taught meanwhile", () => {
    const book = createExampleBook();
    book.add(example("new", "A"));
    const v = book.version();
    book.load([example("old", "A"), example("new", "A")]);
    expect(book.all().map((e) => e.id)).toEqual(["old", "new"]);
    expect(book.version()).toBeGreaterThan(v);
  });

  it("turns a letter you wrote into an example that keeps its timing (D172)", () => {
    const [h] = splitLetters(hello.first as Stroke[]);
    const e = exampleFrom(h!, { id: "e1", label: "H", from: "you", at });
    expect(HandwritingExample.parse(e)).toEqual(e);
    expect(e.strokes).toHaveLength(h!.length);
    const xs = e.strokes.flatMap((s) => s.points.map((p) => p[0]));
    const ys = e.strokes.flatMap((s) => s.points.map((p) => p[1]));
    expect([Math.min(...xs), Math.min(...ys)]).toEqual([0, 0]);
    expect(e.strokes[0]!.t).toBe(0);
    const starts = [...h!].sort((a, b) => a.t0 - b.t0).map((s) => Math.round(s.t0 - h![0]!.t0));
    expect(e.strokes.map((s) => s.t)).toEqual(starts);
    expect(e.strokes[0]!.points.map((p) => p[3])).toEqual(h![0]!.points.map((p) => p[3]));
  });
});
