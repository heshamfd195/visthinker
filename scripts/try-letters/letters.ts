// Try the handwriting ability's first step (T51) on your own writing: split a saved canvas into
// letters and say, in plain words, what `letterFeatures` measured in each. A dev tool only; the
// app never runs it. The split here is a stand-in for D114 (word first, then letters), which the
// ability gets in step 4 (T54): strokes that overlap left to right, in the same row, are one letter.
import type { Box, Snapshot, Stroke } from "../../packages/contract/src/index.ts";
import { letterFeatures } from "../../packages/core/src/index.ts";
import type { LetterFeatures } from "../../packages/core/src/index.ts";

export interface Letter {
  strokes: Stroke[];
  box: Box;
}

/** Strokes this close (a share of the larger one's size) still overlap: a bar that stops short. */
const OVERLAP_SLACK = 0.12;

/** The strokes still on the canvas (not erased, cleared or undone), split into letters in reading order. */
export function lettersOf(snapshot: Snapshot): Letter[] {
  const hidden = new Set(snapshot.history.hidden);
  const strokes = snapshot.strokes.filter((s) => !hidden.has(s.id) && s.points.length > 0);
  const boxes = strokes.map(boxOf);

  // Union–find: two strokes are one letter when their boxes overlap across and down.
  const parent = strokes.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)));
  for (let i = 0; i < strokes.length; i++)
    for (let j = i + 1; j < strokes.length; j++)
      if (overlaps(boxes[i]!, boxes[j]!)) parent[root(i)] = root(j);

  const groups = new Map<number, number[]>();
  strokes.forEach((_, i) => groups.set(root(i), [...(groups.get(root(i)) ?? []), i]));
  const letters = [...groups.values()].map((members) => ({
    strokes: members.map((i) => strokes[i]!),
    box: union(members.map((i) => boxes[i]!)),
  }));
  return readingOrder(letters);
}

/** Rows top to bottom (a letter starts a new row when it is below the row's middle), then left to right. */
function readingOrder(letters: Letter[]): Letter[] {
  const rows: Letter[][] = [];
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

function overlaps(a: Box, b: Box): boolean {
  const slack = OVERLAP_SLACK * Math.max(a[2], a[3], b[2], b[3]);
  const across = a[0] <= b[0] + b[2] + slack && b[0] <= a[0] + a[2] + slack;
  const down = a[1] <= b[1] + b[3] + slack && b[1] <= a[1] + a[3] + slack;
  return across && down;
}

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

export interface LetterReading {
  letter: Letter;
  features: LetterFeatures;
}

export const read = (letters: Letter[]): LetterReading[] =>
  letters.map((letter) => ({ letter, features: letterFeatures(letter.strokes) }));

/** How to read the numbers, printed once above the letters. */
export const LEGEND = [
  "Angles: 0° is flat, 90° upright; / leans right, \\ leans left.",
  "Lengths and places are shares of the letter's own box: (0, 0) is its top left, (1, 1) its bottom right.",
  "Parts are numbered 1, 2, 3…; a and b are each part's ends (a was drawn first).",
].join("\n");

/** One letter in plain words. */
export function describe({ features: f }: LetterReading, n: number): string {
  const lines: string[] = [];
  const shape = f.aspect >= 1.15 ? "tall" : f.aspect <= 0.85 ? "wide" : "about square";
  const strokes = `${f.strokes} stroke${f.strokes === 1 ? "" : "s"}`;
  lines.push(
    `Letter ${n} · ${strokes} · ${Math.round(f.box[2])} × ${Math.round(f.box[3])}, ${shape}`,
  );

  const parts = f.parts.map((p, i) => {
    const what =
      p.kind === "line"
        ? `line  ${slant(p.angle)} ${pad(`${Math.round(p.angle)}°`, 4)}`
        : `curve       `;
    return `${i + 1}  ${what}  length ${fixed(p.length)}  from ${place(p.a)} to ${place(p.b)}`;
  });
  section(lines, "parts", parts);

  const meets = f.meets.map(
    (m) =>
      `${m.parts[0] + 1}${m.ends[0]} and ${m.parts[1] + 1}${m.ends[1]} meet at ${place(m.at)}, gap ${fixed(m.gap)}`,
  );
  section(lines, "meets", meets);

  const crossings = f.crossings.map((c) => {
    const touch = edge(c.t) || edge(c.u);
    const verb = touch ? "touch" : "cross";
    return `${c.parts[0] + 1} and ${c.parts[1] + 1} ${verb} at ${place(c.at)}, ${Math.round(c.angle)}° apart (t ${fixed(c.t)} along ${c.parts[0] + 1}, u ${fixed(c.u)} along ${c.parts[1] + 1})`;
  });
  section(lines, "crossings", crossings);

  const loops = f.loops.map(
    (l) => `round, centre ${place(l.center)}, ${fixed(l.width)} wide × ${fixed(l.height)} high`,
  );
  section(lines, "loops", loops);
  return lines.join("\n");
}

function section(lines: string[], name: string, rows: string[]) {
  if (rows.length === 0) return lines.push(`  ${pad(name, 10)} none`);
  rows.forEach((row, i) => lines.push(`  ${pad(i === 0 ? name : "", 10)} ${row}`));
}

const fixed = (n: number) => n.toFixed(2);
const pad = (s: string, n: number) => s.padEnd(n);
const edge = (t: number) => t <= 0.1 || t >= 0.9;

function slant(angle: number): string {
  const tilt = Math.min(angle, 180 - angle);
  if (tilt <= 15) return "—";
  if (tilt >= 85) return "|";
  return angle < 90 ? "/" : "\\";
}

/** A place in the box as numbers and words, e.g. "(0.50, 0.00) top centre". */
function place([x, y]: readonly [number, number]): string {
  const down = y <= 0.2 ? "top" : y >= 0.8 ? "bottom" : "middle";
  const across = x <= 0.2 ? "left" : x >= 0.8 ? "right" : "centre";
  return `(${fixed(x)}, ${fixed(y)}) ${down} ${across}`;
}
