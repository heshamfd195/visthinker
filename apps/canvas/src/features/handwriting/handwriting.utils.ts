// What the handwriting ability read, ready to draw over each letter (T51 · D116): each letter's
// name and score, and what it measured, from the `letter` events of the words still on the canvas.
import {
  LetterEventDetail,
  WordReading,
  type Box,
  type LetterFeatures,
  type LetterReading,
  type Point2,
  type VisEvent,
} from "@visthinker/contract";
import { inWorld } from "@visthinker/core";

export interface LetterMarks {
  key: string;
  /** Its place in the word, from 1. */
  index: number;
  box: Box;
  /** What the cards read it as (D116): its name, "?" when unsure, or nothing before the cards. */
  name?: { label: string; score: number; clear: boolean };
  parts: { kind: "line" | "curve"; a: Point2; b: Point2; label: string; at: Point2 }[];
  meets: Point2[];
  crossings: Point2[];
  loops: { center: Point2; rx: number; ry: number }[];
}

/**
 * Each word's letters as its latest reading splits them (D114). A reading lists the letters' strokes,
 * and only new or changed letters get a `letter` event, so each letter's measurements are the
 * latest `letter` event with the same strokes. A reading from before the list (an older build)
 * shows the letters it caused. Words no longer on the canvas (undone, erased, cleared) are left out.
 */
export function latestLetters(
  events: readonly VisEvent[],
  onCanvas: ReadonlySet<string>,
): { word: string; detail: LetterEventDetail }[] {
  const reading = new Map<string, { seq: number; letters?: string[][] }>();
  const sent = new Map<string, Map<string, { cause: number; detail: LetterEventDetail }>>();
  for (const e of events) {
    if (!e.target || !onCanvas.has(e.target)) continue;
    if (e.type === "recognized") {
      const listed = WordReading.safeParse(e.detail);
      reading.set(e.target, {
        seq: e.seq,
        ...(listed.success ? { letters: listed.data.letters } : {}),
      });
    }
    if (e.type !== "letter") continue;
    const letter = LetterEventDetail.safeParse(e.detail);
    if (!letter.success) continue;
    const word = sent.get(e.target) ?? new Map();
    word.set(key(letter.data.strokes), { cause: e.cause ?? 0, detail: letter.data });
    sent.set(e.target, word);
  }
  const out: { word: string; detail: LetterEventDetail }[] = [];
  for (const [word, read] of reading) {
    const letters = sent.get(word);
    if (!letters) continue;
    if (read.letters)
      read.letters.forEach((strokes, i) => {
        const found = letters.get(key(strokes));
        if (found)
          out.push({ word, detail: { ...found.detail, index: i + 1, of: read.letters!.length } });
      });
    else
      for (const { cause, detail } of letters.values())
        if (cause === read.seq) out.push({ word, detail });
  }
  return out;
}

const key = (strokes: readonly string[]) => [...strokes].sort().join(" ");

/** One letter's measurements in world units, to draw over it. */
export function marksOf(
  key: string,
  index: number,
  f: LetterFeatures,
  reading?: LetterReading,
): LetterMarks {
  const at = (p: Point2) => inWorld(f, p);
  const size = Math.max(f.box[2], f.box[3]);
  return {
    key,
    index,
    box: f.box,
    ...(reading
      ? { name: { label: reading.label, score: reading.score, clear: reading.clear } }
      : {}),
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
    marksOf(`${word}-${detail.index}`, detail.index, detail.features, detail.reading),
  );
}
