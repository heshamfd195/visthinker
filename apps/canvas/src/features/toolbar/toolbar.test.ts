import { beforeEach, describe, expect, it } from "vitest";
import { COLORS, TOOLS, useToolbar } from "./toolbar.store.ts";

describe("toolbar state", () => {
  beforeEach(() => useToolbar.setState({ tool: "pen", color: COLORS[0]!.color }));

  it("starts with the pen and the ink colour", () => {
    expect(useToolbar.getState()).toMatchObject({ tool: "pen", color: "#222222" });
  });

  it("switches tool and colour", () => {
    useToolbar.getState().setTool("arrow");
    useToolbar.getState().setColor("#2f9e44");
    expect(useToolbar.getState()).toMatchObject({ tool: "arrow", color: "#2f9e44" });
  });

  it("offers the pen, three shapes, a board and move, and five colours", () => {
    expect(TOOLS.map((t) => t.tool)).toEqual(["pen", "box", "circle", "arrow", "board", "move"]);
    expect(COLORS).toHaveLength(5);
  });
});
