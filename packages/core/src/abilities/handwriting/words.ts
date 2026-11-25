// What the handwriting ability measured, in plain words (T51): one line for the events box, and a
// breakdown for when you open it (and for `pnpm try:letters`). Places are shares of the letter's
// own box, (0, 0) its top left; parts are numbered from 1, and a and b are each part's ends.
import type { LetterFeatures, LetterReading, Point2 } from "@visthinker/contract";

/** A mark for a line's slant: — flat, | upright, / leaning right, \ leaning left. */
export function slantMark(angle: number): string {
  const tilt = Math.min(angle, 180 - angle);
  if (tilt <= 15) return "—";
  if (tilt >= 85) return "|";
  return angle < 90 ? "/" : "\\";
}

const count = (n: number, one: string) =>
  n === 0 ? `no ${one}s` : `${n} ${one}${n === 1 ? "" : "s"}`;

/** One line: "3 lines | — | · 2 crossings · no meets · no loops". */
export function letterSummary(f: LetterFeatures): string {
  const lines = f.parts.flatMap((p) => (p.kind === "line" ? [slantMark(p.angle)] : []));
  const curves = f.parts.length - lines.length;
  const parts = [
    lines.length > 0 && `${count(lines.length, "line")} ${lines.join(" ")}`,
    curves > 0 && count(curves, "curve"),
    f.parts.length === 0 && "nothing to measure",
  ].filter(Boolean);
  return [
    ...parts,
    count(f.meets.length, "meet"),
    count(f.crossings.length, "crossing"),
    count(f.loops.length, "loop"),
  ].join(" · ");
}

/** The breakdown, a line per part, meet, crossing and loop. */
export function letterBreakdown(f: LetterFeatures): string[] {
  const out: string[] = [];
  section(
    out,
    "parts",
    f.parts.map((p, i) => {
      const what =
        p.kind === "line"
          ? `line  ${slantMark(p.angle)} ${`${Math.round(p.angle)}°`.padEnd(4)}`
          : "curve       ";
      return `${i + 1}  ${what}  length ${fixed(p.length)}  from ${place(p.a)} to ${place(p.b)}`;
    }),
  );
  section(
    out,
    "meets",
    f.meets.map(
      (m) =>
        `${m.parts[0] + 1}${m.ends[0]} and ${m.parts[1] + 1}${m.ends[1]} meet at ${place(m.at)}, gap ${fixed(m.gap)}`,
    ),
  );
  section(
    out,
    "crossings",
    f.crossings.map((c) => {
      const [p, q] = [c.parts[0] + 1, c.parts[1] + 1];
      const verb = edge(c.t) || edge(c.u) ? "touch" : "cross";
      return `${p} and ${q} ${verb} at ${place(c.at)}, ${Math.round(c.angle)}° apart (t ${fixed(c.t)} along ${p}, u ${fixed(c.u)} along ${q})`;
    }),
  );
  section(
    out,
    "loops",
    f.loops.map(
      (l) => `round, centre ${place(l.center)}, ${fixed(l.width)} wide × ${fixed(l.height)} high`,
    ),
  );
  return out;
}

function section(out: string[], name: string, rows: string[]) {
  if (rows.length === 0) out.push(`${name.padEnd(10)} none`);
  rows.forEach((row, i) => out.push(`${(i === 0 ? name : "").padEnd(10)} ${row}`));
}

const fixed = (n: number) => n.toFixed(2);
/** Near either end of a line: a touch, like a T, rather than a crossing. */
const edge = (t: number) => t <= 0.1 || t >= 0.9;

/** A place in the box as numbers and words, e.g. "(0.50, 0.00) top centre". */
function place([x, y]: Point2): string {
  const down = y <= 0.2 ? "top" : y >= 0.8 ? "bottom" : "middle";
  const across = x <= 0.2 ? "left" : x >= 0.8 ? "right" : "centre";
  return `(${fixed(x)}, ${fixed(y)}) ${down} ${across}`;
}

/**
 * Who named a letter, in a few words (D174 · D175): "by your examples · nearest H 0.6 · 3 of H",
 * "by the cards · examples unsure: H 1.4, E 1.9", or named by Claude. Empty before the examples.
 */
export function namedBy(r: LetterReading): string {
  const ex = r.examples;
  const near = (ex?.guesses ?? []).map((g) => `${g.char} ${g.distance.toFixed(1)}`).join(", ");
  if (r.via === "examples" && ex)
    return `by your examples · nearest ${near} · ${ex.count} of ${ex.label}`;
  if (r.via === "claude") return "named by Claude, saved as an example";
  if (r.via !== "cards") return "";
  return ex ? `by the cards · examples unsure: ${near}` : "by the cards · no examples yet";
}

/** What your examples said about a letter, line by line, for the events box (D174). */
export function examplesBreakdown(r: LetterReading): string[] {
  const ex = r.examples;
  if (!ex) return ["Your examples: none to compare with yet."];
  return [
    `Your examples: ${ex.sure ? `sure it's ${ex.label}` : "not sure"} (named by ${r.via === "examples" ? "your examples" : "the cards"})`,
    ...ex.guesses.map(
      (g, i) =>
        `  ${i === 0 ? "nearest" : "next"}: ${g.char}, distance ${g.distance.toFixed(2)}, score ${g.score}`,
    ),
    `  compared ${ex.compared} of ${ex.of} examples (the rest differ in strokes, shape or loops)`,
  ];
}
