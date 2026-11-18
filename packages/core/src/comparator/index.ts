// The comparator (D64): turns strokes into objects of the built-in `shapes` pack (D89).
// A straight stroke of 400+ units is a line at once (D109), and each pair of lines that cross makes
// a crossing. Every other stroke is grouped first (D96): strokes close in place and time, or in the
// same cell, form one group, read about 0.6 s after the last one. A group is then a one-stroke box,
// circle or arrow, or a symbol read by the cross rule and $P against the packs' templates (D97).
import type { Box, Pack, Point2, SceneObject, Stroke, VisEvent } from "@visthinker/contract";
import { boxOf, inPolygon, polyArea } from "../blocks/grid.ts";
import type { Clock } from "../ports/index.ts";
import { strokeBox } from "../scene/strokes.ts";
import type { SceneStore } from "../scene/store.ts";
import type { StrokeStore } from "../scene/strokes.ts";
import type { Story } from "../scene/story.ts";
import { crossingPoint, fitLine } from "./geometry.ts";
import { classifyShape } from "./shapes.ts";
import { createRecognizer, symbolSetsFrom } from "./symbols.ts";

export * from "./cross.ts";
export * from "./geometry.ts";
export * from "./shapes.ts";
export * from "./symbols.ts";

export const SHAPES_PACK = "shapes";

/** D109: a straight stroke at least this long is a line at once (D97 had 160). */
export const INSTANT_LINE_LENGTH = 400;
/** D97: a group is read this long after its last stroke. */
export const GROUP_MS = 600;
/** Outside cells, a stroke joins the open group if it starts within this long of its last stroke… */
export const GROUP_GAP_MS = 700;
/** …and its box is closer to the group's than this share of the larger of the two. */
export const GROUP_NEAR = 0.5;
/** A stroke this share of its cell's size or bigger isn't drawn in the cell. */
export const CELL_SYMBOL_MAX = 0.9;

export interface Comparator {
  /** Takes a recorded stroke: a line at once, or into a group read a moment later. */
  onStroke(stroke: Stroke, strokeEvent: VisEvent): string[];
  /** Reads the open group now instead of after GROUP_MS (e.g. before a call needs the scene). */
  flush(): void;
  /** Ids of the objects made from a stroke, and the crossings on them (for undo). */
  madeFrom(strokeId: string): string[];
}

export interface ComparatorDeps {
  scene: SceneStore;
  story: Story;
  strokes: StrokeStore;
  clock: Clock;
  /** The installed packs, read at each group for their symbol templates. */
  packs: () => readonly Pack[];
}

interface Group {
  cell?: string;
  strokes: string[];
  box: Box;
  lastEnd: number;
  lastSeq: number;
  cancel: () => void;
}

const size = (b: Box) => Math.max(b[2], b[3]);
const union = (a: Box, b: Box): Box =>
  boxOf([
    [a[0], a[1]],
    [a[0] + a[2], a[1] + a[3]],
    [b[0], b[1]],
    [b[0] + b[2], b[1] + b[3]],
  ]);
/** The gap between two boxes (0 when they overlap). */
const gap = (a: Box, b: Box) =>
  Math.hypot(
    Math.max(0, a[0] - (b[0] + b[2]), b[0] - (a[0] + a[2])),
    Math.max(0, a[1] - (b[1] + b[3]), b[1] - (a[1] + a[3])),
  );

export function createComparator({
  scene,
  story,
  strokes,
  clock,
  packs,
}: ComparatorDeps): Comparator {
  let group: Group | undefined;
  const isLine = (o: SceneObject) => o.kind === "line" && o.pack === SHAPES_PACK;
  const ends = (o: SceneObject) => o.geom as { a: Point2; b: Point2 };
  const strokeEnd = (s: Stroke) => s.t0 + (s.points.at(-1)?.[3] ?? 0);

  const recognized = (id: string, detail: Record<string, unknown>, cause: number) =>
    story.append({ who: "fastbrain", type: "recognized", target: id, detail, cause });

  const add = (
    object: Omit<SceneObject, "pack" | "parts" | "relations"> & Partial<SceneObject>,
  ) => {
    const full: SceneObject = { pack: SHAPES_PACK, parts: [], relations: [], ...object };
    scene.add(full, "user");
    return full;
  };

  /** A small stroke centred in a cell is drawn in that cell (D96). */
  const cellOf = (stroke: Stroke): string | undefined => {
    const [x, y, w, h] = strokeBox(stroke);
    const cell = scene
      .all()
      .find(
        (c) =>
          c.kind === "cell" &&
          c.geom &&
          "poly" in c.geom &&
          inPolygon([x + w / 2, y + h / 2], c.geom.poly as Point2[]),
      );
    if (!cell) return undefined;
    const poly = (cell.geom as { poly: Point2[] }).poly;
    return Math.max(w, h) < CELL_SYMBOL_MAX * Math.sqrt(polyArea(poly)) ? cell.id : undefined;
  };

  const joins = (g: Group, stroke: Stroke, cell: string | undefined) => {
    if (cell || g.cell) return g.cell === cell;
    const box = strokeBox(stroke);
    return (
      stroke.t0 - g.lastEnd <= GROUP_GAP_MS &&
      gap(g.box, box) < GROUP_NEAR * Math.max(size(g.box), size(box))
    );
  };

  const addLine = (
    stroke: Stroke,
    fit: { a: Point2; b: Point2; confidence: number },
    cause: number,
  ) => {
    const others = scene.all().filter(isLine);
    const line = add({
      id: scene.nextId("l"),
      kind: "line",
      label: "straight line",
      box: strokeBox(stroke),
      confidence: fit.confidence,
      strokes: [stroke.id],
      geom: { a: fit.a, b: fit.b },
    });
    recognized(line.id, { kind: "line" }, cause);
    const found = [line.id];
    for (const other of others) {
      const at = crossingPoint(ends(other), ends(line));
      if (!at) continue;
      const crossing = add({
        id: scene.nextId("x"),
        kind: "crossing",
        label: "crossing",
        relations: [
          { type: "on", to: other.id },
          { type: "on", to: line.id },
        ],
        box: [at[0], at[1], 0, 0],
        confidence: Math.min(other.confidence, line.confidence),
        geom: { at },
      });
      scene.update(other.id, (o) => ({
        ...o,
        relations: [...o.relations, { type: "crosses", to: line.id }],
      }));
      scene.update(line.id, (o) => ({
        ...o,
        relations: [...o.relations, { type: "crosses", to: other.id }],
      }));
      recognized(crossing.id, { kind: "crossing" }, cause);
      found.push(crossing.id);
    }
    return found;
  };

  /** Reads a closed group: a one-stroke shape outside cells, else a symbol. */
  const read = (g: Group) => {
    const drawn = g.strokes
      .map((id) => strokes.get(id))
      .filter((s): s is Stroke => s !== undefined);
    if (drawn.length === 0 || (g.cell !== undefined && !scene.has(g.cell))) return;
    const relations = g.cell ? [{ type: "inside", to: g.cell }] : [];

    if (drawn.length === 1 && !g.cell) {
      const shape = classifyShape(drawn[0]!);
      if (shape.kind !== null) {
        const object = add({
          id: scene.nextId({ box: "sb", circle: "sc", arrow: "sa" }[shape.kind]),
          kind: shape.kind,
          label: shape.kind,
          box: strokeBox(drawn[0]!),
          confidence: shape.confidence,
          strokes: [drawn[0]!.id],
          ...(shape.kind === "arrow" ? { geom: { a: shape.a, b: shape.b } } : {}),
        });
        recognized(object.id, { kind: shape.kind }, g.lastSeq);
        return;
      }
    }

    const points = drawn.map((s) => s.points.map(([x, y]): Point2 => [x, y]));
    const sets = symbolSetsFrom(packs());
    const result = sets.length
      ? createRecognizer(sets).recognize(points)
      : { label: "?", score: 0, alternatives: [], pack: undefined };
    const symbol = add({
      id: scene.nextId("y"),
      kind: "symbol",
      label: result.label,
      pack: result.pack ?? SHAPES_PACK,
      relations,
      box: boxOf(points.flat()),
      confidence: result.score,
      strokes: drawn.map((s) => s.id),
    });
    recognized(
      symbol.id,
      {
        kind: "symbol",
        label: result.label,
        score: result.score,
        alternatives: result.alternatives,
      },
      g.lastSeq,
    );
  };

  const close = () => {
    const g = group;
    if (!g) return;
    group = undefined;
    g.cancel();
    read(g);
  };

  return {
    onStroke(stroke, strokeEvent) {
      const verdict = fitLine(stroke);
      if (verdict.line && verdict.fit.length >= INSTANT_LINE_LENGTH) {
        close(); // a grid line ends whatever was being drawn
        return addLine(stroke, verdict.fit, strokeEvent.seq);
      }
      const cell = cellOf(stroke);
      if (group && !joins(group, stroke, cell)) close();
      const box = strokeBox(stroke);
      if (group) {
        group.cancel();
        group.strokes.push(stroke.id);
        group.box = union(group.box, box);
        group.lastEnd = Math.max(group.lastEnd, strokeEnd(stroke));
        group.lastSeq = strokeEvent.seq;
      } else {
        group = {
          ...(cell ? { cell } : {}),
          strokes: [stroke.id],
          box,
          lastEnd: strokeEnd(stroke),
          lastSeq: strokeEvent.seq,
          cancel: () => {},
        };
      }
      group.cancel = clock.after(GROUP_MS, close);
      return [];
    },

    flush: close,

    madeFrom(strokeId) {
      const made = scene
        .all()
        .filter((o) => o.pack !== "builtin" && o.strokes?.includes(strokeId))
        .map((o) => o.id);
      const crossings = scene
        .all()
        .filter((o) => o.kind === "crossing" && o.relations.some((r) => made.includes(r.to)))
        .map((o) => o.id);
      return [...made, ...crossings];
    },
  };
}
