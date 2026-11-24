// Try the handwriting ability on your own writing (T51): split a saved canvas into letters and say,
// in plain words, what the ability measured in each. A dev tool only; the app never runs it. The
// split and the words are the ability's own, so this shows what the canvas reads.
import type { Snapshot, Stroke } from "../../packages/contract/src/index.ts";
import { CARDS, letterBreakdown, readLetter, readWord } from "../../packages/core/src/index.ts";
import type { WordLetter } from "../../packages/core/src/index.ts";

/** The strokes still on the canvas (not erased, cleared or undone). */
export function visibleStrokes(snapshot: Snapshot): Stroke[] {
  const hidden = new Set(snapshot.history.hidden);
  return snapshot.strokes.filter((s) => !hidden.has(s.id) && s.points.length > 0);
}

/** Everything on the canvas, split into letters in reading order and measured. */
export const lettersOf = (snapshot: Snapshot): WordLetter[] => readWord(visibleStrokes(snapshot));

/** How to read the numbers, printed once above the letters. */
export const LEGEND = [
  "Angles: 0° is flat, 90° upright; / leans right, \\ leans left.",
  "Lengths and places are shares of the letter's own box: (0, 0) is its top left, (1, 1) its bottom right.",
  "Parts are numbered 1, 2, 3…; a and b are each part's ends (a was drawn first).",
].join("\n");

/** One letter in plain words. */
export function describe({ features: f }: WordLetter, n: number): string {
  const shape = f.aspect >= 1.15 ? "tall" : f.aspect <= 0.85 ? "wide" : "about square";
  const strokes = `${f.strokes} stroke${f.strokes === 1 ? "" : "s"}`;
  const size = `${Math.round(f.box[2])} × ${Math.round(f.box[3])}`;
  const { reading } = readLetter(f, CARDS);
  const guesses = reading.guesses.map((g) => `${g.char} ${g.score}`).join(", ");
  const name = reading.clear ? `${reading.label} ${reading.score}%` : `? (${guesses})`;
  return [
    `Letter ${n} · ${name} · ${strokes} · ${size}, ${shape}`,
    ...letterBreakdown(f).map((l) => `  ${l}`),
  ].join("\n");
}
