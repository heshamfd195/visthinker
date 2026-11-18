import { z } from "zod";
import { Id } from "./common.ts";
import { VisEvent, Who } from "./event.ts";
import { SceneObject } from "./scene.ts";
import { Stroke } from "./stroke.ts";

/** A chat with Claude inside a project (D125). */
export const ChatMeta = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(80),
  createdAt: z.number().int().nonnegative(),
});

/** A project is one canvas with many chats (D125), saved on disk by the bridge (D142). */
export const ProjectMeta = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/, "lowercase letters, digits and dashes"),
  name: z.string().min(1).max(80),
  updatedAt: z.number().int().nonnegative(),
  /** A small picture of the canvas, as a data URL. */
  thumbnail: z
    .string()
    .max(200_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,/)
    .optional(),
  chats: z.array(ChatMeta).max(200),
});

/** Everything needed to bring a canvas back: its story, ink, scene and undo history. */
export const Snapshot = z.object({
  version: z.literal(1),
  events: z.array(VisEvent).max(50_000),
  strokes: z.array(Stroke).max(20_000),
  objects: z.array(z.object({ object: SceneObject, owner: Who })).max(20_000),
  history: z.object({
    hidden: z.array(Id),
    saved: z.array(z.tuple([z.number().int(), z.unknown()])),
  }),
});

export const Project = z.object({ meta: ProjectMeta, snapshot: Snapshot });

/** Behaviour settings the bridge and Claude read too, kept on disk (D143). */
export const BehaviourSettings = z.object({
  /** Ask Claude when the Fast Brain isn't sure what was drawn. */
  askClaudeWhenUnsure: z.boolean().default(true),
  /** Save game stories for later, only if the person opts in (D47). */
  saveStories: z.boolean().default(false),
});

export type ChatMeta = z.infer<typeof ChatMeta>;
export type ProjectMeta = z.infer<typeof ProjectMeta>;
export type Snapshot = z.infer<typeof Snapshot>;
export type Project = z.infer<typeof Project>;
export type BehaviourSettings = z.infer<typeof BehaviourSettings>;
