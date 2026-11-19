// Modes (D129 · D138 · D139): the moment the canvas is in, and the card Claude follows in it.
// Auto by default, Claude switches with a reason; a mode picked by hand holds until the person
// chooses auto again. The cards live in the `modes` pack: knowledge, not code.
import {
  ContractError,
  ModeEventDetail,
  type Mode,
  type VisEvent,
  type Who,
} from "@visthinker/contract";
import type { PackRegistry } from "../packs/loader.ts";
import type { Story } from "../scene/story.ts";

export interface ModeState {
  mode: Mode | undefined;
  manual: boolean;
  /** The `mode` event that set it. */
  seq: number | undefined;
  by: Who | undefined;
  reason: string | undefined;
}

export interface ModeInfo {
  label: string;
  role: string;
  card: string;
}

/** The mode now, read from the latest `mode` event. Auto with no mode before the first one. */
export function currentMode(events: readonly VisEvent[]): ModeState {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    if (event.type !== "mode") continue;
    const detail = ModeEventDetail.safeParse(event.detail ?? {});
    if (!detail.success) continue;
    return {
      mode: detail.data.mode,
      manual: detail.data.manual,
      seq: event.seq,
      by: event.who,
      reason: detail.data.reason,
    };
  }
  return { mode: undefined, manual: false, seq: undefined, by: undefined, reason: undefined };
}

/** The `modes` pack's entry for a mode: its label, Claude's role and the card (D139). */
export function modeInfo(packs: PackRegistry, mode: Mode): ModeInfo | undefined {
  const rules = packs.get("modes")?.pack["rules.json"] as
    { modes?: Record<string, Partial<ModeInfo>> } | undefined;
  const entry = rules?.modes?.[mode];
  if (!entry?.card) return undefined;
  return { label: entry.label ?? mode, role: entry.role ?? "", card: entry.card };
}

export interface SetModeInput {
  mode: Mode | undefined;
  manual: boolean;
  by: Who;
  reason?: string;
}

/**
 * Appends a `mode` event carrying the mode's card, so Claude gets it with its next read (D138).
 * Claude can't switch while the person holds a mode by hand (D129).
 */
export function setMode(story: Story, packs: PackRegistry, input: SetModeInput): VisEvent {
  const now = currentMode(story.all());
  if (input.by === "claude" && now.manual) {
    throw new ContractError(
      "not_allowed",
      `the person picked ${now.mode ?? "a mode"} by hand; keep to it until they choose auto`,
    );
  }
  const card = input.mode ? modeInfo(packs, input.mode)?.card : undefined;
  const detail: ModeEventDetail = {
    ...(input.mode ? { mode: input.mode } : {}),
    manual: input.manual,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(card ? { card } : {}),
  };
  return story.append({ who: input.by, type: "mode", detail });
}
