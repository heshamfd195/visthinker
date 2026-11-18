import type { Box, Point2 } from "@visthinker/contract";

/** Drags shorter than this place nothing: a click isn't a shape. */
export const MIN_DRAG = 6;

/** The box a drag covers, whichever way it went. */
export function dragBox(from: Point2, to: Point2): Box {
  return [
    Math.min(from[0], to[0]),
    Math.min(from[1], to[1]),
    Math.abs(to[0] - from[0]),
    Math.abs(to[1] - from[1]),
  ];
}

export function isRealDrag(from: Point2, to: Point2): boolean {
  return Math.hypot(to[0] - from[0], to[1] - from[1]) >= MIN_DRAG;
}
