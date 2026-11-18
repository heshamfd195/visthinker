import type { Stroke } from "@visthinker/contract";
import Konva from "konva";
import { useMemo, useRef } from "react";
import { Layer, Rect } from "react-konva";
import { createInkManager } from "./ink.manager.ts";
import type { RawPoint } from "./ink.types.ts";
import { outline, PEN, pressureOf } from "./ink.utils.ts";

interface Props {
  width: number;
  height: number;
  /** The session clock, in milliseconds. */
  now: () => number;
  /** The next stroke id from the core. */
  nextId: () => string;
  /** A finished stroke, ready to record in the story. */
  onStroke: (stroke: Stroke) => void;
  /** The pen colour. */
  color?: string;
  /** A short press that barely moved: a tap at this world point, e.g. on a cell. */
  onTap?: (at: [number, number]) => void;
  /** False while another tool is active: the layer then draws nothing. */
  enabled?: boolean;
}

/**
 * The drawing surface. Ink is drawn on an imperative Konva layer, outside React, so a stroke
 * doesn't re-render per point (semi-declarative, D83). World units = stage pixels for now.
 * A tap leaves no ink and goes to `onTap`, e.g. to play in a cell.
 */
export function InkLayer({
  width,
  height,
  now,
  nextId,
  onStroke,
  onTap,
  color = PEN.color,
  enabled = true,
}: Props) {
  const ink = useRef<Konva.Layer>(null);
  const shape = useRef<Konva.Line | null>(null);
  const manager = useMemo(() => createInkManager(nextId, { ...PEN, color }), [nextId, color]);

  const sample = (e: Konva.KonvaEventObject<PointerEvent>): RawPoint | null => {
    const at = e.target.getStage()?.getPointerPosition();
    if (!at) return null;
    return {
      x: at.x,
      y: at.y,
      pressure: pressureOf(e.evt.pointerType, e.evt.pressure),
      time: now(),
    };
  };

  const down = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const point = sample(e);
    if (!enabled || !point || !ink.current) return;
    manager.begin(point);
    shape.current = new Konva.Line({
      points: outline([point]),
      closed: true,
      fill: color,
      listening: false,
    });
    ink.current.add(shape.current);
    ink.current.batchDraw();
  };

  const move = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!manager.drawing()) return;
    const point = sample(e);
    if (!point) return;
    manager.extend(point);
    shape.current?.points(outline([...manager.live()]));
    ink.current?.batchDraw();
  };

  const up = () => {
    const result = manager.end();
    if (result?.kind === "stroke") onStroke(result.stroke);
    else shape.current?.destroy();
    if (result?.kind === "tap") onTap?.([result.at.x, result.at.y]);
    shape.current = null;
    ink.current?.batchDraw();
  };

  return (
    <>
      <Layer>
        <Rect
          width={width}
          height={height}
          fill="#fff"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
        />
      </Layer>
      <Layer ref={ink} listening={false} />
    </>
  );
}
