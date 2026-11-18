// Which panels are open (Zustand: UI state only, D83).
import { create } from "zustand";

export const PANEL_WIDTH = 340;

interface PanelsState {
  open: Record<string, boolean>;
  isOpen(id: string): boolean;
  toggle(id: string): void;
}

export const usePanels = create<PanelsState>((set, get) => ({
  open: { story: true },
  isOpen: (id) => get().open[id] ?? false,
  toggle: (id) => set((s) => ({ open: { ...s.open, [id]: !(s.open[id] ?? false) } })),
}));
