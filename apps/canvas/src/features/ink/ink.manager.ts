// The ink manager: turns pointer samples into finished strokes. No Konva, no React,
// so it is tested alone; InkLayer draws, this decides.
import type { Stroke } from "@visthinker/contract";
import type { PenStyle, RawPoint } from "./ink.types.ts";
import { isTap, PEN, toStroke } from "./ink.utils.ts";

export type InkResult = { kind: "stroke"; stroke: Stroke } | { kind: "tap"; at: RawPoint } | null;

export interface InkManager {
  begin(point: RawPoint): void;
  extend(point: RawPoint): void;
  /** Ends the stroke: a stroke to record, a tap, or null if nothing was drawing. */
  end(): InkResult;
  /** The points of the stroke being drawn, for the live outline. */
  live(): readonly RawPoint[];
  drawing(): boolean;
}

export function createInkManager(nextId: () => string, pen: PenStyle = PEN): InkManager {
  let raw: RawPoint[] | null = null;
  return {
    begin(point) {
      raw = [point];
    },
    extend(point) {
      raw?.push(point);
    },
    end() {
      const points = raw;
      raw = null;
      if (!points?.length) return null;
      if (isTap(points)) return { kind: "tap", at: points[0]! };
      return { kind: "stroke", stroke: toStroke(nextId(), points, pen) };
    },
    live: () => raw ?? [],
    drawing: () => raw !== null,
  };
}
