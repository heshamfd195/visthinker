import { describe, expect, it } from "vitest";
import {
  BUILT_IN,
  filterItems,
  LIBRARY_STORAGE_KEY,
  loadYours,
  normaliseStrokes,
  parseImportedSymbols,
  saveYours,
  strokesPreview,
  type LibraryItem,
  type LibraryStorage,
} from "./library.utils.ts";

const fakeStorage = (start: Record<string, string> = {}) => {
  const data = { ...start };
  const storage: LibraryStorage = {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
  return { storage, data };
};

const ids = () => {
  let n = 0;
  return () => `y${++n}`;
};

describe("built-in items (D123)", () => {
  it("has three artifacts and eight symbols, ids unique", () => {
    const artifacts = BUILT_IN.filter((i) => i.group === "artifacts");
    const symbols = BUILT_IN.filter((i) => i.group === "symbols");
    expect(artifacts.map((a) => a.kind)).toEqual(["arrow", "box", "circle"]);
    expect(symbols.map((s) => s.glyph)).toEqual(["π", "∑", "√", "∞", "±", "Δ", "θ", "→"]);
    expect(symbols.every((s) => s.kind === "symbol")).toBe(true);
    expect(new Set(BUILT_IN.map((i) => i.id)).size).toBe(BUILT_IN.length);
  });
});

describe("filterItems", () => {
  const mine: LibraryItem = { id: "m", group: "yours", name: "My drawing", kind: "drawing" };
  const all = [...BUILT_IN, mine];

  it("all shows everything; a group shows only its own", () => {
    expect(filterItems(all, "all", "")).toHaveLength(all.length);
    expect(filterItems(all, "yours", "")).toEqual([mine]);
    expect(filterItems(all, "artifacts", "").every((i) => i.group === "artifacts")).toBe(true);
  });

  it("searches names and glyphs, ignoring case and spaces", () => {
    expect(filterItems(all, "all", "  BOX ").map((i) => i.id)).toEqual(["artifact-box"]);
    expect(filterItems(all, "all", "θ").map((i) => i.name)).toEqual(["Theta"]);
    expect(filterItems(all, "all", "Δ").map((i) => i.name)).toEqual(["Delta"]);
    expect(filterItems(all, "symbols", "arrow").map((i) => i.glyph)).toEqual(["→"]);
    expect(filterItems(all, "all", "nothing like it")).toEqual([]);
  });
});

describe("parseImportedSymbols", () => {
  it("keeps valid {name, glyph} entries as Yours symbols", () => {
    const text = JSON.stringify([
      { name: "Lambda", glyph: "λ" },
      { name: " Integral ", glyph: "∫" },
      { name: "no glyph" },
      { glyph: "x" },
      { name: "", glyph: "y" },
      { name: "too long", glyph: "abcdefghij" },
      42,
      null,
    ]);
    expect(parseImportedSymbols(text, ids())).toEqual([
      { id: "y1", group: "yours", name: "Lambda", kind: "symbol", glyph: "λ" },
      { id: "y2", group: "yours", name: "Integral", kind: "symbol", glyph: "∫" },
    ]);
  });

  it("gives nothing for text that isn't a JSON array", () => {
    expect(parseImportedSymbols("not json")).toEqual([]);
    expect(parseImportedSymbols('{"name":"a","glyph":"b"}')).toEqual([]);
  });
});

describe("normaliseStrokes (D123)", () => {
  it("shifts so the smallest x and y are 0, keeping pressure, time and width", () => {
    const out = normaliseStrokes([
      {
        width: 4,
        points: [
          [110, 220, 0.5, 0],
          [150, 200, 0.6, 16],
        ],
      },
      { width: 2, points: [[100, 260, 0.5, 40]] },
    ]);
    expect(out).toEqual([
      {
        width: 4,
        points: [
          [10, 20, 0.5, 0],
          [50, 0, 0.6, 16],
        ],
      },
      { width: 2, points: [[0, 60, 0.5, 40]] },
    ]);
  });

  it("leaves empty strokes empty", () => {
    expect(normaliseStrokes([{ width: 1, points: [] }])).toEqual([{ width: 1, points: [] }]);
  });
});

describe("strokesPreview", () => {
  it("draws each stroke as a path in a square box around it", () => {
    const { paths, viewBox } = strokesPreview([
      {
        width: 4,
        points: [
          [0, 0, 0.5, 0],
          [100, 50, 0.5, 1],
        ],
      },
      { width: 4, points: [] },
    ]);
    expect(paths).toEqual(["M0 0 L100 50"]);
    expect(viewBox).toBe("-10 -35 120 120");
  });
});

describe("Yours in storage", () => {
  const item: LibraryItem = {
    id: "y1",
    group: "yours",
    name: "Lambda",
    kind: "symbol",
    glyph: "λ",
  };

  it("saves and loads the same items", () => {
    const { storage, data } = fakeStorage();
    expect(saveYours([item], storage)).toBe(true);
    expect(JSON.parse(data[LIBRARY_STORAGE_KEY]!)).toEqual([item]);
    expect(loadYours(storage)).toEqual([item]);
  });

  it("loads nothing from empty, junk or throwing storage", () => {
    expect(loadYours(fakeStorage().storage)).toEqual([]);
    expect(loadYours(fakeStorage({ [LIBRARY_STORAGE_KEY]: "{oops" }).storage)).toEqual([]);
    expect(
      loadYours(
        fakeStorage({ [LIBRARY_STORAGE_KEY]: JSON.stringify([item, { id: 1 }, "x"]) }).storage,
      ),
    ).toEqual([item]);
    const throwing: LibraryStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadYours(throwing)).toEqual([]);
    expect(saveYours([item], throwing)).toBe(false);
  });
});
