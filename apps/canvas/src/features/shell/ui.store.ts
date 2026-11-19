// The UI's own state (Zustand holds UI state only, D83): how things look, kept in this browser
// (D143). How things behave lives on disk with the bridge.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CanvasColor, ThemeMode } from "../../shared/theme.ts";

/** Open, collapsed or focus (D121). */
export type LayoutState = "open" | "collapsed" | "focus";
export type SidePanel = "library" | "packs";
export type GridKind = "none" | "dots" | "squares";
export type LinesKind = "none" | "ruled" | "writing";
export type TextSize = "s" | "m" | "l";

export interface Look {
  theme: ThemeMode;
  canvas: CanvasColor;
  textSize: TextSize;
  claudeSerif: boolean;
  showRead: boolean;
  showScore: boolean;
  penSize: number;
  smoothing: number;
  grid: { kind: GridKind; size: number; snap: boolean };
  lines: { kind: LinesKind; spacing: number };
}

export interface UiState extends Look {
  layout: LayoutState;
  projectsOpen: boolean;
  side: SidePanel | undefined;
  chatOpen: boolean;
  eventsOpen: boolean;
  settingsOpen: boolean;
  /** Ids selected on the canvas; they travel with a message (D135). */
  selection: string[];
  /** What the events box or a chip points at, highlighted on the canvas (D126 · D127). */
  pointAt: string | undefined;
  zoom: number;
  setLayout(layout: LayoutState): void;
  set(patch: Partial<Omit<UiState, "set" | "setLayout">>): void;
}

export const DEFAULT_LOOK: Look = {
  theme: "dark",
  canvas: "black",
  textSize: "m",
  claudeSerif: true,
  showRead: true,
  showScore: true,
  penSize: 4,
  smoothing: 0.5,
  grid: { kind: "none", size: 24, snap: false },
  lines: { kind: "none", spacing: 48 },
};

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      ...DEFAULT_LOOK,
      layout: "collapsed",
      projectsOpen: false,
      side: undefined,
      chatOpen: false,
      eventsOpen: false,
      settingsOpen: false,
      selection: [],
      pointAt: undefined,
      zoom: 1,
      // Open shows every panel, collapsed shrinks them, focus hides all but one button (D121).
      setLayout: (layout) =>
        set((s) =>
          layout === "open"
            ? {
                layout,
                projectsOpen: true,
                side: s.side ?? "packs",
                chatOpen: true,
                eventsOpen: true,
              }
            : layout === "collapsed"
              ? { layout, projectsOpen: false, side: undefined, chatOpen: false, eventsOpen: false }
              : { layout },
        ),
      set: (patch) => set(patch),
    }),
    {
      name: "visthinker-ui",
      // Selection, pointing and open windows are for this visit only.
      partialize: (state) => {
        const rest: Partial<UiState> = { ...state };
        for (const key of ["selection", "pointAt", "settingsOpen", "set", "setLayout"] as const)
          delete rest[key];
        return rest;
      },
    },
  ),
);
