import type { VisEvent } from "@visthinker/contract";
import { useEffect, useRef } from "react";
import { describe, timing, WHO } from "./story.utils.ts";

/** A live list of the story (D78), newest at the bottom. Hover a row for the raw event. */
export function StoryPanel({ events }: { events: VisEvent[] }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect must not.
    end.current?.scrollIntoView({ block: "end" });
  }, [events.length]);

  if (events.length === 0) {
    return <p style={{ margin: 12, color: "#999" }}>Nothing yet. Draw or place something.</p>;
  }

  const bySeq = new Map(events.map((e) => [e.seq, e]));
  return (
    <ol
      style={{
        listStyle: "none",
        margin: 0,
        padding: "4px 0",
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
      }}
    >
      {events.map((e) => {
        const { at, lag } = timing(e, bySeq);
        return (
          <li
            key={e.seq}
            title={JSON.stringify(e)}
            style={{ padding: "2px 12px", whiteSpace: "nowrap" }}
          >
            <span style={{ color: "#999", display: "inline-block", minWidth: "6.5ch" }}>{at}</span>
            {lag && <b style={{ color: "#8a6d00", fontWeight: 600, marginRight: 6 }}>{lag}</b>}
            <span style={{ color: "#999" }}>#{e.seq}</span> {WHO[e.who]} {describe(e)}
            {e.cause !== undefined && <span style={{ color: "#aaa" }}> ← #{e.cause}</span>}
          </li>
        );
      })}
      <li ref={end} />
    </ol>
  );
}
