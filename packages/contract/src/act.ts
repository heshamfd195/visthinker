import { z } from "zod";
import { Id } from "./common.ts";

/**
 * One action Claude asks for (D91). Ids only, never pixels (D24):
 * the Fast Brain decides where things go.
 */
export const AddAction = z.object({
  op: z.literal("add"),
  /** The anchor: the new object goes inside or near this one. */
  target: Id,
  detail: z.object({
    kind: z.string().min(1).max(32),
    label: z.string().max(200).optional(),
    where: z.enum(["inside", "near"]).default("inside"),
  }),
});
export const MoveAction = z.object({
  op: z.literal("move"),
  target: Id,
  detail: z.union([z.object({ inside: Id }), z.object({ near: Id })]),
});
export const MarkAction = z.object({
  op: z.literal("mark"),
  target: Id,
  /** e.g. { "shape": "O" } */
  detail: z.object({ shape: z.string().min(1).max(16) }),
});
export const LabelAction = z.object({
  op: z.literal("label"),
  target: Id,
  detail: z.object({ text: z.string().max(200) }),
});
export const RemoveAction = z.object({
  op: z.literal("remove"),
  target: Id,
  detail: z.object({}).optional(),
});

export const Action = z.discriminatedUnion("op", [
  AddAction,
  MoveAction,
  MarkAction,
  LabelAction,
  RemoveAction,
]);

/** 1–10 actions, applied in order, all or nothing (D91). */
export const ActArgs = z.object({ actions: z.array(Action).min(1).max(10) });

/**
 * What happened: one entry per event the actions made.
 * `type` is "place" for applied changes and "propose" when the action touched
 * the user's own drawing and waits for them to accept it (D91 · Policy ✅ 9).
 */
export const ActResult = z.object({
  applied: z.array(
    z.object({ seq: z.number().int().positive(), type: z.enum(["place", "propose"]), target: Id }),
  ),
});

export type Action = z.infer<typeof Action>;
export type ActArgs = z.infer<typeof ActArgs>;
export type ActResult = z.infer<typeof ActResult>;
