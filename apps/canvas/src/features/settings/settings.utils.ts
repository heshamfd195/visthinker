// The settings window's sections (D128) and the shortcut list it shows (D146).

export type SectionId =
  "appearance" | "drawing" | "reading" | "claude" | "privacy" | "shortcuts" | "about";

/** The seven sections, in order (D128). */
export const SECTIONS: readonly { id: SectionId; label: string }[] = [
  { id: "appearance", label: "Appearance" },
  { id: "drawing", label: "Drawing" },
  { id: "reading", label: "Reading" },
  { id: "claude", label: "Claude" },
  { id: "privacy", label: "Privacy" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "about", label: "About" },
];

/** What each key does, as [label, keys] (D146); the toolbar reuses it for its tips. */
export const SHORTCUTS: readonly (readonly [label: string, keys: string])[] = [
  ["Undo", "⌘Z"],
  ["Redo", "⇧⌘Z"],
  ["Pen", "P"],
  ["Eraser", "E"],
  ["Select", "V"],
  ["Hand", "H"],
  ["Box", "B"],
  ["Circle", "O"],
  ["Arrow", "A"],
  ["Board", "G"],
  ["Focus mode", "F"],
  ["Open all panels", "\\"],
  ["Settings", "⌘,"],
];
