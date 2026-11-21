import type { Stroke, StrokePoint } from "@visthinker/contract";
import { getStroke } from "perfect-freehand";
import type { PenStyle, RawPoint } from "./ink.types.ts";

/** "ink" follows the canvas: light on a dark canvas, dark on paper (D119 · D128). */
export const PEN: PenStyle = { color: "ink", width: 4 };

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** A mouse has no real pressure: 0.5 (D88). A pen's pressure is kept between 0 and 1. */
export function pressureOf(pointerType: string, pressure: number): number {
  if (pointerType === "mouse" || !Number.isFinite(pressure) || pressure <= 0) return 0.5;
  return Math.min(1, pressure);
}

/** A finished stroke in the contract's shape (D88): `[x, y, pressure, dt]`, one decimal, raw. */
export function toStroke(id: string, raw: RawPoint[], pen: PenStyle = PEN): Stroke {
  const t0 = raw[0]?.time ?? 0;
  const points: StrokePoint[] = raw.map((p) => [
    round1(p.x),
    round1(p.y),
    round2(p.pressure),
    Math.max(0, Math.round(p.time - t0)),
  ]);
  return {
    id,
    t0: Math.max(0, Math.round(t0)),
    tool: "pen",
    color: pen.color,
    width: pen.width,
    points,
  };
}

/**
 * The filled outline perfect-freehand draws for these points, flat for a closed Konva.Line.
 * `last` marks a finished stroke, so the outline reaches its final point instead of lagging behind.
 */
export function outline(
  raw: RawPoint[],
  width: number = PEN.width,
  last = false,
  smoothing = 0.5,
): number[] {
  const input = raw.map((p) => [p.x, p.y, p.pressure]);
  return getStroke(input, {
    size: width * 1.6,
    thinning: 0.5,
    smoothing,
    streamline: 0.4,
    last,
  }).flat();
}

/** A short press with little movement is a tap, not a stroke. */
export const TAP = { maxMs: 300, maxMove: 6 } as const;

export function isTap(raw: RawPoint[]): boolean {
  const first = raw[0];
  const last = raw.at(-1);
  if (!first || !last) return false;
  if (last.time - first.time > TAP.maxMs) return false;
  return raw.every((p) => Math.hypot(p.x - first.x, p.y - first.y) <= TAP.maxMove);
}

/** A recorded stroke's points as pointer samples again, to draw it. */
export function samplesOf(stroke: Stroke): RawPoint[] {
  return stroke.points.map(([x, y, pressure, dt]) => ({ x, y, pressure, time: stroke.t0 + dt }));
}
