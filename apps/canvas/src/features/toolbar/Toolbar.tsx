import type { CSSProperties } from "react";
import { COLORS, TOOLS, useToolbar } from "./toolbar.store.ts";

const bar: CSSProperties = {
  position: "absolute",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  gap: 4,
  alignItems: "center",
  padding: 6,
  background: "#fff",
  borderRadius: 10,
  boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
  userSelect: "none",
};

const button = (on: boolean): CSSProperties => ({
  width: 34,
  height: 34,
  border: "none",
  borderRadius: 7,
  background: on ? "#e7f0fb" : "transparent",
  color: on ? "#1971c2" : "#333",
  fontSize: 17,
  cursor: "pointer",
});

const swatch = (color: string, on: boolean): CSSProperties => ({
  width: 20,
  height: 20,
  margin: 3,
  borderRadius: "50%",
  border: on ? "2px solid #fff" : "2px solid transparent",
  outline: on ? `2px solid ${color}` : "none",
  background: color,
  cursor: "pointer",
});

/** The tools and colours, floating at the top of the canvas. */
export function Toolbar() {
  const { tool, color, setTool, setColor } = useToolbar();
  return (
    <div role="toolbar" aria-label="Drawing tools" style={bar}>
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          type="button"
          title={t.label}
          aria-label={t.label}
          aria-pressed={tool === t.tool}
          style={button(tool === t.tool)}
          onClick={() => setTool(t.tool)}
        >
          {t.icon}
        </button>
      ))}
      <span style={{ width: 1, height: 22, background: "#e4e4e0", margin: "0 4px" }} />
      {COLORS.map((c) => (
        <button
          key={c.color}
          type="button"
          title={c.label}
          aria-label={`${c.label} colour`}
          aria-pressed={color === c.color}
          style={swatch(c.color, color === c.color)}
          onClick={() => setColor(c.color)}
        />
      ))}
    </div>
  );
}
