// The PackSource port: where the core finds installed packs (starter packs, local packs).
// The core reads files through it and checks them itself (D92); it never touches a disk.
import type { Pack } from "@visthinker/contract";

export interface PackSource {
  names(): string[];
  /** The pack's files, unchecked: the loader checks them (D92). Undefined if not installed. */
  read(name: string): unknown;
}

/** Packs held in memory, by name. Takes valid packs, or raw files by name to test the checks. */
export function createMemoryPackSource(packs: Pack[] | Record<string, unknown> = []): PackSource {
  const byName = new Map<string, unknown>(
    Array.isArray(packs) ? packs.map((p) => [p["pack.json"].name, p]) : Object.entries(packs),
  );
  return {
    names: () => [...byName.keys()],
    read(name) {
      const files = byName.get(name);
      return files === undefined ? undefined : structuredClone(files);
    },
  };
}
