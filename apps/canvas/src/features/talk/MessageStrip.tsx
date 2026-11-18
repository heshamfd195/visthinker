import { useState, type CSSProperties } from "react";
import type { VisEvent } from "@visthinker/contract";
import { messageFromStory } from "./talk.utils.ts";

const strip: CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: 48,
  transform: "translateX(-50%)",
  maxWidth: "min(560px, 90%)",
  display: "flex",
  gap: 8,
  alignItems: "center",
  padding: "8px 12px",
  background: "#fff",
  borderRadius: 10,
  boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
};

const choice: CSSProperties = {
  padding: "4px 10px",
  border: "1px solid #d0d7de",
  borderRadius: 6,
  background: "#f6f8fa",
  font: "inherit",
  cursor: "pointer",
};

/** Claude's latest say, ask or proposal, with buttons to answer it. */
export function MessageStrip({
  events,
  onAnswer,
}: {
  events: VisEvent[];
  onAnswer(seq: number, choice: string): void;
}) {
  const [clicked, setClicked] = useState<ReadonlySet<number>>(new Set());
  const message = messageFromStory(events, clicked);
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" style={strip}>
      <span aria-hidden>🤖</span>
      <span>{message.text}</span>
      {message.choices.map((c) => (
        <button
          key={c}
          type="button"
          style={choice}
          onClick={() => {
            setClicked((s) => new Set(s).add(message.seq));
            onAnswer(message.seq, c);
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
