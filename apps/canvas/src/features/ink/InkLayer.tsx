import type { Stroke } from "@visthinker/contract";
import Konva from "konva";
import { memo, useMemo, useRef } from "react";
import { Layer, Line, Rect } from "react-konva";
import { itemName } from "../../shared/items.ts";
import { paint, type CanvasColor } from "../../shared/theme.ts";
import { createInkManager } from "./ink.manager.ts";
import {
  regionSpan,
  SELECT_DASH,
  SELECT_MARCH,
  SELECT_MIN_DRAG,
  type Point,
  type Region,
} from "./ink.select.ts";
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
  /** The select tool dragged a box or a lasso (with shift: added to the selection). */
  onSelect?: (region: Region, add: boolean) => void;
  /** How the select tool picks, as chosen under the select button: the arrow only clicks. */
  selectBy?: Region["kind"] | "pointer";
  /** Ids selected now: a selected loose stroke is outlined here (objects outline themselves). */
  selection?: readonly string[];
  /** Strokes whose ink gave way to something cleaner, e.g. a drawn X now shown as a mark. */
  hidden?: ReadonlySet<string>;
}

/**
 * The drawing surface. The stroke being drawn is an imperative Konva line, outside React, so it
 * doesn't re-render per point (semi-declarative, D83); finished strokes are drawn from data.
 * A tap leaves no ink and goes to `onTap`.
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
  onSelect,
  selectBy = "pointer",
  selection = [],
  hidden,
}: Props) {
  const live = useRef<Konva.Layer>(null);
  const shape = useRef<Konva.Line | null>(null);
  const erasing = useRef(false);
  /** The select drag under way: its region, the shape showing it, and whether shift adds. */
  const selecting = useRef<{
    region: Region;
    shape: Konva.Shape;
    ants: Konva.Animation;
    add: boolean;
  } | null>(null);
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
      if (selectBy === "pointer") onPick?.(undefined, e.evt.shiftKey);
      else startSelect(e);
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

  // Box or lasso select: a drag draws the region; a press that barely moves is a click. Its outline
  // is clearly dashed and its dashes march, like Photoshop's, in screen pixels at any zoom.
  const dash = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const scale = e.target.getStage()?.scaleX() ?? 1;
    const [on, off] = SELECT_DASH;
    return {
      stroke: paint("ink", canvas),
      strokeWidth: 1.5 / scale,
      dash: [on / scale, off / scale],
    };
  };
  const startSelect = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const at = e.target.getStage()?.getRelativePointerPosition();
    if (!at || !live.current) return;
    const p: Point = [at.x, at.y];
    const lasso = selectBy === "lasso";
    const shape: Konva.Shape = lasso
      ? new Konva.Line({ points: [...p], closed: true, listening: false, ...dash(e) })
      : new Konva.Rect({ x: p[0], y: p[1], width: 0, height: 0, listening: false, ...dash(e) });
    live.current.add(shape);
    const scale = e.target.getStage()?.scaleX() ?? 1;
    const period = (SELECT_DASH[0] + SELECT_DASH[1]) / scale;
    const ants = new Konva.Animation((frame) => {
      shape.dashOffset(-((((frame?.time ?? 0) / 1000) * SELECT_MARCH) / scale) % period);
    }, live.current);
    ants.start();
    selecting.current = {
      region: lasso ? { kind: "lasso", points: [p] } : { kind: "box", from: p, to: p },
      shape,
      ants,
      add: e.evt.shiftKey,
    };
    // The drag crosses objects that sit above this layer, so follow it on the whole stage and
    // finish it wherever the button comes up, even off the canvas.
    const stage = e.target.getStage();
    stage?.on("pointermove.select", extendSelect);
    window.addEventListener(
      "pointerup",
      () => {
        stage?.off("pointermove.select");
        endSelect(stage?.scaleX() ?? 1);
      },
      { once: true },
    );
  };
  const extendSelect = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const s = selecting.current;
    const at = e.target.getStage()?.getRelativePointerPosition();
    if (!s || !at) return;
    const p: Point = [at.x, at.y];
    if (s.region.kind === "box") {
      s.region = { ...s.region, to: p };
      const [fx, fy] = s.region.from;
      s.shape.setAttrs({
        x: Math.min(fx, p[0]),
        y: Math.min(fy, p[1]),
        width: Math.abs(p[0] - fx),
        height: Math.abs(p[1] - fy),
      });
    } else {
      s.region.points.push(p);
      (s.shape as Konva.Line).points(s.region.points.flat());
    }
    live.current?.batchDraw();
  };
  const endSelect = (scale: number) => {
    const s = selecting.current;
    if (!s) return;
    selecting.current = null;
    s.ants.stop();
    s.shape.destroy();
    live.current?.batchDraw();
    if (regionSpan(s.region) * scale < SELECT_MIN_DRAG) onPick?.(undefined, s.add);
    else onSelect?.(s.region, s.add);
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
  const chosen = new Set(selection);

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
        {visible
          .filter((s) => chosen.has(s.id))
          .map((s) => {
            const xs = s.points.map((p) => p[0]);
            const ys = s.points.map((p) => p[1]);
            const x = Math.min(...xs);
            const y = Math.min(...ys);
            return (
              <Rect
                key={`sel-${s.id}`}
                x={x - 6}
                y={y - 6}
                width={Math.max(...xs) - x + 12}
                height={Math.max(...ys) - y + 12}
                cornerRadius={6}
                stroke={paint("ink", canvas)}
                strokeWidth={1.5}
                dash={[6, 4]}
                opacity={0.8}
                listening={false}
              />
            );
          })}
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
      name={itemName(stroke.id)}
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
