import type { Stroke } from "@visthinker/contract";
import Konva from "konva";
import { memo, useMemo, useRef } from "react";
import { Layer, Line, Rect } from "react-konva";
import { paint, type CanvasColor } from "../../shared/theme.ts";
import { createInkManager } from "./ink.manager.ts";
import type { RawPoint } from "./ink.types.ts";
import { outline, PEN, pressureOf, samplesOf } from "./ink.utils.ts";

/** What a press on the canvas does: draw, erase, pick, or nothing (another layer handles it). */
export type InkMode = "draw" | "erase" | "select" | "off";

interface Props {
  /** The visible part of the world, in world units: the drawing surface covers it. */
  view: { x: number; y: number; width: number; height: number };
  /** The session clock, in milliseconds. */
  now: () => number;
  /** The next stroke id from the core. */
  nextId: () => string;
  /** A finished stroke, ready to record in the story. */
  onStroke: (stroke: Stroke) => void;
  /** Every stroke still visible: drawn from data, so undo, clear and projects redraw it (D141). */
  strokes: readonly Stroke[];
  /** The pen colour and width. */
  color?: string;
  width?: number;
  smoothing?: number;
  canvas: CanvasColor;
  mode: InkMode;
  /** A short press that barely moved: a tap at this world point, e.g. on a cell. */
  onTap?: (at: [number, number]) => void;
  /** The eraser touched these strokes. */
  onErase?: (ids: string[]) => void;
  /** The select tool picked a stroke (with shift: added to the selection). */
  onPick?: (id: string | undefined, add: boolean) => void;
  /** Strokes whose ink gave way to something cleaner, e.g. a drawn X now shown as a mark. */
  hidden?: ReadonlySet<string>;
}

/**
 * The drawing surface. The stroke being drawn is an imperative Konva line, outside React, so it
 * doesn't re-render per point (semi-declarative, D83); finished strokes are drawn from data.
 * A tap leaves no ink and goes to `onTap`, e.g. to play in a cell.
 */
export function InkLayer({
  view,
  now,
  nextId,
  onStroke,
  strokes,
  color = PEN.color,
  width = PEN.width,
  smoothing = 0.5,
  canvas,
  mode,
  onTap,
  onErase,
  onPick,
  hidden,
}: Props) {
  const live = useRef<Konva.Layer>(null);
  const shape = useRef<Konva.Line | null>(null);
  const erasing = useRef(false);
  const manager = useMemo(() => createInkManager(nextId, { color, width }), [nextId, color, width]);

  const sample = (e: Konva.KonvaEventObject<PointerEvent>): RawPoint | null => {
    // World units: the stage may be zoomed and panned.
    const at = e.target.getStage()?.getRelativePointerPosition();
    if (!at) return null;
    return {
      x: at.x,
      y: at.y,
      pressure: pressureOf(e.evt.pointerType, e.evt.pressure),
      time: now(),
    };
  };

  const down = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (mode === "erase") {
      erasing.current = true;
      return;
    }
    if (mode === "select") {
      onPick?.(undefined, e.evt.shiftKey);
      return;
    }
    const point = sample(e);
    if (mode !== "draw" || !point || !live.current) return;
    manager.begin(point);
    shape.current = new Konva.Line({
      points: outline([point], width, false, smoothing),
      closed: true,
      fill: paint(color, canvas),
      listening: false,
    });
    live.current.add(shape.current);
    live.current.batchDraw();
  };

  const move = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!manager.drawing()) return;
    const point = sample(e);
    if (!point) return;
    manager.extend(point);
    shape.current?.points(outline([...manager.live()], width, false, smoothing));
    live.current?.batchDraw();
  };

  const up = () => {
    erasing.current = false;
    const result = manager.end();
    shape.current?.destroy();
    shape.current = null;
    live.current?.batchDraw();
    if (result?.kind === "stroke") onStroke(result.stroke);
    if (result?.kind === "tap") onTap?.([result.at.x, result.at.y]);
  };

  const visible = strokes.filter((s) => !hidden?.has(s.id));
  const pickable = mode === "erase" || mode === "select";

  return (
    <>
      <Layer>
        <Rect
          {...view}
          fill="transparent"
          listening={mode !== "off"}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
        />
      </Layer>
      <Layer listening={pickable}>
        {visible.map((stroke) => (
          <InkStroke
            key={stroke.id}
            stroke={stroke}
            fill={paint(stroke.color, canvas)}
            smoothing={smoothing}
            onDown={(shift) =>
              mode === "erase" ? onErase?.([stroke.id]) : onPick?.(stroke.id, shift)
            }
            onEnter={() => {
              if (mode === "erase" && erasing.current) onErase?.([stroke.id]);
            }}
          />
        ))}
      </Layer>
      <Layer ref={live} listening={false} />
    </>
  );
}

const InkStroke = memo(function InkStroke({
  stroke,
  fill,
  smoothing,
  onDown,
  onEnter,
}: {
  stroke: Stroke;
  fill: string;
  smoothing: number;
  onDown: (shift: boolean) => void;
  onEnter: () => void;
}) {
  const points = useMemo(
    () => outline(samplesOf(stroke), stroke.width, true, smoothing),
    [stroke, smoothing],
  );
  return (
    <Line
      points={points}
      closed
      fill={fill}
      hitStrokeWidth={12}
      onPointerDown={(e) => {
        e.cancelBubble = true;
        onDown(e.evt.shiftKey);
      }}
      onPointerEnter={onEnter}
    />
  );
});
