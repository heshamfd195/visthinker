import { z } from "zod";
import { Box, Id, Point2 } from "./common.ts";

export const Relation = z.object({
  /** `inside` · `touching` · `connected` · `on` · `crosses` · … (D79 · D89) */
  type: z.string().min(1).max(32),
  to: Id,
});

/** Exact geometry (D89): `a`/`b` for a line, `at` for a crossing. */
export const LineGeom = z.object({ a: Point2, b: Point2 });
export const CrossingGeom = z.object({ at: Point2 });
/**
 * A cell's shape as the drawn lines make it (D95): 4 corners, clockwise from the top left.
 * `box` stays as the rough outline around it.
 */
export const PolyGeom = z.object({ poly: z.array(Point2).min(3).max(16) });
export const Geom = z.union([LineGeom, CrossingGeom, PolyGeom, z.record(z.string(), z.unknown())]);

/** Something on the canvas now (D79, with D89's optional `strokes` and `geom`). */
export const SceneObject = z.object({
  id: Id,
  kind: z.string().min(1).max(32),
  label: z.string().max(200),
  /** Which knowledge pack recognized it. */
  pack: z.string().min(1).max(64),
  /** Ids of objects inside it. */
  parts: z.array(Id).default([]),
  relations: z.array(Relation).default([]),
  box: Box,
  confidence: z.number().min(0).max(1),
  /** Ids of the strokes that made it, for `get_strokes` (D89). */
  strokes: z.array(Id).optional(),
  geom: Geom.optional(),
});
// A mark such as "X" or "O" is its own object: kind "mark", label "O", relation inside its cell.

export type Relation = z.infer<typeof Relation>;
export type LineGeom = z.infer<typeof LineGeom>;
export type CrossingGeom = z.infer<typeof CrossingGeom>;
export type PolyGeom = z.infer<typeof PolyGeom>;
export type SceneObject = z.infer<typeof SceneObject>;
