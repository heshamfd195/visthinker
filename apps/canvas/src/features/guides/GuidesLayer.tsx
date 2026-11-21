// The background guide (T48 · D124): dots, a grid or writing lines, one at a time. Background only,
// under everything, and never listening, so it's never read as strokes. One Shape per kind, not
// a node per line.
import type Konva from "konva";
import { Layer, Shape } from "react-konva";
import { useUi } from "../shell/index.ts";
import { dottedDash, GUIDE_OPACITY, positions, visibleStep } from "./guides.utils.ts";

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
  const guides = useUi((s) => s.guides);
  const px = 1 / (scale > 0 ? scale : 1);
  const right = x + width;
  const bottom = y + height;
  const step = visibleStep(guides.size, scale);

  const dots = (ctx: Konva.Context, shape: Konva.Shape) => {
    ctx.beginPath();
    for (const gx of positions(x, right, step))
      for (const gy of positions(y, bottom, step)) {
        ctx.moveTo(gx + px, gy);
        ctx.arc(gx, gy, px, 0, Math.PI * 2);
      }
    ctx.fillShape(shape);
  };

  const grid = (ctx: Konva.Context, shape: Konva.Shape) => {
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

  // `middle`: the guide halfway between two lines, for writing paper.
  const rows = (middle: boolean) => (ctx: Konva.Context, shape: Konva.Shape) => {
    ctx.beginPath();
    for (const ly of positions(y, bottom, step, middle ? step / 2 : 0)) {
      ctx.moveTo(x, ly);
      ctx.lineTo(right, ly);
    }
    ctx.strokeShape(shape);
  };

  const opacity = GUIDE_OPACITY[guides.opacity];
  const common = { listening: false, perfectDrawEnabled: false, opacity } as const;
  // Lines one screen pixel wide; dotted, a round dot then a gap, measured in screen pixels too.
  const line = {
    ...common,
    stroke: color,
    strokeWidth: guides.dotted ? 1.5 * px : px,
    ...(guides.dotted ? { dash: dottedDash(1.5 * px), lineCap: "round" as const } : {}),
  };

  return (
    <Layer listening={false}>
      {guides.kind === "dots" && <Shape {...common} sceneFunc={dots} fill={color} />}
      {guides.kind === "grid" && <Shape {...line} sceneFunc={grid} />}
      {guides.kind === "lines" && <Shape {...line} sceneFunc={rows(false)} />}
      {guides.kind === "lines" && guides.writing && (
        <Shape
          {...line}
          sceneFunc={rows(true)}
          // The middle guide stays lighter, dashed unless the lines are dotted.
          {...(guides.dotted ? {} : { dash: [6 * px, 6 * px] })}
          opacity={opacity * 0.7}
        />
      )}
    </Layer>
  );
}
