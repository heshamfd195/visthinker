// The library's pure parts (T46 · D123): the built-in items, filtering, importing symbols,
// normalising a drawing, and keeping "Yours" in this browser.

export type LibraryGroup = "artifacts" | "symbols" | "yours";
export type LibraryKind = "board" | "box" | "circle" | "arrow" | "symbol" | "drawing";
/** A stroke point: x, y, pressure, time. */
export type LibraryPoint = [number, number, number, number];
export interface LibraryStroke {
  points: LibraryPoint[];
  width: number;
}

export interface LibraryItem {
  id: string;
  group: LibraryGroup;
  name: string;
  kind: LibraryKind;
  glyph?: string;
  /** A "drawing" item's strokes, normalised so the top-left is at 0,0. */
  strokes?: LibraryStroke[];
}

export type LibraryFilter = "all" | LibraryGroup;

/** The drag payload's type: the canvas reads it on drop (D123). */
export const LIBRARY_DRAG_TYPE = "application/x-visthinker-library";
export const LIBRARY_STORAGE_KEY = "visthinker-library";

export const GROUPS: readonly { value: LibraryGroup; label: string }[] = [
  { value: "artifacts", label: "Artifacts" },
  { value: "symbols", label: "Symbols" },
  { value: "yours", label: "Yours" },
];

const ARTIFACTS: readonly { kind: LibraryKind; name: string }[] = [
  { kind: "board", name: "Board" },
  { kind: "arrow", name: "Arrow" },
  { kind: "box", name: "Box" },
  { kind: "circle", name: "Circle" },
];

const SYMBOLS: readonly { glyph: string; name: string }[] = [
  { glyph: "π", name: "Pi" },
  { glyph: "∑", name: "Sum" },
  { glyph: "√", name: "Root" },
  { glyph: "∞", name: "Infinity" },
  { glyph: "±", name: "Plus-minus" },
  { glyph: "Δ", name: "Delta" },
  { glyph: "θ", name: "Theta" },
  { glyph: "→", name: "Arrow" },
];

/** What every library has before the person adds anything. */
export const BUILT_IN: readonly LibraryItem[] = [
  ...ARTIFACTS.map((a): LibraryItem => ({
    id: `artifact-${a.kind}`,
    group: "artifacts",
    name: a.name,
    kind: a.kind,
  })),
  ...SYMBOLS.map((s, i): LibraryItem => ({
    id: `symbol-${i}`,
    group: "symbols",
    name: s.name,
    kind: "symbol",
    glyph: s.glyph,
  })),
];

/** The items in a group whose name or glyph matches the search, case-insensitive. */
export function filterItems(
  items: readonly LibraryItem[],
  filter: LibraryFilter,
  search: string,
): LibraryItem[] {
  const q = search.trim().toLowerCase();
  return items.filter(
    (item) =>
      (filter === "all" || item.group === filter) &&
      (!q || item.name.toLowerCase().includes(q) || (item.glyph ?? "").toLowerCase().includes(q)),
  );
}

let counter = 0;
/** A fresh id for a "Yours" item. */
export function newId(prefix = "yours"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

const MAX_NAME = 60;
const MAX_GLYPH = 8;

/**
 * Imported symbols: a JSON array of `{ name, glyph }`. Anything else is skipped, and text
 * that isn't JSON gives nothing.
 */
export function parseImportedSymbols(text: string, makeId: () => string = newId): LibraryItem[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const items: LibraryItem[] = [];
  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) continue;
    const { name, glyph } = entry as { name?: unknown; glyph?: unknown };
    if (typeof name !== "string" || typeof glyph !== "string") continue;
    const n = name.trim().slice(0, MAX_NAME);
    const g = glyph.trim();
    if (!n || !g || g.length > MAX_GLYPH) continue;
    items.push({ id: makeId(), group: "yours", name: n, kind: "symbol", glyph: g });
  }
  return items;
}

/** Shifts strokes so the smallest x and y are 0 (a drawing item's origin, D123). */
export function normaliseStrokes(strokes: readonly LibraryStroke[]): LibraryStroke[] {
  let minX = Infinity;
  let minY = Infinity;
  for (const s of strokes)
    for (const [x, y] of s.points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
    }
  if (!Number.isFinite(minX)) return strokes.map((s) => ({ ...s, points: [] }));
  return strokes.map((s) => ({
    width: s.width,
    points: s.points.map(([x, y, p, t]): LibraryPoint => [x - minX, y - minY, p, t]),
  }));
}

/** SVG paths and a square viewBox for a drawing's preview tile. */
export function strokesPreview(strokes: readonly LibraryStroke[]): {
  paths: string[];
  viewBox: string;
} {
  let maxX = 0;
  let maxY = 0;
  const paths: string[] = [];
  for (const s of strokes) {
    if (!s.points.length) continue;
    paths.push(s.points.map(([x, y], i) => `${i ? "L" : "M"}${round(x)} ${round(y)}`).join(" "));
    for (const [x, y] of s.points) {
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const side = Math.max(maxX, maxY, 1);
  const pad = side * 0.1;
  // Centre the drawing in a square box.
  const left = (maxX - side) / 2 - pad;
  const top = (maxY - side) / 2 - pad;
  const size = side + pad * 2;
  return { paths, viewBox: `${round(left)} ${round(top)} ${round(size)} ${round(size)}` };
}

const round = (n: number) => Math.round(n * 10) / 10;

/** The bit of Storage the library needs, so tests can pass a fake one. */
export type LibraryStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): LibraryStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function isItem(value: unknown): value is LibraryItem {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<LibraryItem>;
  return (
    typeof v.id === "string" &&
    v.group === "yours" &&
    typeof v.name === "string" &&
    typeof v.kind === "string"
  );
}

/** The person's own items, or none if storage is missing, blocked or holds junk. */
export function loadYours(storage: LibraryStorage | undefined = browserStorage()): LibraryItem[] {
  try {
    const raw = storage?.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isItem) : [];
  } catch {
    return [];
  }
}

/** Keeps the person's own items; false when the browser won't store them. */
export function saveYours(
  items: readonly LibraryItem[],
  storage: LibraryStorage | undefined = browserStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
