import { z } from "zod";

/**
 * Modes describe the moment and change how Claude acts (D129): playing (an opponent),
 * learning (explains), teaching (asks, you show), contributing (makes a pack with you).
 */
export const MODES = ["playing", "learning", "teaching", "contributing"] as const;
export const Mode = z.enum(MODES);
export type Mode = z.infer<typeof Mode>;

/** The `detail` of a `mode` event: the new mode, who chose it, and the card Claude follows (D138). */
export const ModeEventDetail = z.object({
  /** Undefined when the person switches back to auto. */
  mode: Mode.optional(),
  /** True when the person picked it by hand: Claude keeps to it until they choose auto (D129). */
  manual: z.boolean(),
  reason: z.string().max(200).optional(),
  /** The mode's instruction card, from the `modes` pack (D139). */
  card: z.string().max(2_000).optional(),
});
export type ModeEventDetail = z.infer<typeof ModeEventDetail>;
