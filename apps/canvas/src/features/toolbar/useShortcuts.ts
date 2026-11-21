// Standard shortcuts, a small handler of our own (D146): ⌘Z undo, ⇧⌘Z redo, single letters for
// tools, F for focus, \ for all panels, ⌘, for settings, Delete or Backspace to delete the
// selection. Never while typing in a field.
import { useEffect } from "react";
import { toolForKey, useToolbar } from "./toolbar.store.ts";

export interface ShortcutActions {
  undo(): void;
  redo(): void;
  /** Deletes what's selected. */
  deleteSelection(): void;
  focus(): void;
  openAll(): void;
  settings(): void;
}

export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export function useShortcuts(actions: ShortcutActions): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) actions.redo();
        else actions.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        actions.redo();
        return;
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        actions.settings();
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        return actions.deleteSelection();
      }
      if (e.key === "f" || e.key === "F") return actions.focus();
      if (e.key === "\\") return actions.openAll();
      const tool = toolForKey(e.key);
      if (tool) useToolbar.getState().setTool(tool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions]);
}
