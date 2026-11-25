// Your handwriting examples (D117 · D118 · D174): each letter you confirm or fix is kept as one
// example, its label and the strokes as you wrote them, so the Fast Brain can match your next
// letter against them, and later write in your hand by playing them back (D172). They live with
// the ability in the repo, `packages/core/src/abilities/handwriting/data/examples.json` (D178).
import { z } from "zod";
import { Id } from "./common.ts";
import { StrokePoint } from "./stroke.ts";

/**
 * D182: the label for a mark you said isn't a letter (noise, a doodle). It's kept like any example,
 * and a mark that matches it stays a plain mark, outside any word.
 */
export const NOT_A_LETTER = "∅";

/** D118: keep about the last 10 examples per letter, so the file stays small. */
export const EXAMPLES_PER_LABEL = 10;

/**
 * One stroke of an example. Points are `[x, y, pressure, dt]` as drawn (D88), moved so the
 * example's box starts at 0, 0; `t` is when the stroke started, in ms after the example's first
 * stroke, so the pauses between strokes play back too (D172).
 */
export const ExampleStroke = z.object({
  t: z.number().nonnegative(),
  points: z.array(StrokePoint).min(1).max(4_000),
});

export const ExampleSource = z.enum(["you", "claude"]);

export const HandwritingExample = z.object({
  id: Id,
  /** What it is: `A`, `a`, `7`, `?`… one character, or two for a pair a font joins; `∅` for not a letter. */
  label: z.string().min(1).max(2),
  strokes: z.array(ExampleStroke).min(1).max(16),
  /** Who named it: you (you fixed or confirmed it) or Claude (you moved on and left it, D117). */
  from: ExampleSource,
  /** When it was saved, as an ISO date and time. */
  at: z.string().min(1).max(40),
});

/** The examples file. */
export const HandwritingExamples = z.object({
  version: z.literal(1),
  examples: z.array(HandwritingExample).max(5_000),
});

export type ExampleStroke = z.infer<typeof ExampleStroke>;
export type ExampleSource = z.infer<typeof ExampleSource>;
export type HandwritingExample = z.infer<typeof HandwritingExample>;
export type HandwritingExamples = z.infer<typeof HandwritingExamples>;
