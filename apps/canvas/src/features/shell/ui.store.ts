// The UI's own state (Zustand holds UI state only, D83): how things look, kept in this browser
// (D143). How things behave lives on disk with the bridge.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CanvasColor, ThemeMode } from "../../shared/theme.ts";

/** Open, collapsed or focus (D121). */
export type LayoutState = "open" | "collapsed" | "focus";
export type SidePanel = "library" | "packs";
/** One background guide at a time (D124): dots, a squared grid, or writing lines. */
export type GuideKind = "none" | "dots" | "grid" | "lines";
/** How strongly the guide shows: three steps. */
export type GuideOpacity = "faint" | "soft" | "strong";

export interface Guides {
  kind: GuideKind;
  /** The gap between dots, grid lines or writing lines, in world units. */
  size: number;
  /** Placed things snap to the dots or grid crossings. */
  snap: boolean;
  opacity: GuideOpacity;
  /** Grid and lines drawn dotted instead of solid. */
  dotted: boolean;
  /** Lines get a middle guide, like school writing paper. */
  writing: boolean;
}
export type TextSize = "s" | "m" | "l";

export interface Look {
  theme: ThemeMode;
  canvas: CanvasColor;
  textSize: TextSize;
  claudeSerif: boolean;
  showRead: boolean;
  showScore: boolean;
  /** The handwriting ability's debug view over each letter (T51). */
  showLetterParts: boolean;
  penSize: number;
  smoothing: number;
  guides: Guides;
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
  showLetterParts: true,
  penSize: 4,
  smoothing: 0.5,
  guides: { kind: "none", size: 24, snap: false, opacity: "soft", dotted: false, writing: false },
};

/**
 * The guides from a look saved before they were one choice (separate grid and lines, which
 * could both be on): the grid wins, as it was drawn on top.
 */
export function guidesFromOld(old: {
  grid?: { kind?: string; size?: number; snap?: boolean };
  lines?: { kind?: string; spacing?: number };
}): Guides {
  const base = DEFAULT_LOOK.guides;
  const { grid, lines } = old;
  if (grid?.kind === "dots" || grid?.kind === "squares")
    return {
      ...base,
      kind: grid.kind === "dots" ? "dots" : "grid",
      size: grid.size ?? base.size,
      snap: grid.snap ?? false,
    };
  if (lines?.kind === "ruled" || lines?.kind === "writing")
    return {
      ...base,
      kind: "lines",
      size: lines.spacing ?? 48,
      writing: lines.kind === "writing",
    };
  return base;
}

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
      // 1: grid and lines became one choice, the guides.
      version: 1,
      migrate: (saved, version) => {
        const state = (saved ?? {}) as Partial<UiState> & Parameters<typeof guidesFromOld>[0];
        if (version < 1) {
          const { grid, lines, ...rest } = state;
          return { ...rest, guides: guidesFromOld({ grid, lines }) } as UiState;
        }
        return state as UiState;
      },
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
