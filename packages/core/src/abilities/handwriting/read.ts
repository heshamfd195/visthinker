// Reading handwriting end to end (T51–T53): split the strokes into letters (D114), turn a tilted
// letter upright (the drawing's orientation limit), measure it and read it by the cards (D113).
// Each letter tries small turns either way and keeps one only if it reads much better than
// upright, so an L can't turn itself into a V. Past about 30° nothing is turned: the letter stays
// unsure and goes to Claude.
import type {
  CharacterCard,
  LetterFeatures,
  LetterReading,
  Point2,
  Stroke,
} from "@visthinker/contract";
import { CARDS } from "./cards.ts";
import { letterFeatures } from "./features.ts";
import { splitLetters } from "./letters.ts";
import { readLetter } from "./scoring.ts";

export const TILT = {
  /** The turns a letter tries, each way; nothing past 30° is turned. */
  tries: [10, 20, 30],
  /** A letter keeps a turn only if it scores this much more than upright. */
  lead: 15,
} as const;

/** One letter as read: its strokes, what was measured (upright), its reading, and its turn. */
export interface ReadLetter {
  strokes: Stroke[];
  features: LetterFeatures;
  reading: LetterReading;
  /**
   * How far it leans, in degrees clockwise on the page, and the point it was turned about to be
   * read upright; missing when it was read as it is.
   */
  turn?: { deg: number; about: Point2 };
}

/**
 * The strokes as letters in reading order, each read upright, or turned when that reads much
 * better. Each letter finds its own turn: a word's baseline isn't trusted, as a real line of
 * writing drifted 10° upward while its letters stood upright (24 Nov).
 */
export function readHandwriting(
  strokes: readonly Stroke[],
  cards: readonly CharacterCard[] = CARDS,
): ReadLetter[] {
  return splitLetters(strokes).map((l) => readLetterTurned(l, cards));
}

/** A letter: upright, unless a small turn reads it much better. */
function readLetterTurned(strokes: Stroke[], cards: readonly CharacterCard[]): ReadLetter {
  const upright = readTurned(strokes, 0, cards);
  let best = upright;
  for (const d of TILT.tries)
    for (const deg of [d, -d]) {
      const turned = readTurned(strokes, deg, cards);
      if (turned.reading.score > best.reading.score) best = turned;
    }
  return best.reading.score >= upright.reading.score + TILT.lead ? best : upright;
}

/** Reads a letter as if turned back by `deg` (clockwise on the page) about its centre. */
function readTurned(strokes: Stroke[], deg: number, cards: readonly CharacterCard[]): ReadLetter {
  if (deg === 0) {
    const features = letterFeatures(strokes);
    return { strokes, features, reading: readLetter(features, cards).reading };
  }
  const about = centreOf(strokes);
  const turned = strokes.map((s) => ({
    ...s,
    points: s.points.map(([x, y, p, dt]): Stroke["points"][number] => {
      const [tx, ty] = rotate([x, y], about, -deg);
      return [tx, ty, p, dt];
    }),
  }));
  const features = letterFeatures(turned);
  return { strokes, features, reading: readLetter(features, cards).reading, turn: { deg, about } };
}

/** Turns a point about another by `deg`, clockwise on the page (y grows down). */
export function rotate([x, y]: Point2, [cx, cy]: Point2, deg: number): Point2 {
  const r = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(r), Math.sin(r)];
  const [dx, dy] = [x - cx, y - cy];
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

function centreOf(strokes: readonly Stroke[]): Point2 {
  const xs = strokes.flatMap((s) => s.points.map((p) => p[0]));
  const ys = strokes.flatMap((s) => s.points.map((p) => p[1]));
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return [
    round1((Math.min(...xs) + Math.max(...xs)) / 2),
    round1((Math.min(...ys) + Math.max(...ys)) / 2),
  ];
}
