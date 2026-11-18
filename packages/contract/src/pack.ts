import { z } from "zod";
import { CONTRACT_VERSION } from "./common.ts";
import { Who } from "./event.ts";

/** pack.json, required, checked before anything else is read (D92). */
export const PackManifest = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "lowercase letters, digits and dashes"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "semver, e.g. 0.1.0"),
  contract: z.literal(CONTRACT_VERSION),
  /** What to look for in the scene before suggesting this pack (D68). */
  match: z.looseObject({
    lines: z.number().int().nonnegative().optional(),
    crossings: z.number().int().nonnegative().optional(),
    layout: z.string().optional(),
  }),
  /** Building blocks the core ships, by name (D80). */
  blocks: z.array(z.string().min(1)).min(1),
});

/** `grid`: builds cells from the crossings, ids like "c1..c9", row by row from the top left. */
export const GridRules = z.object({
  from: z.literal("crossings"),
  rows: z.number().int().min(1).max(20),
  cols: z.number().int().min(1).max(20),
  ids: z.string().regex(/^[a-z]+1\.\.[a-z]+\d+$/, 'like "c1..c9"'),
});

/** `turns`: whose move it is, and which mark each player makes. */
export const TurnsRules = z.object({
  order: z.array(Who).min(2),
  marks: z.record(z.string(), z.string().min(1).max(16)),
});

/** `line-of`: n in a row wins; `win` lists cell numbers (1-based). */
export const LineOfRules = z.object({
  length: z.number().int().min(2),
  win: z.array(z.array(z.number().int().positive()).min(2)),
});

/** `counter`: counts objects of a kind (and one label, if given) against an optional limit. */
export const CounterRules = z.object({
  of: z.string().min(1).max(32),
  label: z.string().max(200).optional(),
  limit: z.number().int().positive().optional(),
});

/** rules.json: block wiring + data tables (D80 · D92). Unknown blocks pass through. */
export const PackRules = z.looseObject({
  grid: GridRules.optional(),
  turns: TurnsRules.optional(),
  "line-of": LineOfRules.optional(),
  counter: CounterRules.optional(),
});

/** A whole pack as it travels in `read_pack` / `write_pack`: the folder's files (D92). */
export const Pack = z
  .object({
    "pack.json": PackManifest,
    "rules.json": PackRules.optional(),
    "README.md": z.string().max(20_000).optional(),
  })
  .superRefine((pack, ctx) => {
    const blocks = new Set(pack["pack.json"].blocks);
    for (const key of Object.keys(pack["rules.json"] ?? {})) {
      if (!blocks.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["rules.json", key],
          message: `rules for "${key}", which pack.json does not list in blocks`,
        });
      }
    }
  });

export type PackManifest = z.infer<typeof PackManifest>;
export type GridRules = z.infer<typeof GridRules>;
export type TurnsRules = z.infer<typeof TurnsRules>;
export type LineOfRules = z.infer<typeof LineOfRules>;
export type CounterRules = z.infer<typeof CounterRules>;
export type PackRules = z.infer<typeof PackRules>;
export type Pack = z.infer<typeof Pack>;
