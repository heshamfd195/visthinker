// The `line-of` block (D80 · D92): n of the same mark in a row wins; a full board without one is a draw.
import type { LineOfRules } from "@visthinker/contract";

export type Outcome =
  | { over: false }
  | { over: true; mark: string; line: string[] }
  | { over: true; mark: null; line: [] };

/**
 * `cells` are the grid's ids in order (c1..c9), so the rules' 1-based numbers index them.
 * `markIn` gives the mark in a cell, or undefined for an empty one.
 */
export function checkLines(
  rules: LineOfRules,
  cells: string[],
  markIn: (cell: string) => string | undefined,
): Outcome {
  for (const numbers of rules.win) {
    const line = numbers.map((n) => cells[n - 1]);
    if (line.some((id) => id === undefined)) continue;
    const marks = (line as string[]).map(markIn);
    const first = marks[0];
    if (first !== undefined && marks.length >= rules.length && marks.every((m) => m === first))
      return { over: true, mark: first, line: line as string[] };
  }
  if (cells.every((id) => markIn(id) !== undefined)) return { over: true, mark: null, line: [] };
  return { over: false };
}
