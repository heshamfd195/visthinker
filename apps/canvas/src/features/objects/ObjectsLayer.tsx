import type { Point2, SceneObject } from "@visthinker/contract";
import type { PlaceInput } from "@visthinker/core";
import type Konva from "konva";
import { useRef, useState } from "react";
import { Arrow, Ellipse, Group, Layer, Line, Rect, Text } from "react-konva";
import { rotationOf } from "@visthinker/core";
import { itemName } from "../../shared/items.ts";
import { paint, type CanvasColor } from "../../shared/theme.ts";
import type { Tool } from "../toolbar/index.ts";
import { CLAUDE_COLOR, dragBox, isRealDrag } from "./objects.utils.ts";

interface Props {
  /** The visible part of the world, in world units. */
  view: { x: number; y: number; width: number; height: number };
  canvas: CanvasColor;
  objects: readonly SceneObject[];
  colors: Map<string, string>;
  tool: Tool;
  color: string;
  /** What each symbol was read as, e.g. "X 87%" (D97). */
  tags?: ReadonlyMap<string, string>;
  onPlace(input: PlaceInput): void;
  onMove(id: string, dx: number, dy: number): void;
  /** Ids selected now, outlined (D135). */
  selection: readonly string[];
  /** What a chip or the events box points at, outlined (D126 · D127). */
  pointAt?: string | undefined;
  /** The select tool picked an object (with shift: added to the selection). */
  onPick(id: string | undefined, add: boolean): void;
  /** The eraser touched an object. */
  onErase(ids: string[]): void;
  /** Snaps a placed point to the grid when snapping is on (D124). */
  snap?: (p: Point2) => Point2;
  /** The text tool clicked here. */
  onText(at: Point2): void;
}

const SHAPE_TOOLS: Tool[] = ["box", "circle", "arrow"];

type Draft = { from: Point2; to: Point2 };

/** Draws pre-built objects from the scene, places new ones, and moves them with the move tool. */
export function ObjectsLayer({
  view,
  canvas,
  objects,
  colors,
  tool,
  color,
  tags,
  onPlace,
  onMove,
  selection,
  pointAt,
  onPick,
  onErase,
  snap = (p) => p,
  onText,
}: Props) {
  // The drag lives in a ref: pointer events can arrive faster than React re-renders, and a
  // handler reading state would see the drag as it was at the last render (a fast drag got lost).
  // The state copy only drives the dashed preview.
  const drag = useRef<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const placing = SHAPE_TOOLS.includes(tool);

  const at = (e: Konva.KonvaEventObject<PointerEvent>): Point2 | null => {
    // World units: the stage may be zoomed and panned.
    const p = e.target.getStage()?.getRelativePointerPosition();
    return p ? snap([p.x, p.y]) : null;
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

  const ink = paint("ink", canvas);
  const outlined = new Set([...selection, ...(pointAt ? [pointAt] : [])]);
  return (
    <Layer listening={tool !== "pen" && tool !== "hand"}>
      {objects.map((o) => (
        <ObjectShape
          key={o.id}
          object={o}
          color={paint(colors.get(o.id), canvas)}
          draggable={tool === "select" && MOVABLE.has(o.kind) && o.pack !== SHAPES}
          tag={tags?.get(o.id)}
          onMove={onMove}
          onPress={(add) => {
            if (tool === "eraser") onErase([o.id]);
            else if (tool === "select") onPick(o.id, add);
          }}
        />
      ))}
      {objects
        .filter((o) => outlined.has(o.id))
        .map((o) => (
          <Rect
            key={`sel-${o.id}`}
            // Turned with the object, around its centre.
            x={o.box[0] + o.box[2] / 2}
            y={o.box[1] + o.box[3] / 2}
            offsetX={o.box[2] / 2 + 6}
            offsetY={o.box[3] / 2 + 6}
            rotation={TURNS.has(o.kind) ? rotationOf(o) : 0}
            width={o.box[2] + 12}
            height={o.box[3] + 12}
            cornerRadius={6}
            stroke={ink}
            strokeWidth={1.5}
            dash={o.id === pointAt ? [2, 4] : [6, 4]}
            opacity={0.8}
            listening={false}
          />
        ))}
      {tool === "text" && (
        <Rect
          {...view}
          onPointerDown={(e) => {
            const p = at(e);
            if (p) onText(p);
          }}
        />
      )}
      {draft && placing && <DraftShape kind={tool} from={draft.from} to={draft.to} color={color} />}
      {placing && (
        <Rect
          {...view}
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
  tag?: string | undefined;
  onMove(id: string, dx: number, dy: number): void;
  onPress(add: boolean): void;
}) {
  const { object, color, draggable, tag, onMove, onPress } = props;
  const [x, y, w, h] = object.box;
  const style = { stroke: color, strokeWidth: 3, hitStrokeWidth: 14 };
  // What the comparator read from your ink: a light outline over it, so you see what it saw.
  if (object.pack === SHAPES || object.kind === "symbol" || object.kind === "word")
    return <RecognizedShape object={object} tag={tag} onPress={onPress} />;
  // A box, circle, glyph or text turns around its centre (the handles rotate it).
  const turn = TURNS.has(object.kind) ? rotationOf(object) : 0;
  return (
    <Group
      name={itemName(object.id)}
      x={x + w / 2}
      y={y + h / 2}
      offsetX={w / 2}
      offsetY={h / 2}
      rotation={turn}
      draggable={draggable}
      onPointerDown={(e) => {
        e.cancelBubble = true;
        onPress(e.evt.shiftKey);
      }}
      onDragEnd={(e) => onMove(object.id, e.target.x() - (x + w / 2), e.target.y() - (y + h / 2))}
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
      {/* A glyph from the library (π, ∑…) or a text note: the label is the content (D123). */}
      {(object.kind === "glyph" || object.kind === "text") && (
        <Text
          width={w}
          height={h}
          text={object.label}
          align={object.kind === "glyph" ? "center" : "left"}
          verticalAlign="middle"
          // Text grows with its box, so resizing it resizes the words (28 high is 18 px).
          fontSize={object.kind === "glyph" ? Math.max(18, h * 0.8) : Math.max(8, h * 0.64)}
          fontFamily={object.kind === "glyph" ? "Georgia, serif" : "system-ui, sans-serif"}
          fill={color}
        />
      )}
      {/* Anything else Claude adds is a labelled, dashed note. */}
      {!BUILT_IN.has(object.kind) && (
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

const BUILT_IN = new Set(["box", "circle", "arrow", "glyph", "text"]);
/** Kinds that turn around their centre. */
const TURNS = new Set(["box", "circle", "glyph", "text"]);
/** What the select tool can drag. */
const MOVABLE = BUILT_IN;
/** Objects the comparator recognized from strokes (D89). */
const SHAPES = "shapes";
const SEEN = "#339af0";

function RecognizedShape({
  object,
  tag,
  onPress,
}: {
  object: SceneObject;
  tag?: string | undefined;
  onPress(add: boolean): void;
}) {
  const [x, y, w, h] = object.box;
  const name = itemName(object.id);
  const style = {
    name,
    stroke: SEEN,
    strokeWidth: 1.5,
    dash: [5, 4],
    opacity: 0.9,
    listening: false,
  };
  // A symbol can be picked or erased by its frame (its ink sits on another layer).
  const press = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.cancelBubble = true;
    onPress(e.evt.shiftKey);
  };
  const ends =
    object.geom && "a" in object.geom ? (object.geom as { a: Point2; b: Point2 }) : undefined;
  switch (object.kind) {
    case "line":
      return ends ? <Line points={[...ends.a, ...ends.b]} {...style} /> : null;
    case "crossing":
      return (
        <Ellipse name={name} x={x} y={y} radiusX={5} radiusY={5} fill={SEEN} listening={false} />
      );
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
    case "word":
      return (
        <>
          <Rect
            x={x - 4}
            y={y - 4}
            width={w + 8}
            height={h + 8}
            cornerRadius={4}
            {...style}
            listening
            fill="transparent"
            onPointerDown={press}
          />
          <Text
            name={name}
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
