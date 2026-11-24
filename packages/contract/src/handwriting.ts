// The handwriting ability's readings (D111 · D112 · D161): what it measured in one letter, and the
// `letter` event that carries it. Every place and length is a share of the letter's own box, so a
// tiny A and a huge one read the same; only `box` is in world units.
import { z } from "zod";
import { Box, Id, Point2 } from "./common.ts";

export const PartEnd = z.enum(["a", "b"]);

const PartBase = z.object({
  /** Which stroke of the letter it came from, in drawing order. */
  stroke: z.number().int().nonnegative(),
  /** Its ends in the letter's box (0–1, top left is 0, y grows down); `a` was drawn first. */
  a: Point2,
  b: Point2,
  /** A share of the letter's size (its larger side): a line end to end, a curve along its path. */
  length: z.number().nonnegative(),
});

export const LinePart = PartBase.extend({
  kind: z.literal("line"),
  /** Degrees from flat, 0–180 with y up: 90 is upright, under 90 leans right (/), over leans left (\). */
  angle: z.number().min(0).max(180),
});

export const CurvePart = PartBase.extend({ kind: z.literal("curve") });

export const LetterPart = z.discriminatedUnion("kind", [LinePart, CurvePart]);

/** Two parts whose ends land close together, like the top of an A. */
export const PartMeet = z.object({
  /** Indexes into `parts`, the lower first. */
  parts: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  ends: z.tuple([PartEnd, PartEnd]),
  at: Point2,
  /** How far apart the two ends are, a share of the letter's size. */
  gap: z.number().nonnegative(),
});

/** Two lines that cross, or one that touches the other's body (a T, an H's bar). */
export const PartCrossing = z.object({
  /** Indexes into `parts`, the lower first; both are lines. */
  parts: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  /** How far along the first line it is (0 at its `a`, 1 at its `b`); near 0 or 1 is a touch. */
  t: z.number(),
  /** The same along the second line. */
  u: z.number(),
  at: Point2,
  /** The smaller angle between the two lines, 0–90. */
  angle: z.number().min(0).max(90),
});

/** A stroke that closes on itself around a curve, like an O or the bowl of a P drawn in one go. */
export const LetterLoop = z.object({
  stroke: z.number().int().nonnegative(),
  center: Point2,
  /** Its size, each a share of the letter's size. */
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});

/** Everything measured in one letter (T51). */
export const LetterFeatures = z.object({
  strokes: z.number().int().nonnegative(),
  /** The letter's box in world units; everything else is measured against it. */
  box: Box,
  /** Height over width. */
  aspect: z.number().nonnegative(),
  parts: z.array(LetterPart),
  meets: z.array(PartMeet),
  crossings: z.array(PartCrossing),
  loops: z.array(LetterLoop),
});

// ── Character cards (D112 · D113) ────────────────────────────────────────────────────────────

const Share = z.number().min(-0.5).max(1.5);
/** A band of the letter's box, as shares from its top left: `y: [0.35, 0.75]` is the middle. */
export const Region = z.object({
  x: z.tuple([Share, Share]).optional(),
  y: z.tuple([Share, Share]).optional(),
});

/**
 * How a part slants: `flat` (within 35° of level), `upright` (within 15° of straight up), `right`
 * (leaning like /, 15°–80°) or `left` (like \, 100°–165°). A curve slants by the line between its
 * ends, so a foot that bows still counts as flat.
 */
export const Slant = z.enum(["flat", "upright", "right", "left"]);

/** Which parts a test looks at. Every field narrows it; none means any part. */
export const PartSelector = z.object({
  kind: z.enum(["line", "curve"]).optional(),
  slant: Slant.optional(),
  /** Length as a share of the letter's size. */
  minLength: z.number().nonnegative().optional(),
  maxLength: z.number().nonnegative().optional(),
  /** Where the part's middle lies. */
  at: Region.optional(),
});

/** One thing a computer can check on a letter's features (D112). */
export const CardTest = z.discriminatedUnion("test", [
  /** How many strokes it took. */
  z.object({
    test: z.literal("strokes"),
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
  }),
  /** How many parts match. */
  z.object({
    test: z.literal("count"),
    parts: PartSelector,
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative().optional(),
  }),
  /**
   * At least `min` pairs of different parts, one matching `a` and one `b`, that meet at their
   * ends, cross or touch (`how`), where they join lying in `at`.
   */
  z.object({
    test: z.literal("join"),
    a: PartSelector,
    b: PartSelector,
    how: z.enum(["meet", "cross", "any"]).default("any"),
    at: Region.optional(),
    min: z.number().int().nonnegative().default(1),
    /** At most this many pairs: `max: 0` means they must not join (an H's legs). */
    max: z.number().int().nonnegative().optional(),
  }),
  /** How many closed loops, each at least `minSize` of the letter's size on its larger side. */
  z.object({
    test: z.literal("loops"),
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative().optional(),
    minSize: z.number().nonnegative().optional(),
  }),
]);

/** A check on a card: it earns its weight when all its tests pass (D113). */
export const CardCheck = z.object({
  /** In plain words, e.g. "the legs meet at the top". */
  label: z.string().min(1).max(80),
  weight: z.number().positive().max(100),
  tests: z.array(CardTest).min(1),
});

/** A character card (D112): what a computer can check to know a character. Weights add up to 100. */
export const CharacterCard = z
  .object({
    char: z.string().min(1).max(2),
    checks: z.array(CardCheck).min(1),
  })
  .refine((c) => Math.round(c.checks.reduce((sum, k) => sum + k.weight, 0)) === 100, {
    message: "a card's weights add up to 100",
  });

/**
 * What a letter was read as (D113): the best card and its score out of 100, whether that's clear
 * (70 or more, and 15 or more ahead of the next), and the two best guesses.
 */
export const LetterReading = z.object({
  /** The best card's character, or `?` when unsure. */
  label: z.string().min(1).max(2),
  score: z.number().min(0).max(100),
  clear: z.boolean(),
  guesses: z.array(z.object({ char: z.string().min(1).max(2), score: z.number().min(0).max(100) })),
});

/**
 * The `detail` of a `letter` event: one letter of a word the comparator read, its `target` the
 * word and its `cause` the word's `recognized` event. A word read again (a late stroke, D110)
 * sends only the letters that are new or whose strokes changed; the word's `recognized` event
 * lists all its letters, and each one's latest `letter` event with the same strokes holds its
 * measurements. `index` and `of` are as they were when it was sent.
 */
export const LetterEventDetail = z.object({
  /** Its place in the word, from 1, and how many letters the word has (D114). */
  index: z.number().int().positive(),
  of: z.number().int().positive(),
  strokes: z.array(Id).min(1),
  features: LetterFeatures,
  /** What the cards read it as (T53); missing from events made before the cards. */
  reading: LetterReading.optional(),
});

/**
 * The `detail` of a `recognized` event for written words (D114): what the comparator read and
 * the word's letters as it splits them now, each a list of stroke ids, left to right. A group of
 * two or more letters is a `word`, with no symbol guess, and so is a lone letter a card reads
 * clearly; any other lone mark stays a `symbol`.
 */
export const WordReading = z.object({
  kind: z.enum(["word", "symbol"]),
  letters: z.array(z.array(Id).min(1)),
  /** The word as read, a `?` for each unsure letter, e.g. "HE?LO" (T53). */
  text: z.string().max(200).optional(),
});

export type PartEnd = z.infer<typeof PartEnd>;
export type LinePart = z.infer<typeof LinePart>;
export type CurvePart = z.infer<typeof CurvePart>;
export type LetterPart = z.infer<typeof LetterPart>;
export type PartMeet = z.infer<typeof PartMeet>;
export type PartCrossing = z.infer<typeof PartCrossing>;
export type LetterLoop = z.infer<typeof LetterLoop>;
export type LetterFeatures = z.infer<typeof LetterFeatures>;
export type LetterEventDetail = z.infer<typeof LetterEventDetail>;
export type WordReading = z.infer<typeof WordReading>;
export type Region = z.infer<typeof Region>;
export type Slant = z.infer<typeof Slant>;
export type PartSelector = z.infer<typeof PartSelector>;
export type CardTest = z.infer<typeof CardTest>;
export type CardCheck = z.infer<typeof CardCheck>;
export type CharacterCard = z.infer<typeof CharacterCard>;
export type LetterReading = z.infer<typeof LetterReading>;
