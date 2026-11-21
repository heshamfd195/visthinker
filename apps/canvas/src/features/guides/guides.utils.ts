// The guides, the pure parts (T48 · D124): snapping, how strong they show, where they fall.

/** The point moved to the nearest grid crossing. */
export function snapPoint(p: [number, number], size: number): [number, number] {
  if (!(size > 0)) return p;
  // `+ 0` turns -0 into 0.
  return [Math.round(p[0] / size) * size + 0, Math.round(p[1] / size) * size + 0];
}

/** Guides closer than this on screen are thinned out, so zooming out stays light. */
export const MIN_SCREEN_GAP = 6;

/** The step to draw at: `size`, doubled until the gap on screen is at least `minGap` px. */
export function visibleStep(size: number, scale: number, minGap = MIN_SCREEN_GAP): number {
  if (!(size > 0) || !(scale > 0)) return size;
  let step = size;
  while (step * scale < minGap) step *= 2;
  return step;
}

/** The multiples of `step` from `start` to `end`, both inclusive. */
export function positions(start: number, end: number, step: number, offset = 0): number[] {
  if (!(step > 0) || end < start) return [];
  const out: number[] = [];
  for (let v = Math.ceil((start - offset) / step) * step + offset; v <= end; v += step) out.push(v);
  return out;
}

/** How strongly each opacity step shows the guide. */
export const GUIDE_OPACITY = { faint: 0.15, soft: 0.3, strong: 0.55 } as const;

/** Snapping follows the dots or the grid crossings; lines have nothing to snap to. */
export function canSnap(guides: { kind: string; snap: boolean }): boolean {
  return guides.snap && (guides.kind === "dots" || guides.kind === "grid");
}

/** The dash for a dotted guide, in screen pixels `px` wide: a dot, then a gap. */
export function dottedDash(px: number): [number, number] {
  return [px, 4 * px];
}
