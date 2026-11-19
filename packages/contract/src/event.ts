import { z } from "zod";
import { Box, Id } from "./common.ts";

/** Who caused an event (D79). */
export const Who = z.enum(["user", "fastbrain", "claude", "api"]);

/** Known event types; packs may add more, so any short name is accepted (D79). */
export const KNOWN_EVENT_TYPES = [
  "stroke",
  "recognized",
  "mark",
  "move",
  "place",
  "label",
  "remove",
  "undo",
  "redo",
  "clear",
  "erase",
  "say",
  "ask",
  "answer",
  "pack",
  "message",
  "takeback",
  "mode",
] as const;
export const EventType = z.string().min(1).max(32);

/** Something that happened. The story is append-only (D78). */
export const VisEvent = z.object({
  /** Order, never reused, starts at 1. */
  seq: z.number().int().positive(),
  /** Milliseconds since the session started. */
  t: z.number().nonnegative(),
  who: Who,
  type: EventType,
  /** The scene object's id (or the stroke's id for a `stroke` event). */
  target: Id.optional(),
  /** Small, type-specific data. */
  detail: z.record(z.string(), z.unknown()).optional(),
  /** The `seq` this event reacts to. */
  cause: z.number().int().positive().optional(),
});

/** The `detail` of a `stroke` event: no points, those come through `get_strokes` (D76 · D88). */
export const StrokeEventDetail = z.object({ box: Box, points: z.number().int().positive() });

/** The `detail` of a `recognized` event (D89). */
export const RecognizedEventDetail = z.object({ kind: z.string().min(1) });

export type Who = z.infer<typeof Who>;
export type VisEvent = z.infer<typeof VisEvent>;
export type StrokeEventDetail = z.infer<typeof StrokeEventDetail>;
export type RecognizedEventDetail = z.infer<typeof RecognizedEventDetail>;
