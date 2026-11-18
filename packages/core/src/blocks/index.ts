// Building blocks the core ships (D80): packs wire them together and fill their tables.
export * from "./grid.ts";
export * from "./board.ts";
export * from "./turns.ts";
export * from "./line-of.ts";
export * from "./counter.ts";

/** Blocks this core ships. A pack may list others: they load and do nothing yet. */
export const KNOWN_BLOCKS = ["grid", "turns", "line-of", "counter"] as const;
