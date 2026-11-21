// The toolbar's UI state (Zustand holds UI state only, D83): the tool and the colour.
import { create } from "zustand";
import type { SelectBy, Tool } from "./toolbar.types.ts";

/** Tools in toolbar order, with their shortcut key (D120 · D146). */
export const TOOLS: { tool: Tool; label: string; key: string }[] = [
  { tool: "select", label: "Select", key: "v" },
  { tool: "hand", label: "Hand", key: "h" },
  { tool: "pen", label: "Pen", key: "p" },
  { tool: "eraser", label: "Eraser", key: "e" },
  { tool: "box", label: "Box", key: "b" },
  { tool: "circle", label: "Circle", key: "o" },
  { tool: "arrow", label: "Arrow", key: "a" },
  { tool: "board", label: "Tic-tac-toe board", key: "g" },
  { tool: "text", label: "Text", key: "t" },
];

/** The shapes behind the one "shapes" button. */
export const SHAPE_TOOLS: Tool[] = ["box", "circle", "arrow", "board"];

/** "ink" follows the canvas (light on dark, dark on paper); the rest stay as they are. */
export const COLORS: { color: string; label: string }[] = [
  { color: "ink", label: "Ink" },
  { color: "#e03131", label: "Red" },
  { color: "#2f9e44", label: "Green" },
  { color: "#1971c2", label: "Blue" },
  { color: "#f08c00", label: "Orange" },
];

interface ToolbarState {
  tool: Tool;
  color: string;
  /** The last shape picked, shown on the shapes button. */
  shape: Tool;
  /** How the select tool picks: arrow, box or lasso, chosen under the select button. */
  selectBy: SelectBy;
  setTool(tool: Tool): void;
  /** Picks the select tool with this way of picking. */
  setSelectBy(by: SelectBy): void;
  setColor(color: string): void;
}

export const useToolbar = create<ToolbarState>((set) => ({
  tool: "pen",
  color: COLORS[0]!.color,
  shape: "box",
  selectBy: "pointer",
  setTool: (tool) => set(SHAPE_TOOLS.includes(tool) ? { tool, shape: tool } : { tool }),
  setColor: (color) => set({ color }),
  setSelectBy: (selectBy) => set({ tool: "select", selectBy }),
}));

/** The tool a key picks, if any. */
export function toolForKey(key: string): Tool | undefined {
  return TOOLS.find((t) => t.key === key.toLowerCase())?.tool;
}
