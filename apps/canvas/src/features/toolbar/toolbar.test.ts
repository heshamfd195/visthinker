import { beforeEach, describe, expect, it } from "vitest";
import { COLORS, TOOLS, toolForKey, useToolbar } from "./toolbar.store.ts";

describe("toolbar state (D120)", () => {
  beforeEach(() => useToolbar.setState({ tool: "pen", color: COLORS[0]!.color, shape: "box" }));

  it("starts with the pen and the ink colour, which follows the canvas", () => {
    expect(useToolbar.getState()).toMatchObject({ tool: "pen", color: "ink" });
  });

  it("switches tool and colour, and remembers the last shape", () => {
    useToolbar.getState().setTool("arrow");
    useToolbar.getState().setColor("#2f9e44");
    useToolbar.getState().setTool("pen");
    expect(useToolbar.getState()).toMatchObject({ tool: "pen", color: "#2f9e44", shape: "arrow" });
  });

  it("offers select, hand, pen, eraser, shapes and text, each with its own key (D146)", () => {
    expect(TOOLS.map((t) => t.tool)).toEqual([
      "select",
      "hand",
      "pen",
      "eraser",
      "box",
      "circle",
      "arrow",
      "board",
      "text",
    ]);
    expect(new Set(TOOLS.map((t) => t.key)).size).toBe(TOOLS.length);
    expect(toolForKey("P")).toBe("pen");
    expect(toolForKey("z")).toBeUndefined();
    expect(COLORS).toHaveLength(5);
  });
});
