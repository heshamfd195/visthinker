import type { Box, Point2, VisEvent } from "@visthinker/contract";

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

/** Claude's ink: the marks and notes it adds through act. */
export const CLAUDE_COLOR = "#7048e8";
export const USER_COLOR = "#222222";

/** Each mark's colour from who made it, read from the place event that put it down. */
export function markColors(events: readonly VisEvent[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const e of events) {
    const mark = e.type === "place" ? e.detail?.["mark"] : undefined;
    if (typeof mark === "string")
      colors.set(mark, e.detail?.["by"] === "claude" ? CLAUDE_COLOR : USER_COLOR);
  }
  return colors;
}
