// The note after a mode change, above the chat (T50 · D129): Claude's switch with its reason
// and an Undo, or the mode the person picked. It hides itself after a while.
import type { Mode } from "@visthinker/contract";
import type { ModeState } from "@visthinker/core";
import { Lock, Wand2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Surface } from "../../shared/ui/index.ts";
import { modeLabel, noteText, type ModeInfos } from "./modes.utils.ts";

export const NOTE_MS = 8_000;

export interface ModeNoteProps {
  state: ModeState;
  /** The mode before this change, for Undo. */
  previous: Mode | undefined;
  onUndo(): void;
  onDismiss(): void;
  /** Labels from the `modes` pack (D139). */
  infos?: ModeInfos;
}

export function ModeNote({ state, previous, onUndo, onDismiss, infos }: ModeNoteProps) {
  // The latest onDismiss, so a new callback each render doesn't restart the timer.
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  // One timer per mode change (keyed on its event's seq).
  useEffect(() => {
    if (state.seq === undefined) return;
    const timer = setTimeout(() => dismiss.current(), NOTE_MS);
    return () => clearTimeout(timer);
  }, [state.seq]);

  const text = noteText(state, infos);
  if (!text) return null;
  const byClaude = state.by === "claude";
  // A held mode shows a lock; Claude's switch, or going back to auto, the wand.
  const Icon = state.manual && !byClaude ? Lock : Wand2;
  const back = previous ? modeLabel(previous, infos).toLowerCase() : "auto";

  return (
    <Surface role="status" className="flex items-center gap-2 px-3 py-2 text-xs">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">{text}</span>
      {byClaude && (
        <button
          type="button"
          onClick={onUndo}
          title={`Back to ${back}`}
          className="shrink-0 rounded px-1 font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Undo
        </button>
      )}
    </Surface>
  );
}
