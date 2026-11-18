import type { CSSProperties, ReactNode } from "react";
import { PANEL_WIDTH, usePanels } from "./panels.store.ts";

interface Props {
  id: string;
  side: "left" | "right";
  title: string;
  width?: number;
  children: ReactNode;
}

/** A side panel beside the canvas that opens and closes; closed, it leaves a small tab. */
export function Panel({ id, side, title, width = PANEL_WIDTH, children }: Props) {
  const open = usePanels((s) => s.open[id] ?? false);
  const toggle = usePanels((s) => s.toggle);
  const edge = side === "right" ? { right: 0 } : { left: 0 };

  const tab: CSSProperties = {
    position: "absolute",
    top: 64,
    ...edge,
    padding: "8px 10px",
    border: "1px solid #e4e4e0",
    borderRadius: side === "right" ? "8px 0 0 8px" : "0 8px 8px 0",
    background: "#fff",
    font: "inherit",
    cursor: "pointer",
  };

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        aria-controls={`panel-${id}`}
        style={tab}
        onClick={() => toggle(id)}
      >
        {title}
      </button>
    );
  }

  // Open, the panel sits beside the canvas (a flex child), so it never covers the drawing.
  return (
    <aside
      id={`panel-${id}`}
      aria-label={title}
      style={{
        order: side === "right" ? 1 : -1,
        flex: "none",
        height: "100%",
        width,
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        [side === "right" ? "borderLeft" : "borderRight"]: "1px solid #e4e4e0",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid #eee",
        }}
      >
        <h2 style={{ fontSize: 13, margin: 0 }}>{title}</h2>
        <button
          type="button"
          aria-expanded
          aria-controls={`panel-${id}`}
          aria-label={`Close ${title}`}
          onClick={() => toggle(id)}
          style={{
            border: "none",
            background: "none",
            fontSize: 16,
            cursor: "pointer",
            color: "#888",
          }}
        >
          {side === "right" ? "›" : "‹"}
        </button>
      </header>
      <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
    </aside>
  );
}
