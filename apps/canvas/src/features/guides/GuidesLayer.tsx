// The grid and the writing lines (T48 · D124): background only, under everything, and never
// listening, so they're never read as strokes. Each kind is one Shape, not a node per line.
import type Konva from "konva";
import { Layer, Shape } from "react-konva";
import { useUi } from "../shell/index.ts";
import { positions, visibleStep } from "./guides.utils.ts";

export interface GuidesLayerProps {
  /** The visible world rect. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** A plain colour: Konva can't read CSS tokens. */
  color: string;
  /** Stage scale, so lines stay one screen pixel wide. */
  scale: number;
}

export function GuidesLayer({ x, y, width, height, color, scale }: GuidesLayerProps) {
  const grid = useUi((s) => s.grid);
  const lines = useUi((s) => s.lines);
  const px = 1 / (scale > 0 ? scale : 1);
  const right = x + width;
  const bottom = y + height;

  const dots = (ctx: Konva.Context, shape: Konva.Shape) => {
    const step = visibleStep(grid.size, scale);
    ctx.beginPath();
    for (const gx of positions(x, right, step))
      for (const gy of positions(y, bottom, step)) {
        ctx.moveTo(gx + px, gy);
        ctx.arc(gx, gy, px, 0, Math.PI * 2);
      }
    ctx.fillShape(shape);
  };

  const squares = (ctx: Konva.Context, shape: Konva.Shape) => {
    const step = visibleStep(grid.size, scale);
    ctx.beginPath();
    for (const gx of positions(x, right, step)) {
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, bottom);
    }
    for (const gy of positions(y, bottom, step)) {
      ctx.moveTo(x, gy);
      ctx.lineTo(right, gy);
    }
    ctx.strokeShape(shape);
  };

  // `middle`: the dashed guide halfway between two lines, for writing paper.
  const rows = (middle: boolean) => (ctx: Konva.Context, shape: Konva.Shape) => {
    const step = visibleStep(lines.spacing, scale);
    ctx.beginPath();
    for (const ly of positions(y, bottom, step, middle ? step / 2 : 0)) {
      ctx.moveTo(x, ly);
      ctx.lineTo(right, ly);
    }
    ctx.strokeShape(shape);
  };

  const common = { listening: false, perfectDrawEnabled: false } as const;

  return (
    <Layer listening={false}>
      {grid.kind === "dots" && <Shape {...common} sceneFunc={dots} fill={color} opacity={0.35} />}
      {grid.kind === "squares" && (
        <Shape {...common} sceneFunc={squares} stroke={color} strokeWidth={px} opacity={0.35} />
      )}
      {lines.kind !== "none" && (
        <Shape {...common} sceneFunc={rows(false)} stroke={color} strokeWidth={px} opacity={0.3} />
      )}
      {lines.kind === "writing" && (
        <Shape
          {...common}
          sceneFunc={rows(true)}
          stroke={color}
          strokeWidth={px}
          // Dashes measured in screen pixels, like the line width.
          dash={[6 * px, 6 * px]}
          opacity={0.3}
        />
      )}
    </Layer>
  );
}
