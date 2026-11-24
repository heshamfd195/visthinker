// Drag select: a box, or with Alt a lasso. Pure, so it is tested alone; InkLayer draws the region.
import type { SceneObject, Stroke } from "@visthinker/contract";

export type Point = readonly [number, number];

/** What the drag drew: a box from corner to corner, or the lasso's loop. */
export type Region = { kind: "box"; from: Point; to: Point } | { kind: "lasso"; points: Point[] };

/** Shorter than this, in screen pixels, a drag is a click: it clears the selection instead. */
export const SELECT_MIN_DRAG = 4;

/** The select outline's dash and gap, in screen pixels: long enough to read as dashed. */
export const SELECT_DASH = [8, 6] as const;

/** How fast the dashes march along the outline, in screen pixels a second. */
export const SELECT_MARCH = 24;

function inBox(p: Point, from: Point, to: Point): boolean {
  return (
    p[0] >= Math.min(from[0], to[0]) &&
    p[0] <= Math.max(from[0], to[0]) &&
    p[1] >= Math.min(from[1], to[1]) &&
    p[1] <= Math.max(from[1], to[1])
  );
}

/** Even-odd ray casting: is the point inside the closed loop? */
function inLoop(p: Point, loop: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, yi] = loop[i]!;
    const [xj, yj] = loop[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

export function inRegion(p: Point, region: Region): boolean {
  return region.kind === "box"
    ? inBox(p, region.from, region.to)
    : region.points.length > 2 && inLoop(p, region.points);
}

/** The region's size on screen, to tell a drag from a click. */
export function regionSpan(region: Region): number {
  const pts = region.kind === "box" ? [region.from, region.to] : region.points;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

const corners = ([x, y, w, h]: readonly number[]): Point[] => [
  [x!, y!],
  [x! + w!, y!],
  [x!, y! + h!],
  [x! + w!, y! + h!],
];

/**
 * What a region selects: whatever lies wholly inside it. An object counts when its box does; a
 * loose stroke when all its points do. Ink that made an object (a recognized symbol or shape)
 * is selected through that object, as a click would; a part of something selected goes with its
 * whole instead of being listed twice.
 */
export function selectInRegion(
  region: Region,
  strokes: readonly Stroke[],
  objects: readonly SceneObject[],
): string[] {
  const picked = objects.filter((o) => corners(o.box).every((c) => inRegion(c, region)));
  const parts = new Set(picked.flatMap((o) => o.parts));
  const owned = new Set(objects.flatMap((o) => o.strokes ?? []));
  const wholes = picked.filter((o) => !parts.has(o.id)).map((o) => o.id);
  const loose = strokes
    .filter((s) => !owned.has(s.id) && s.points.every((p) => inRegion([p[0], p[1]], region)))
    .map((s) => s.id);
  return [...wholes, ...loose];
}

/**
 * The selection without what has left the canvas (undone, erased, cleared): only ids still drawn.
 * The same array back when nothing went, so a store isn't updated for nothing.
 */
export function liveSelection(
  selection: readonly string[],
  strokes: readonly Stroke[],
  objects: readonly SceneObject[],
): readonly string[] {
  const live = new Set([...strokes.map((s) => s.id), ...objects.map((o) => o.id)]);
  const kept = selection.filter((id) => live.has(id));
  return kept.length === selection.length ? selection : kept;
}
