// Scoring the character cards (D113 · T53): each check whose tests all pass earns its weight, so a
// card scores 0–100 against a letter's features, less 20 for each part it can't explain. The best card is clear at 70 or more with a lead
// of 15 or more over the next; anything else is unsure, and its two best guesses go along (D115).
import type {
  CardTest,
  CharacterCard,
  LetterFeatures,
  LetterPart,
  LetterReading,
  PartSelector,
  Point2,
  Region,
  Slant,
} from "@visthinker/contract";

/** D113: clear means at least this score… */
export const CLEAR_SCORE = 70;
/** …and at least this lead over the next card. */
export const CLEAR_LEAD = 15;

/**
 * Ink a card can't explain costs this much per part: an E with a curve, an L with extra bars.
 * A card explains the parts its passing checks pick out; parts it only forbids explain nothing.
 */
export const UNEXPLAINED_COST = 20;
/** Parts shorter than this (a share of the letter's size) are never charged: a pen's flick. */
export const SMALL_PART = 0.15;

/** One card against one letter: its score, which checks passed, and the parts it couldn't explain. */
export interface CardScore {
  char: string;
  score: number;
  checks: { label: string; weight: number; passed: boolean }[];
  /** How many parts none of its passing checks used. */
  unexplained: number;
}

export function scoreCard(card: CharacterCard, f: LetterFeatures): CardScore {
  const explained = new Set<number>();
  const checks = card.checks.map((c) => {
    const results = c.tests.map((t) => evaluate(t, f));
    const passed = results.every((r) => r.pass);
    if (passed) for (const r of results) for (const i of r.explains) explained.add(i);
    return { label: c.label, weight: c.weight, passed };
  });
  const unexplained = f.parts.filter((p, i) => p.length >= SMALL_PART && !explained.has(i)).length;
  const earned = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  const score = Math.max(0, Math.round(earned - UNEXPLAINED_COST * unexplained));
  return { char: card.char, score, checks, unexplained };
}

/** Every card against the letter, best first; the reading says whether the best is clear. */
export function readLetter(
  f: LetterFeatures,
  cards: readonly CharacterCard[],
): { reading: LetterReading; scores: CardScore[] } {
  const scores = cards.map((c) => scoreCard(c, f)).sort((a, b) => b.score - a.score);
  const [best, next] = scores;
  const score = best?.score ?? 0;
  const clear = !!best && score >= CLEAR_SCORE && score - (next?.score ?? 0) >= CLEAR_LEAD;
  return {
    reading: {
      label: clear ? best.char : "?",
      score,
      clear,
      guesses: scores.slice(0, 2).map((s) => ({ char: s.char, score: s.score })),
    },
    scores,
  };
}

/** Whether a test passes, and which parts it explains (none for a test that forbids them). */
function evaluate(t: CardTest, f: LetterFeatures): { pass: boolean; explains: number[] } {
  const within = (n: number, min: number, max?: number) =>
    n >= min && (max === undefined || n <= max);
  switch (t.test) {
    case "strokes":
      return { pass: within(f.strokes, t.min, t.max), explains: [] };
    case "count": {
      const found = f.parts.flatMap((p, i) => (matches(p, t.parts, f) ? [i] : []));
      return { pass: within(found.length, t.min, t.max), explains: t.max === 0 ? [] : found };
    }
    case "loops": {
      const loops = f.loops.filter((l) => Math.max(l.width, l.height) >= (t.minSize ?? 0));
      const strokes = new Set(loops.map((l) => l.stroke));
      const explains =
        t.max === 0 ? [] : f.parts.flatMap((p, i) => (strokes.has(p.stroke) ? [i] : []));
      return { pass: within(loops.length, t.min, t.max), explains };
    }
    case "join": {
      const pairs = joins(f, t.a, t.b, t.how, t.at);
      return {
        pass: within(pairs.length, t.min, t.max),
        explains: t.max === 0 ? [] : pairs.flat(),
      };
    }
  }
}

/** The pairs of different parts, one matching `a` and one `b`, that meet or cross in `at`. */
function joins(
  f: LetterFeatures,
  a: PartSelector,
  b: PartSelector,
  how: "meet" | "cross" | "any",
  at: Region | undefined,
): [number, number][] {
  const links = [
    ...(how !== "cross" ? f.meets.map((m) => ({ parts: m.parts, at: m.at })) : []),
    ...(how !== "meet" ? f.crossings.map((c) => ({ parts: c.parts, at: c.at })) : []),
  ];
  const pairs = new Map<string, [number, number]>();
  for (const link of links) {
    if (at && !inRegion(link.at, at)) continue;
    const [i, j] = link.parts;
    const [p, q] = [f.parts[i]!, f.parts[j]!];
    const fits = (matches(p, a, f) && matches(q, b, f)) || (matches(q, a, f) && matches(p, b, f));
    if (fits) pairs.set(`${Math.min(i, j)}-${Math.max(i, j)}`, [i, j]);
  }
  return [...pairs.values()];
}

function matches(p: LetterPart, s: PartSelector, f: LetterFeatures): boolean {
  if (s.kind && p.kind !== s.kind) return false;
  if (s.minLength !== undefined && p.length < s.minLength) return false;
  if (s.maxLength !== undefined && p.length > s.maxLength) return false;
  if (s.at && !inRegion(mid(p.a, p.b), s.at)) return false;
  if (s.slant || s.tilt) {
    const angle = angleOf(p, f);
    if (s.slant && !slants(angle, s.slant)) return false;
    const tilt = Math.min(angle, 180 - angle);
    if (s.tilt && (tilt < s.tilt[0] || tilt > s.tilt[1])) return false;
  }
  return true;
}

/** Whether an angle (0–180, y up) slants the given way. */
export function slants(angle: number, slant: Slant): boolean {
  const tilt = Math.min(angle, 180 - angle);
  switch (slant) {
    case "flat":
      return tilt <= 35;
    case "upright":
      return tilt >= 75;
    case "right":
      return angle > 15 && angle < 80;
    case "left":
      return angle > 100 && angle < 165;
  }
}

/** A line's own angle; a curve's is the line between its ends, measured in world units. */
function angleOf(p: LetterPart, f: LetterFeatures): number {
  if (p.kind === "line") return p.angle;
  const size = Math.max(f.box[2], f.box[3]);
  const w = Math.max(f.box[2], 0.05 * size);
  const h = Math.max(f.box[3], 0.05 * size);
  const deg = (Math.atan2(-(p.b[1] - p.a[1]) * h, (p.b[0] - p.a[0]) * w) * 180) / Math.PI;
  return ((deg % 180) + 180) % 180;
}

const mid = (a: Point2, b: Point2): Point2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function inRegion([x, y]: Point2, r: Region): boolean {
  if (r.x && (x < r.x[0] || x > r.x[1])) return false;
  if (r.y && (y < r.y[0] || y > r.y[1])) return false;
  return true;
}
