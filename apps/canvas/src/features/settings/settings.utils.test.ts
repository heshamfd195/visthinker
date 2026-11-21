import { describe, expect, it } from "vitest";
import { SECTIONS, SHORTCUTS } from "./settings.utils.ts";

describe("settings", () => {
  it("gives every shortcut its own label and its own keys", () => {
    const labels = SHORTCUTS.map(([label]) => label);
    const keys = SHORTCUTS.map(([, k]) => k);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => k.length > 0)).toBe(true);
  });

  it("has seven sections, appearance first and about last (D128)", () => {
    expect(SECTIONS).toHaveLength(7);
    expect(SECTIONS[0]!.id).toBe("appearance");
    expect(SECTIONS.at(-1)!.id).toBe("about");
  });
});
