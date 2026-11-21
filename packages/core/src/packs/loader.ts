// Packs (D80 · D92): check one with the contract's schema before anything else is read, and keep
// the loaded ones. A pack never starts on its own: the project decides what runs (D160).
import { ContractError, Pack } from "@visthinker/contract";

/** Blocks this core ships. A pack may list others: they load and do nothing yet. */
export const KNOWN_BLOCKS = ["line", "crossing", "symbol", "modes"] as const;

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

export interface LoadedPack {
  pack: Pack;
  /** Blocks it lists that this core doesn't ship yet. */
  unknown: string[];
}

/**
 * The packs loaded in this session, by name. A newer load of the same name replaces the older.
 * A pack switched off stays loaded but stops reading the drawing (D122).
 */
export interface PackRegistry {
  load(raw: unknown): LoadedPack;
  get(name: string): LoadedPack | undefined;
  names(): string[];
  enabled(name: string): boolean;
  setEnabled(name: string, on: boolean): void;
  /** The packs that are switched on. */
  active(): Pack[];
}

export function createPackRegistry(initial: readonly Pack[] = []): PackRegistry {
  const packs = new Map<string, LoadedPack>();
  const off = new Set<string>();
  const registry: PackRegistry = {
    load(raw) {
      const pack = loadPack(raw);
      const loaded = { pack, unknown: unknownBlocks(pack) };
      packs.set(pack["pack.json"].name, loaded);
      return loaded;
    },
    get: (name) => packs.get(name),
    names: () => [...packs.keys()],
    enabled: (name) => packs.has(name) && !off.has(name),
    setEnabled(name, on) {
      if (on) off.delete(name);
      else off.add(name);
    },
    active: () =>
      [...packs.values()].filter((p) => !off.has(p.pack["pack.json"].name)).map((p) => p.pack),
  };
  for (const pack of initial) registry.load(pack);
  return registry;
}
