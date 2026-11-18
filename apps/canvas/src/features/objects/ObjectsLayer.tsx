import type { Point2, SceneObject } from "@visthinker/contract";
import type { PlaceInput } from "@visthinker/core";
import type Konva from "konva";
import { useRef, useState } from "react";
import { Arrow, Ellipse, Group, Layer, Rect } from "react-konva";
import type { Tool } from "../toolbar/index.ts";
import { dragBox, isRealDrag } from "./objects.utils.ts";

interface Props {
  width: number;
  height: number;
  objects: SceneObject[];
  colors: Map<string, string>;
  tool: Tool;
  color: string;
  onPlace(input: PlaceInput): void;
  onMove(id: string, dx: number, dy: number): void;
}

const SHAPE_TOOLS: Tool[] = ["box", "circle", "arrow"];

type Draft = { from: Point2; to: Point2 };

/** Draws pre-built objects from the scene, places new ones, and moves them with the move tool. */
export function ObjectsLayer({
  width,
  height,
  objects,
  colors,
  tool,
  color,
  onPlace,
  onMove,
}: Props) {
  // The drag lives in a ref: pointer events can arrive faster than React re-renders, and a
  // handler reading state would see the drag as it was at the last render (a fast drag got lost).
  // The state copy only drives the dashed preview.
  const drag = useRef<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const placing = SHAPE_TOOLS.includes(tool);

  const at = (e: Konva.KonvaEventObject<PointerEvent>): Point2 | null => {
    const p = e.target.getStage()?.getPointerPosition();
    return p ? [p.x, p.y] : null;
  };

  const update = (next: Draft | null) => {
    drag.current = next;
    setDraft(next);
  };

  const finish = () => {
    const done = drag.current;
    if (done && isRealDrag(done.from, done.to) && placing) {
      const kind = tool as PlaceInput["kind"];
      onPlace({
        kind,
        box: dragBox(done.from, done.to),
        color,
        ...(kind === "arrow" ? { ends: { a: done.from, b: done.to } } : {}),
      });
    }
    update(null);
  };

  return (
    <Layer listening={tool !== "pen"}>
      {objects.map((o) => (
        <ObjectShape
          key={o.id}
          object={o}
          color={colors.get(o.id) ?? "#222222"}
          draggable={tool === "move"}
          onMove={onMove}
        />
      ))}
      {draft && placing && <DraftShape kind={tool} from={draft.from} to={draft.to} color={color} />}
      {placing && (
        <Rect
          width={width}
          height={height}
          onPointerDown={(e) => {
            const p = at(e);
            if (p) update({ from: p, to: p });
          }}
          onPointerMove={(e) => {
            const p = at(e);
            if (p && drag.current) update({ ...drag.current, to: p });
          }}
          onPointerUp={finish}
          onPointerLeave={finish}
        />
      )}
    </Layer>
  );
}

function ObjectShape(props: {
  object: SceneObject;
  color: string;
  draggable: boolean;
  onMove(id: string, dx: number, dy: number): void;
}) {
  const { object, color, draggable, onMove } = props;
  const [x, y, w, h] = object.box;
  const style = { stroke: color, strokeWidth: 3, hitStrokeWidth: 14 };
  return (
    <Group
      x={x}
      y={y}
      draggable={draggable}
      onDragEnd={(e) => onMove(object.id, e.target.x() - x, e.target.y() - y)}
    >
      {/* A transparent fill makes the inside grabbable with the move tool, not just the outline. */}
      {object.kind === "box" && (
        <Rect width={w} height={h} cornerRadius={4} fill="transparent" {...style} />
      )}
      {object.kind === "circle" && (
        <Ellipse
          x={w / 2}
          y={h / 2}
          radiusX={w / 2}
          radiusY={h / 2}
          fill="transparent"
          {...style}
        />
      )}
      {object.kind === "arrow" && object.geom && "a" in object.geom && (
        <Arrow
          points={[
            (object.geom.a as Point2)[0] - x,
            (object.geom.a as Point2)[1] - y,
            (object.geom.b as Point2)[0] - x,
            (object.geom.b as Point2)[1] - y,
          ]}
          fill={color}
          pointerLength={12}
          pointerWidth={12}
          {...style}
        />
      )}
    </Group>
  );
}

function DraftShape({
  kind,
  from,
  to,
  color,
}: {
  kind: Tool;
  from: Point2;
  to: Point2;
  color: string;
}) {
  const [x, y, w, h] = dragBox(from, to);
  const style = { stroke: color, strokeWidth: 3, dash: [6, 4], opacity: 0.7, listening: false };
  if (kind === "box") return <Rect x={x} y={y} width={w} height={h} cornerRadius={4} {...style} />;
  if (kind === "circle")
    return <Ellipse x={x + w / 2} y={y + h / 2} radiusX={w / 2} radiusY={h / 2} {...style} />;
  return (
    <Arrow points={[...from, ...to]} fill={color} pointerLength={12} pointerWidth={12} {...style} />
  );
}
