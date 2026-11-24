// What the handwriting ability measured, ready to draw over each letter (T51): the latest `letter`
// events of each word still on the canvas, turned back into world units.
import {
  LetterEventDetail,
  type Box,
  type LetterFeatures,
  type Point2,
  type VisEvent,
} from "@visthinker/contract";
import { inWorld } from "@visthinker/core";

export interface LetterMarks {
  key: string;
  /** Its place in the word, from 1. */
  index: number;
  box: Box;
  parts: { kind: "line" | "curve"; a: Point2; b: Point2; label: string; at: Point2 }[];
  meets: Point2[];
  crossings: Point2[];
  loops: { center: Point2; rx: number; ry: number }[];
}

/**
 * Each word's letters from its latest reading: a word read again (a late stroke, D110) gets new
 * letter events with a newer cause, and those replace the old ones. Words no longer on the canvas
 * (undone, erased, cleared) are left out.
 */
export function latestLetters(
  events: readonly VisEvent[],
  onCanvas: ReadonlySet<string>,
): { word: string; detail: LetterEventDetail }[] {
  const latest = new Map<string, number>();
  const letters: { word: string; cause: number; detail: LetterEventDetail }[] = [];
  for (const e of events) {
    if (e.type !== "letter" || !e.target || !onCanvas.has(e.target)) continue;
    const parsed = LetterEventDetail.safeParse(e.detail);
    if (!parsed.success) continue;
    const cause = e.cause ?? 0;
    latest.set(e.target, Math.max(latest.get(e.target) ?? 0, cause));
    letters.push({ word: e.target, cause, detail: parsed.data });
  }
  return letters
    .filter((l) => l.cause === latest.get(l.word))
    .map(({ word, detail }) => ({ word, detail }));
}

/** One letter's measurements in world units, to draw over it. */
export function marksOf(key: string, index: number, f: LetterFeatures): LetterMarks {
  const at = (p: Point2) => inWorld(f, p);
  const size = Math.max(f.box[2], f.box[3]);
  return {
    key,
    index,
    box: f.box,
    parts: f.parts.map((p, i) => {
      const [a, b] = [at(p.a), at(p.b)];
      return {
        kind: p.kind,
        a,
        b,
        label: String(i + 1),
        at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      };
    }),
    meets: f.meets.map((m) => at(m.at)),
    crossings: f.crossings.map((c) => at(c.at)),
    loops: f.loops.map((l) => ({
      center: at(l.center),
      rx: (l.width * size) / 2,
      ry: (l.height * size) / 2,
    })),
  };
}

/** Everything to draw: each word on the canvas, each of its letters. */
export function letterMarks(
  events: readonly VisEvent[],
  onCanvas: ReadonlySet<string>,
): LetterMarks[] {
  return latestLetters(events, onCanvas).map(({ word, detail }) =>
    marksOf(`${word}-${detail.index}`, detail.index, detail.features),
  );
}
