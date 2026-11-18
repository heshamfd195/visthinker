import type { VisEvent } from "@visthinker/contract";

export const WHO: Record<VisEvent["who"], string> = {
  user: "🧑",
  fastbrain: "⚡",
  claude: "🤖",
  api: "🔌",
};

/** One line per event: what happened, to what, and the small detail. */
export function describe(e: VisEvent): string {
  const d = e.detail ?? {};
  const bits: string[] = [];
  if (typeof d["kind"] === "string") bits.push(d["kind"]);
  if (typeof d["color"] === "string") bits.push(d["color"]);
  if (typeof d["shape"] === "string") bits.push(d["shape"]);
  if (typeof d["text"] === "string") bits.push(`“${d["text"]}”`);
  if (typeof d["points"] === "number") bits.push(`${d["points"]} pts`);
  if (Array.isArray(d["from"]) && Array.isArray(d["to"])) {
    const [fx, fy] = d["from"] as number[];
    const [tx, ty] = d["to"] as number[];
    bits.push(`(${fx}, ${fy}) → (${tx}, ${ty})`);
  }
  return [e.type, e.target, bits.join(" ")].filter(Boolean).join(" · ");
}

/** Session-clock time, compact: "12.4 s", or "2:03.4" past a minute. */
export function clockText(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
}

/** How long after its cause: "+40 ms" under a second, else "+3.2 s". */
export function lagText(ms: number): string {
  const d = Math.max(0, ms);
  return d < 1000 ? `+${Math.round(d)} ms` : `+${(d / 1000).toFixed(1)} s`;
}

/** A row's timings: when on the session clock, and how long after its cause, if it has one. */
export function timing(
  e: VisEvent,
  bySeq: ReadonlyMap<number, VisEvent>,
): { at: string; lag: string | null } {
  const cause = e.cause !== undefined ? bySeq.get(e.cause) : undefined;
  return { at: clockText(e.t), lag: cause ? lagText(e.t - cause.t) : null };
}
