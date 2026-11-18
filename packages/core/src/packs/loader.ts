// Packs (D80 · D92): check one with the contract's schema before anything else is read, keep the
// loaded ones, and say whether the scene holds what a pack looks for (D68).
import { ContractError, Pack, type PackManifest, type SceneObject } from "@visthinker/contract";
import { arrangeCrossings, KNOWN_BLOCKS } from "../blocks/index.ts";

/** Checks a pack's files with the contract (D92). Throws bad_args with where and why. */
export function loadPack(raw: unknown): Pack {
  const parsed = Pack.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "pack";
    throw new ContractError(
      "bad_args",
      `${where}: ${issue?.message ?? "invalid pack"}`.slice(0, 900),
    );
  }
  return parsed.data;
}

/** Blocks the pack lists that this core doesn't ship; they load and do nothing yet (D80). */
export function unknownBlocks(pack: Pack): string[] {
  return pack["pack.json"].blocks.filter((b) => !(KNOWN_BLOCKS as readonly string[]).includes(b));
}

/** Layouts `match.layout` may name, as crossing rows × columns. */
export const LAYOUTS: Record<string, [number, number]> = { "two-by-two": [2, 2] };

/** Does the scene hold what the pack looks for (D68)? */
export function matchPack(
  match: PackManifest["match"],
  scene: readonly SceneObject[],
): { ok: true } | { ok: false; reason: string } {
  const lines = scene.filter((o) => o.kind === "line");
  const crossings = scene.filter((o) => o.kind === "crossing");
  if (match.lines !== undefined && lines.length !== match.lines) {
    return { ok: false, reason: `${lines.length} lines, the pack looks for ${match.lines}` };
  }
  if (match.crossings !== undefined && crossings.length !== match.crossings) {
    return {
      ok: false,
      reason: `${crossings.length} crossings, the pack looks for ${match.crossings}`,
    };
  }
  if (match.layout !== undefined) {
    const shape = LAYOUTS[match.layout];
    if (!shape) return { ok: false, reason: `unknown layout "${match.layout}"` };
    const layout = arrangeCrossings([...crossings], [...lines], ...shape);
    if ("error" in layout) return { ok: false, reason: layout.error };
  }
  return { ok: true };
}

export interface LoadedPack {
  pack: Pack;
  /** Blocks it lists that this core doesn't ship yet. */
  unknown: string[];
}

/** The packs loaded in this session, by name. A newer load of the same name replaces the older. */
export interface PackRegistry {
  load(raw: unknown): LoadedPack;
  get(name: string): LoadedPack | undefined;
  names(): string[];
}

export function createPackRegistry(initial: readonly Pack[] = []): PackRegistry {
  const packs = new Map<string, LoadedPack>();
  const registry: PackRegistry = {
    load(raw) {
      const pack = loadPack(raw);
      const loaded = { pack, unknown: unknownBlocks(pack) };
      packs.set(pack["pack.json"].name, loaded);
      return loaded;
    },
    get: (name) => packs.get(name),
    names: () => [...packs.keys()],
  };
  for (const pack of initial) registry.load(pack);
  return registry;
}
