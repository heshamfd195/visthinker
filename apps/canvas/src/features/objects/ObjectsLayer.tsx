import type { Box, Point2, SceneObject } from "@visthinker/contract";
import type { PlaceInput } from "@visthinker/core";
import type Konva from "konva";
import { useRef, useState } from "react";
import { Arrow, Ellipse, Group, Layer, Line, Rect, Text } from "react-konva";
import type { Tool } from "../toolbar/index.ts";
import { CLAUDE_COLOR, dragBox, isRealDrag } from "./objects.utils.ts";

interface Props {
  width: number;
  height: number;
  objects: readonly SceneObject[];
  colors: Map<string, string>;
  tool: Tool;
  color: string;
  /** Cells in a winning line, shown highlighted. */
  highlight?: ReadonlySet<string>;
  /** What each symbol was read as, e.g. "X 87%" (D97). */
  tags?: ReadonlyMap<string, string>;
  onPlace(input: PlaceInput): void;
  /** A ready-made board dragged out with the board tool. */
  onPlaceBoard(box: Box): void;
  onMove(id: string, dx: number, dy: number): void;
}

const SHAPE_TOOLS: Tool[] = ["box", "circle", "arrow", "board"];

type Draft = { from: Point2; to: Point2 };

/** Draws pre-built objects from the scene, places new ones, and moves them with the move tool. */
export function ObjectsLayer({
  width,
  height,
  objects,
  colors,
  tool,
  color,
  highlight,
  tags,
  onPlace,
  onPlaceBoard,
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
    if (done && isRealDrag(done.from, done.to) && tool === "board") {
      // A square board, as wide as the drag's longer side, from where the drag started.
      const [x, y, w, h] = dragBox(done.from, done.to);
      const side = Math.max(w, h);
      onPlaceBoard([x, y, side, side]);
    } else if (done && isRealDrag(done.from, done.to) && placing) {
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
      {/* Cells first, so a winning line's highlight sits under the board's lines. */}
      {[...objects]
        .sort((a, b) => Number(b.kind === "cell") - Number(a.kind === "cell"))
        .map((o) => (
          <ObjectShape
            key={o.id}
            object={o}
            color={colors.get(o.id) ?? "#222222"}
            draggable={tool === "move" && BUILT_IN.has(o.kind) && o.pack !== SHAPES}
            highlighted={highlight?.has(o.id) ?? false}
            tag={tags?.get(o.id)}
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
  highlighted: boolean;
  tag?: string | undefined;
  onMove(id: string, dx: number, dy: number): void;
}) {
  const { object, color, draggable, highlighted, tag, onMove } = props;
  const [x, y, w, h] = object.box;
  const style = { stroke: color, strokeWidth: 3, hitStrokeWidth: 14 };
  // What the comparator read from your ink: a light outline over it, so you see what it saw.
  if (object.pack === SHAPES || object.kind === "symbol")
    return <RecognizedShape object={object} tag={tag} />;
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
      {/* A board draws its inner lines; its cells stay invisible, unless part of a winning line. */}
      {object.kind === "board" && !drawnBoard(object) && (
        <BoardLines w={w} h={h} n={Math.round(Math.sqrt(object.parts.length)) || 3} />
      )}
      {object.kind === "cell" && highlighted && (
        <Rect width={w} height={h} fill="#fff3bf" listening={false} />
      )}
      {/* A mark (X, O…) fills its cell; anything else Claude adds is a labelled, dashed note. */}
      {object.kind === "mark" && (
        <Text
          width={w}
          height={h}
          text={object.label}
          align="center"
          verticalAlign="middle"
          fontSize={Math.max(14, Math.min(w, h) * 0.7)}
          fill={color}
          listening={false}
        />
      )}
      {!BUILT_IN.has(object.kind) && !GAME_KINDS.has(object.kind) && (
        <>
          <Rect
            width={w}
            height={h}
            cornerRadius={6}
            dash={[6, 4]}
            stroke={CLAUDE_COLOR}
            strokeWidth={2}
            fill="transparent"
          />
          <Text
            width={w}
            height={h}
            padding={6}
            text={object.label}
            fontSize={13}
            fill={CLAUDE_COLOR}
            listening={false}
          />
        </>
      )}
    </Group>
  );
}

const BUILT_IN = new Set(["box", "circle", "arrow"]);
const GAME_KINDS = new Set(["mark", "board", "cell"]);
/** Objects the comparator recognized from strokes (D89). */
const SHAPES = "shapes";
const SEEN = "#339af0";

function RecognizedShape({ object, tag }: { object: SceneObject; tag?: string | undefined }) {
  const [x, y, w, h] = object.box;
  const style = { stroke: SEEN, strokeWidth: 1.5, dash: [5, 4], opacity: 0.9, listening: false };
  const ends =
    object.geom && "a" in object.geom ? (object.geom as { a: Point2; b: Point2 }) : undefined;
  switch (object.kind) {
    case "line":
      return ends ? <Line points={[...ends.a, ...ends.b]} {...style} /> : null;
    case "crossing":
      return <Ellipse x={x} y={y} radiusX={5} radiusY={5} fill={SEEN} listening={false} />;
    case "box":
      return <Rect x={x} y={y} width={w} height={h} {...style} />;
    case "circle":
      return <Ellipse x={x + w / 2} y={y + h / 2} radiusX={w / 2} radiusY={h / 2} {...style} />;
    case "arrow":
      return ends ? (
        <Arrow
          points={[...ends.a, ...ends.b]}
          pointerLength={10}
          pointerWidth={10}
          fill={SEEN}
          {...style}
        />
      ) : null;
    case "symbol":
      return (
        <>
          <Rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} cornerRadius={4} {...style} />
          <Text
            x={x - 4}
            y={y - 20}
            text={tag ?? object.label}
            fontSize={12}
            fill={SEEN}
            listening={false}
          />
        </>
      );
    default:
      return null;
  }
}

/** A board the grid block built from the user's own lines: their ink already shows it. */
const drawnBoard = (o: SceneObject) =>
  (o.geom as { from?: string } | undefined)?.from === "crossings";

/** The inner lines of an n × n board. */
function BoardLines({ w, h, n }: { w: number; h: number; n: number }) {
  const lines: number[][] = [];
  for (let k = 1; k < n; k++) {
    lines.push([(w * k) / n, 0, (w * k) / n, h], [0, (h * k) / n, w, (h * k) / n]);
  }
  return (
    <>
      {lines.map((points, i) => (
        <Line
          key={i}
          points={points}
          stroke="#222222"
          strokeWidth={4}
          lineCap="round"
          listening={false}
        />
      ))}
    </>
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
  if (kind === "board") {
    const side = Math.max(w, h);
    return <Rect x={x} y={y} width={side} height={side} {...style} />;
  }
  if (kind === "circle")
    return <Ellipse x={x + w / 2} y={y + h / 2} radiusX={w / 2} radiusY={h / 2} {...style} />;
  return (
    <Arrow points={[...from, ...to]} fill={color} pointerLength={12} pointerWidth={12} {...style} />
  );
}
