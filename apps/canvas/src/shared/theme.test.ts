import { describe, expect, it } from "vitest";
import { applyTheme, currentTheme } from "./theme.ts";

// A stand-in for <html>: only its class list matters here.
function fakeRoot(): HTMLElement {
  const classes = new Set<string>();
  const classList = {
    contains: (c: string) => classes.has(c),
    toggle: (c: string, on?: boolean) => {
      const add = on ?? !classes.has(c);
      if (add) classes.add(c);
      else classes.delete(c);
      return add;
    },
  };
  return { classList } as unknown as HTMLElement;
}

describe("theme", () => {
  it("starts light", () => {
    expect(currentTheme(fakeRoot())).toBe("light");
  });

  it("switches to dark and back", () => {
    const root = fakeRoot();
    applyTheme("dark", root);
    expect(currentTheme(root)).toBe("dark");
    applyTheme("light", root);
    expect(currentTheme(root)).toBe("light");
  });
});

describe("paint", () => {
  it("turns ink light on a dark canvas and dark on paper", async () => {
    const { paint } = await import("./theme.ts");
    expect(paint("ink", "black")).toBe("#e8e8e8");
    expect(paint("#222222", "black")).toBe("#e8e8e8");
    expect(paint("ink", "paper")).toBe("#222222");
    expect(paint("#e03131", "black")).toBe("#e03131");
  });
});
