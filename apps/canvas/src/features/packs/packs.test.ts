import { describe, expect, it } from "vitest";
import { filterPacks, isMode, packIcon, packTag, splitPacks, type PackRow } from "./packs.utils.ts";

const row = (name: string, extra: Partial<PackRow> = {}): PackRow => ({
  name,
  version: "1.0.0",
  source: "starter",
  installed: true,
  enabled: true,
  yours: false,
  ...extra,
});

const rows = [
  row("modes"),
  row("maths", { note: "3 of your examples" }),
  row("shapes"),
  row("chess", { installed: false, source: "api" }),
  row("bingo", { installed: false, source: "api" }),
];

describe("splitPacks", () => {
  it("puts installed packs by name with modes last, then the catalog", () => {
    const { installed, catalog } = splitPacks(rows);
    expect(installed.map((r) => r.name)).toEqual(["maths", "shapes", "modes"]);
    expect(catalog.map((r) => r.name)).toEqual(["bingo", "chess"]);
  });
});

describe("filterPacks", () => {
  it("matches the name or the note, ignoring case", () => {
    expect(filterPacks(rows, "MAT").map((r) => r.name)).toEqual(["maths"]);
    expect(filterPacks(rows, "examples").map((r) => r.name)).toEqual(["maths"]);
    expect(filterPacks(rows, "  ")).toHaveLength(rows.length);
    expect(filterPacks(rows, "zzz")).toEqual([]);
  });
});

describe("icons and tags", () => {
  it("knows a mode pack", () => {
    expect(isMode("modes")).toBe(true);
    expect(isMode("focus-mode")).toBe(true);
    expect(isMode("shapes")).toBe(false);
  });

  it("picks an icon by name", () => {
    expect(packIcon("shapes")).toBe("shapes");
    expect(packIcon("modes")).toBe("modes");
    expect(packIcon("hand-drawn-arrows")).toBe("pen");
    expect(packIcon("chess")).toBe("package");
  });

  it("tags your copy before the source", () => {
    expect(packTag(row("a"))).toBe("starter");
    expect(packTag(row("a", { source: "local" }))).toBe("local");
    expect(packTag(row("a", { source: "api" }))).toBe("catalog");
    expect(packTag(row("a", { yours: true }))).toBe("your copy");
  });
});
