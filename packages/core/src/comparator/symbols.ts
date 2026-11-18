// The $P point-cloud recognizer (Vatavu, Anthony & Wobbrock, 2012) for small symbols (D96).
// Multi-stroke and blind to stroke order and direction: every stroke becomes one cloud of points.
import type { Pack, Point2 } from "@visthinker/contract";
import { crossRule } from "./cross.ts";

export interface CloudPoint {
  x: number;
  y: number;
  /** Which stroke the point came from. */
  stroke: number;
}

/** A labelled example, as drawn (any scale). */
export interface SymbolTemplate {
  label: string;
  strokes: Point2[][];
}

/** The `symbol` block's data in a pack's rules.json. */
export interface SymbolRules {
  /** Points each cloud is resampled to. */
  points: number;
  /** A score 1 / (1 + d), d the $P distance, below this is "?". */
  threshold: number;
  templates: SymbolTemplate[];
}

export interface Alternative {
  label: string;
  score: number;
}

export interface Recognition {
  /** The best match, or "?" when it scores under its pack's threshold. */
  label: string;
  score: number;
  /** The next two best labels (each label once), best first. */
  alternatives: Alternative[];
  via: "cross" | "$P";
  /** The pack whose template won ("shapes" for the cross rule). */
  pack?: string;
}

/** One installed pack's symbol data. */
export interface SymbolSet {
  pack: string;
  rules: SymbolRules;
}

export interface Recognizer {
  recognize(strokes: Point2[][]): Recognition;
}

/** Reads `rules.json.symbol` without trusting it. */
export function parseSymbolRules(raw: unknown): SymbolRules | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<SymbolRules>;
  const isPoint = (p: unknown) =>
    Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number");
  const ok =
    typeof r.points === "number" &&
    r.points >= 8 &&
    typeof r.threshold === "number" &&
    Array.isArray(r.templates) &&
    r.templates.length > 0 &&
    r.templates.every(
      (t) =>
        typeof t?.label === "string" &&
        Array.isArray(t.strokes) &&
        t.strokes.length > 0 &&
        t.strokes.every((s) => Array.isArray(s) && s.length > 0 && s.every(isPoint)),
    );
  return ok ? (r as SymbolRules) : undefined;
}

/**
 * Reads a closed group: the cross rule first (X), then $P against the templates of every
 * installed symbol pack. `crossRule: false` leaves everything to $P.
 */
export function createRecognizer(
  input: SymbolRules | SymbolSet[],
  options: { crossRule?: boolean } = {},
): Recognizer {
  const sets = Array.isArray(input) ? input : [{ pack: "shapes", rules: input }];
  const templates = sets.flatMap(({ pack, rules }) =>
    rules.templates.map((t) => ({
      pack,
      label: t.label,
      strokes: t.strokes.length,
      threshold: rules.threshold,
      n: rules.points,
      cloud: normalize(t.strokes, rules.points),
    })),
  );
  const toScore = (d: number) => Math.round((1 / (1 + d)) * 100) / 100;

  return {
    recognize(strokes) {
      const clouds = new Map<number, CloudPoint[]>();
      const cloudFor = (n: number) => {
        if (!clouds.has(n)) clouds.set(n, normalize(strokes, n));
        return clouds.get(n)!;
      };
      // The best distance per label: each label is ranked once, by its closest template.
      const best = new Map<string, { d: number; pack: string; threshold: number }>();
      for (const t of templates) {
        // A drawing can't be a template with more strokes than it has (one line is not an X).
        if (t.strokes > strokes.length) continue;
        const sofar = best.get(t.label)?.d ?? Infinity;
        const d = greedyCloudMatch(cloudFor(t.n), t.cloud, sofar);
        if (d < sofar) best.set(t.label, { d, pack: t.pack, threshold: t.threshold });
      }
      // 1 for a perfect match, falling as the $P matching distance d grows: 1 / (1 + d).
      // ($P's own 1 / d tops out at 1 for every good match, so it can't rank them.)
      const ranked = [...best.entries()]
        .sort((a, b) => a[1].d - b[1].d)
        .map(([label, m]) => ({
          label,
          score: toScore(m.d),
          pack: m.pack,
          threshold: m.threshold,
        }));

      const cross = options.crossRule === false ? undefined : crossRule(strokes);
      if (cross) {
        const alternatives = ranked
          .filter((r) => r.label !== "X")
          .slice(0, 2)
          .map(({ label, score }) => ({ label, score }));
        return { label: "X", score: cross.score, alternatives, via: "cross", pack: "shapes" };
      }
      const top = ranked[0];
      if (!top || top.score < top.threshold) {
        const alternatives = ranked.slice(0, 2).map(({ label, score }) => ({ label, score }));
        return { label: "?", score: top?.score ?? 0, alternatives, via: "$P" };
      }
      const alternatives = ranked.slice(1, 3).map(({ label, score }) => ({ label, score }));
      return { label: top.label, score: top.score, alternatives, via: "$P", pack: top.pack };
    },
  };
}

/** The symbol data of every pack that lists the `symbol` block, skipping any that isn't valid. */
export function symbolSetsFrom(packs: readonly Pack[]): SymbolSet[] {
  return packs.flatMap((pack) => {
    if (!pack["pack.json"].blocks.includes("symbol")) return [];
    const rules = parseSymbolRules(pack["rules.json"]?.["symbol"]);
    return rules ? [{ pack: pack["pack.json"].name, rules }] : [];
  });
}

/** Resample to n points across all strokes, scale to the unit box (keeping the aspect), centre. */
export function normalize(strokes: Point2[][], n: number): CloudPoint[] {
  const points: CloudPoint[] = strokes.flatMap((s, k) => s.map(([x, y]) => ({ x, y, stroke: k })));
  return translateToOrigin(scale(resample(points, n)));
}

function resample(input: CloudPoint[], n: number): CloudPoint[] {
  const points = input.map((p) => ({ ...p }));
  const interval = pathLength(points) / (n - 1);
  const out: CloudPoint[] = [{ ...points[0]! }];
  if (interval === 0) return Array.from({ length: n }, () => ({ ...points[0]! }));
  let D = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (a.stroke !== b.stroke) continue;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (D + d >= interval) {
      const t = (interval - D) / d;
      const q = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), stroke: b.stroke };
      out.push(q);
      points.splice(i, 0, q); // q is the next a
      D = 0;
    } else D += d;
  }
  while (out.length < n) out.push({ ...points.at(-1)! });
  return out.slice(0, n);
}

function pathLength(points: CloudPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++)
    if (points[i]!.stroke === points[i - 1]!.stroke)
      d += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  return d;
}

function scale(points: CloudPoint[]): CloudPoint[] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const size = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  return points.map((p) => ({ x: (p.x - minX) / size, y: (p.y - minY) / size, stroke: p.stroke }));
}

function translateToOrigin(points: CloudPoint[]): CloudPoint[] {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return points.map((p) => ({ x: p.x - cx, y: p.y - cy, stroke: p.stroke }));
}

function greedyCloudMatch(points: CloudPoint[], template: CloudPoint[], best: number): number {
  const n = points.length;
  const step = Math.floor(Math.sqrt(n)); // n^(1 − ε) with ε = 0.5
  let min = Infinity;
  for (let i = 0; i < n; i += step) {
    min = Math.min(
      min,
      cloudDistance(points, template, i, Math.min(min, best)),
      cloudDistance(template, points, i, Math.min(min, best)),
    );
  }
  return min;
}

function cloudDistance(a: CloudPoint[], b: CloudPoint[], start: number, cutoff: number): number {
  const n = a.length;
  const matched = new Array<boolean>(n).fill(false);
  let sum = 0;
  let i = start;
  do {
    let index = -1;
    let min = Infinity;
    for (let j = 0; j < n; j++) {
      if (matched[j]) continue;
      const d = Math.hypot(a[i]!.x - b[j]!.x, a[i]!.y - b[j]!.y);
      if (d < min) {
        min = d;
        index = j;
      }
    }
    matched[index] = true;
    sum += (1 - ((i - start + n) % n) / n) * min;
    if (sum >= cutoff) return sum;
    i = (i + 1) % n;
  } while (i !== start);
  return sum;
}
