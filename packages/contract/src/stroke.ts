import { z } from "zod";
import { Id } from "./common.ts";

/**
 * One captured point, as a short list (D88):
 * x and y in world units (one decimal), pressure 0–1 (0.5 for a mouse),
 * dt in milliseconds since the stroke's first point.
 */
export const StrokePoint = z.tuple([
  z.number(),
  z.number(),
  z.number().min(0).max(1),
  z.number().nonnegative(),
]);

/** What the pen drew, stored raw and never smoothed (D88). */
export const Stroke = z.object({
  id: Id,
  /** When it started, on the session clock (same clock as an event's `t`). */
  t0: z.number().nonnegative(),
  /** The drawing tool, e.g. "pen". */
  tool: z.string().min(1).max(16),
  color: z.string().min(1).max(32),
  width: z.number().positive(),
  points: z.array(StrokePoint).min(1),
});

export type StrokePoint = z.infer<typeof StrokePoint>;
export type Stroke = z.infer<typeof Stroke>;
