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

/** Claude's ink: the notes it adds through act. */
export const CLAUDE_COLOR = "#7048e8";

/**
 * What each symbol was read as, from its recognized event (D97): "X 87%", "?", and the runner-up
 * when it came close, e.g. "O 61% · 0?".
 */
export function symbolTags(events: readonly VisEvent[]): Map<string, string> {
  const tags = new Map<string, string>();
  for (const e of events) {
    const d = e.detail;
    if (e.type !== "recognized" || d?.["kind"] !== "symbol" || !e.target) continue;
    const label = String(d["label"]);
    const score = typeof d["score"] === "number" ? d["score"] : 0;
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    const alt = Array.isArray(d["alternatives"])
      ? (d["alternatives"][0] as { label?: string; score?: number } | undefined)
      : undefined;
    const close = alt?.label && typeof alt.score === "number" && score - alt.score < 0.05;
    tags.set(
      e.target,
      label === "?" ? "?" : `${label} ${pct(score)}${close ? ` · ${alt!.label}?` : ""}`,
    );
  }
  return tags;
}
