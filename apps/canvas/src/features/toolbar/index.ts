// features/toolbar: the only door (D83).
export { Toolbar, type ToolbarProps } from "./Toolbar.tsx";
export { COLORS, SHAPE_TOOLS, TOOLS, toolForKey, useToolbar } from "./toolbar.store.ts";
export type { Tool } from "./toolbar.types.ts";
export { isTyping, useShortcuts, type ShortcutActions } from "./useShortcuts.ts";
