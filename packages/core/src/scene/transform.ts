// Resize, rotate and move as one affine matrix (the selection's handles): the maths that carries
// ink and objects through it. Pure, so it is tested alone; the history records the result.
import type { Box, Point2, SceneObject, Stroke } from "@visthinker/contract";

/** A 2D affine matrix as canvas has it: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const round = (n: number) => Math.round(n * 10) / 10;

export function applyMatrix(m: Matrix, [x, y]: readonly [number, number]): Point2 {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

const roundPoint = (p: Point2): Point2 => [round(p[0]), round(p[1])];

/** Kinds drawn as a box that turns around its centre: rotation lives in `geom.rotation`. */
const BOXED = new Set(["box", "circle", "glyph", "text"]);

/** An object's rotation in degrees, for the kinds that turn around their centre. */
export function rotationOf(o: SceneObject): number {
  const r = (o.geom as { rotation?: unknown } | undefined)?.rotation;
  return typeof r === "number" ? r : 0;
}

/** The smallest box around some points. */
export function boxAround(points: readonly Point2[]): Box {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return [round(x), round(y), round(Math.max(...xs) - x), round(Math.max(...ys) - y)];
}

/** The ink carried through: every point moves, pressure and timing stay. */
export function transformStroke(stroke: Stroke, m: Matrix): Stroke {
  return {
    ...stroke,
    points: stroke.points.map(([x, y, p, t]) => {
      const [nx, ny] = roundPoint(applyMatrix(m, [x, y]));
      return [nx, ny, p, t];
    }),
  };
}

/** The four corners of a box turned `deg` degrees around its centre. */
export function cornersOf(box: Box, deg = 0): Point2[] {
  const [x, y, w, h] = box;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return (
    [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ] as const
  ).map(([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos] as Point2);
}

/**
 * An object carried through. Ink-made objects take their box from their ink, already carried
 * (`strokes`); line ends, crossings and cell outlines move point by point; a box, circle, glyph or
 * text keeps its shape, turned around its centre, so a skewing matrix makes the nearest rectangle.
 */
export function transformObject(
  o: SceneObject,
  m: Matrix,
  strokes: ReadonlyMap<string, Stroke> = new Map(),
): SceneObject {
  const geom = o.geom as Record<string, unknown> | undefined;
  const next: Record<string, unknown> = { ...geom };
  const points: Point2[] = [];
  for (const key of ["a", "b", "at"] as const) {
    const p = geom?.[key];
    if (Array.isArray(p)) {
      next[key] = roundPoint(applyMatrix(m, p as Point2));
      points.push(next[key] as Point2);
    }
  }
  if (Array.isArray(geom?.["poly"])) {
    next["poly"] = (geom["poly"] as Point2[]).map((p) => roundPoint(applyMatrix(m, p)));
    points.push(...(next["poly"] as Point2[]));
  }

  const ink = (o.strokes ?? []).flatMap((id) => strokes.get(id)?.points ?? []);
  if (ink.length) {
    const box = geom?.["at"]
      ? ([...(next["at"] as Point2), 0, 0] as Box)
      : boxAround(ink.map(([x, y]) => [x, y]));
    return { ...o, box, ...(geom ? { geom: next } : {}) };
  }
  if (BOXED.has(o.kind)) {
    const [x, y, w, h] = o.box;
    const r = (rotationOf(o) * Math.PI) / 180;
    // Where the box's centre goes, and where its two sides point once carried.
    const [cx, cy] = applyMatrix(m, [x + w / 2, y + h / 2]);
    const side = (dx: number, dy: number): Point2 => [m[0] * dx + m[2] * dy, m[1] * dx + m[3] * dy];
    const across = side(w * Math.cos(r), w * Math.sin(r));
    const down = side(-h * Math.sin(r), h * Math.cos(r));
    const nw = Math.hypot(...across);
    const nh = Math.hypot(...down);
    const deg = round(normalize((Math.atan2(across[1], across[0]) * 180) / Math.PI));
    delete next["rotation"];
    if (deg !== 0) next["rotation"] = deg;
    const out: SceneObject = {
      ...o,
      box: [round(cx - nw / 2), round(cy - nh / 2), round(nw), round(nh)],
    };
    if (Object.keys(next).length) out.geom = next;
    else delete out.geom;
    return out;
  }
  return {
    ...o,
    box: points.length ? boxAround(points) : carryBox(o.box, m),
    ...(geom ? { geom: next } : {}),
  };
}

/** A plain box carried through: the box around its carried corners. */
function carryBox(box: Box, m: Matrix): Box {
  return boxAround(cornersOf(box).map((p) => applyMatrix(m, p)));
}

/** Degrees in (-180, 180]. */
function normalize(deg: number): number {
  let d = deg % 360;
  if (d <= -180) d += 360;
  if (d > 180) d -= 360;
  return Math.abs(d) < 0.05 ? 0 : d;
}

/** What a selection carries: its objects that can move, the ink they're made of, and loose ink. */
export function selectionParts(
  ids: readonly string[],
  strokes: readonly Stroke[],
  objects: readonly SceneObject[],
): { strokes: Stroke[]; objects: SceneObject[] } | undefined {
  const chosen = new Set(ids);
  const picked = objects.filter((o) => chosen.has(o.id));
  const inkIds = new Set([...ids, ...picked.flatMap((o) => o.strokes ?? [])]);
  const ink = strokes.filter((s) => inkIds.has(s.id));
  if (!picked.length && !ink.length) return undefined;
  return { strokes: ink, objects: picked };
}

/** The box around a selection, as the handles frame it. */
export function selectionBounds(parts: {
  strokes: readonly Stroke[];
  objects: readonly SceneObject[];
}): Box {
  const points: Point2[] = parts.strokes.flatMap((s) => s.points.map(([x, y]) => [x, y] as Point2));
  for (const o of parts.objects) {
    if (o.strokes?.length) continue; // framed by its ink
    points.push(...cornersOf(o.box, BOXED.has(o.kind) ? rotationOf(o) : 0));
  }
  return boxAround(points);
}

/** The selection's new geometry once carried through `m`, ready for `history.reshape`. */
export function reshapeSelection(
  parts: { strokes: readonly Stroke[]; objects: readonly SceneObject[] },
  m: Matrix,
): { strokes: Stroke[]; objects: SceneObject[] } {
  const strokes = parts.strokes.map((s) => transformStroke(s, m));
  const byId = new Map(strokes.map((s) => [s.id, s]));
  return { strokes, objects: parts.objects.map((o) => transformObject(o, m, byId)) };
}
