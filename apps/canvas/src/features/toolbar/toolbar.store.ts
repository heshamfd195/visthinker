// The toolbar's UI state (Zustand holds UI state only, D83): the tool and the colour.
import { create } from "zustand";
import type { Tool } from "./toolbar.types.ts";

export const TOOLS: { tool: Tool; label: string; icon: string }[] = [
  { tool: "pen", label: "Pen", icon: "✎" },
  { tool: "box", label: "Box", icon: "▭" },
  { tool: "circle", label: "Circle", icon: "◯" },
  { tool: "arrow", label: "Arrow", icon: "→" },
  { tool: "board", label: "Tic-tac-toe board", icon: "#" },
  { tool: "move", label: "Move", icon: "✥" },
];

export const COLORS: { color: string; label: string }[] = [
  { color: "#222222", label: "Ink" },
  { color: "#e03131", label: "Red" },
  { color: "#2f9e44", label: "Green" },
  { color: "#1971c2", label: "Blue" },
  { color: "#f08c00", label: "Orange" },
];

interface ToolbarState {
  tool: Tool;
  color: string;
  setTool(tool: Tool): void;
  setColor(color: string): void;
}

export const useToolbar = create<ToolbarState>((set) => ({
  tool: "pen",
  color: COLORS[0]!.color,
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
}));
