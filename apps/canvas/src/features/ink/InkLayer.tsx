import type { Stroke } from "@visthinker/contract";
import Konva from "konva";
import { useEffect, useMemo, useRef } from "react";
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
  /** Strokes whose ink gave way to something cleaner, e.g. a drawn X now shown as a mark. */
  hidden?: ReadonlySet<string>;
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
  hidden,
}: Props) {
  const ink = useRef<Konva.Layer>(null);
  const shape = useRef<Konva.Line | null>(null);
  const manager = useMemo(() => createInkManager(nextId, { ...PEN, color }), [nextId, color]);
  /** Each finished stroke's ink, by stroke id, so it can give way later. */
  const shapes = useRef(new Map<string, Konva.Line>());

  // Once gone, gone: the mark that replaced the ink stays.
  useEffect(() => {
    let changed = false;
    for (const id of hidden ?? []) {
      const line = shapes.current.get(id);
      if (!line) continue;
      line.destroy();
      shapes.current.delete(id);
      changed = true;
    }
    if (changed) ink.current?.batchDraw();
  }, [hidden]);

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
    const finished = [...manager.live()];
    const result = manager.end();
    if (result?.kind === "stroke") {
      // Redraw the finished stroke to its real end before handing it on.
      shape.current?.points(outline(finished, PEN.width, true));
      if (shape.current) shapes.current.set(result.stroke.id, shape.current);
      onStroke(result.stroke);
    } else shape.current?.destroy();
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
