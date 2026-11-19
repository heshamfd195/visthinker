// Modes, the words on screen (T50 · D129 · D138 · D139): the chip and the note's text.
import type { Mode } from "@visthinker/contract";
import type { ModeInfo, ModeState } from "@visthinker/core";

export type ModeInfos = Partial<Record<Mode, ModeInfo>>;

/** The mode's name: the `modes` pack's label (D139), else the id with a capital. */
export function modeLabel(mode: Mode, infos: ModeInfos = {}): string {
  const label = infos[mode]?.label?.trim();
  return label || mode.charAt(0).toUpperCase() + mode.slice(1);
}

/** The chip's words: auto with the mode Claude is in, or the mode held by hand (D129). */
export function chipText(state: ModeState, infos: ModeInfos = {}): { main: string; sub?: string } {
  if (state.manual && state.mode) return { main: modeLabel(state.mode, infos), sub: "manual" };
  return { main: state.mode ? `Auto · ${modeLabel(state.mode, infos)}` : "Auto" };
}

/**
 * The note after a mode change: Claude's switch with its reason (it can be undone, D129), or
 * the person's pick. Undefined when there's been no change to tell.
 */
export function noteText(state: ModeState, infos: ModeInfos = {}): string | undefined {
  if (state.seq === undefined) return undefined;
  if (state.by === "claude") {
    const label = state.mode ? modeLabel(state.mode, infos).toLowerCase() : "auto";
    const reason = state.reason?.trim();
    return reason ? `Claude switched to ${label}: ${reason}` : `Claude switched to ${label}`;
  }
  if (state.manual && state.mode)
    return `${modeLabel(state.mode, infos)} until you switch back to auto`;
  return "Auto: Claude picks from what you say and draw";
}
