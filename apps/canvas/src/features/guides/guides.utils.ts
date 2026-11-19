// Grid and lines, the pure parts (T48 · D124): snapping and where the guides fall.

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
