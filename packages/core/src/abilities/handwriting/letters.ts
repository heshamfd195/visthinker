// Word first, then letters (D114): the comparator groups strokes close in place and time into a
// word; here the word is split into letters, each measured on its own (T51). Two strokes are one
// letter when they overlap left to right, in the same row, or when they actually touch. A clear
// gap starts the next letter, even a narrow one: two L's whose feet nearly reach each other are
// still two letters. Joined-up letters touch, so they stay one piece, and Claude reads those.
import type { Box, LetterFeatures, Point2, Stroke } from "@visthinker/contract";
import { letterFeatures } from "./features.ts";

export const LETTER_TOLERANCES = {
  /** Overlapping left to right by this share of the narrower stroke's width makes one letter… */
  overlap: 0.25,
  /** …and so does coming this close, a share of the tallest stroke (an H's bar that stops short). */
  touch: 0.06,
} as const;

export type LetterTolerances = Record<keyof typeof LETTER_TOLERANCES, number>;

/** The strokes split into letters, in reading order: rows top to bottom, then left to right. */
export function splitLetters(
  strokes: readonly Stroke[],
  tol: LetterTolerances = LETTER_TOLERANCES,
): Stroke[][] {
  const drawn = strokes.filter((s) => s.points.length > 0);
  const boxes = drawn.map(boxOf);
  const tallest = Math.max(0, ...boxes.map((b) => b[3]));
  const reach = tol.touch * tallest;

  // Union–find: each pair that belongs together joins their letters.
  const parent = drawn.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)));
  for (let i = 0; i < drawn.length; i++)
    for (let j = i + 1; j < drawn.length; j++)
      if (overlaps(boxes[i]!, boxes[j]!, tol.overlap) || near(drawn[i]!, drawn[j]!, reach))
        parent[root(i)] = root(j);

  const groups = new Map<number, number[]>();
  drawn.forEach((_, i) => groups.set(root(i), [...(groups.get(root(i)) ?? []), i]));
  const letters = [...groups.values()].map((members) => ({
    strokes: members.map((i) => drawn[i]!),
    box: union(members.map((i) => boxes[i]!)),
  }));
  return readingOrder(letters).map((l) => l.strokes);
}

/** One letter of a word: its strokes and what was measured in them. */
export interface WordLetter {
  strokes: Stroke[];
  features: LetterFeatures;
}

/** A word split into letters, each measured (T51). */
export function readWord(strokes: readonly Stroke[]): WordLetter[] {
  return splitLetters(strokes).map((letter) => ({
    strokes: letter,
    features: letterFeatures(letter),
  }));
}

/** Overlapping left to right by a real share of the narrower one, and in the same row. */
function overlaps(a: Box, b: Box, share: number): boolean {
  const across = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const down = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  return across > 0 && across >= share * Math.min(a[2], b[2]) && down >= 0;
}

/** Do two strokes come within `reach` of each other anywhere along their paths? */
function near(s1: Stroke, s2: Stroke, reach: number): boolean {
  const [b1, b2] = [boxOf(s1), boxOf(s2)];
  // Boxes further apart than `reach` can't hold points that close.
  const gapX = Math.max(0, b1[0] - (b2[0] + b2[2]), b2[0] - (b1[0] + b1[2]));
  const gapY = Math.max(0, b1[1] - (b2[1] + b2[3]), b2[1] - (b1[1] + b1[3]));
  if (Math.hypot(gapX, gapY) > reach) return false;
  const [p1, p2] = [pathOf(s1), pathOf(s2)];
  return p1.some((p) => toPath(p, p2) <= reach) || p2.some((p) => toPath(p, p1) <= reach);
}

/** The distance from a point to the nearest point of a path (its segments, or its one point). */
function toPath(p: Point2, path: Point2[]): number {
  if (path.length === 1) return Math.hypot(p[0] - path[0]![0], p[1] - path[0]![1]);
  let best = Infinity;
  for (let i = 1; i < path.length; i++) best = Math.min(best, toSegment(p, path[i - 1]!, path[i]!));
  return best;
}

function toSegment(p: Point2, a: Point2, b: Point2): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Rows top to bottom (a letter starts a new row when it begins below a row's middle), then left to right. */
function readingOrder<T extends { box: Box }>(letters: T[]): T[] {
  const rows: T[][] = [];
  for (const letter of [...letters].sort((a, b) => a.box[1] - b.box[1])) {
    const row = rows.find((r) => {
      const top = Math.min(...r.map((l) => l.box[1]));
      const bottom = Math.max(...r.map((l) => l.box[1] + l.box[3]));
      return letter.box[1] < (top + bottom) / 2;
    });
    if (row) row.push(letter);
    else rows.push([letter]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.box[0] - b.box[0]));
}

const pathOf = (s: Stroke): Point2[] => s.points.map((p): Point2 => [p[0], p[1]]);

function boxOf(stroke: Stroke): Box {
  const xs = stroke.points.map((p) => p[0]);
  const ys = stroke.points.map((p) => p[1]);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
}

function union(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b[0]));
  const y = Math.min(...boxes.map((b) => b[1]));
  const right = Math.max(...boxes.map((b) => b[0] + b[2]));
  const bottom = Math.max(...boxes.map((b) => b[1] + b[3]));
  return [x, y, right - x, bottom - y];
}
