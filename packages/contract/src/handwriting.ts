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
});

/**
 * The `detail` of a `recognized` event for written words (D114): what the comparator read and
 * the word's letters as it splits them now, each a list of stroke ids, left to right. A group of
 * two or more letters is a `word`, with no symbol guess; a lone letter stays a `symbol`.
 */
export const WordReading = z.object({
  kind: z.enum(["word", "symbol"]),
  letters: z.array(z.array(Id).min(1)),
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
