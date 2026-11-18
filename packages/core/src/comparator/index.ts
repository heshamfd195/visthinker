// The comparator (D64): turns strokes into objects of the built-in `shapes` pack (D89).
// A straight stroke of 400+ units is a line at once (D109), and each pair of lines that cross makes
// a crossing. One stroke can also be a box, a circle or an arrow. Anything else stays a plain
// stroke for now: grouping strokes into symbols comes with segmentation (T29 · D96).
import type { Point2, SceneObject, Stroke, VisEvent } from "@visthinker/contract";
import { strokeBox } from "../scene/strokes.ts";
import type { SceneStore } from "../scene/store.ts";
import type { Story } from "../scene/story.ts";
import { crossingPoint, fitLine } from "./geometry.ts";
import { classifyShape } from "./shapes.ts";

export * from "./cross.ts";
export * from "./geometry.ts";
export * from "./shapes.ts";
export * from "./symbols.ts";

export const SHAPES_PACK = "shapes";

/** D109: a straight stroke at least this long is a line at once (D97 had 160). */
export const INSTANT_LINE_LENGTH = 400;

export interface Comparator {
  /** Recognizes a recorded stroke; adds `recognized` events caused by its stroke event. */
  onStroke(stroke: Stroke, strokeEvent: VisEvent): string[];
  /** Ids of the objects made from a stroke, and the crossings on them (for undo). */
  madeFrom(strokeId: string): string[];
}

export function createComparator({
  scene,
  story,
}: {
  scene: SceneStore;
  story: Story;
}): Comparator {
  const isLine = (o: SceneObject) => o.kind === "line" && o.pack === SHAPES_PACK;
  const ends = (o: SceneObject) => o.geom as { a: Point2; b: Point2 };

  const recognized = (id: string, kind: string, cause: number) =>
    story.append({ who: "fastbrain", type: "recognized", target: id, detail: { kind }, cause });

  const add = (
    object: Omit<SceneObject, "pack" | "parts" | "relations"> & Partial<SceneObject>,
  ) => {
    const full: SceneObject = { pack: SHAPES_PACK, parts: [], relations: [], ...object };
    scene.add(full, "user");
    return full;
  };

  return {
    onStroke(stroke, strokeEvent) {
      const cause = strokeEvent.seq;
      const verdict = fitLine(stroke);
      if (verdict.line && verdict.fit.length >= INSTANT_LINE_LENGTH) {
        const others = scene.all().filter(isLine);
        const line = add({
          id: scene.nextId("l"),
          kind: "line",
          label: "straight line",
          box: strokeBox(stroke),
          confidence: verdict.fit.confidence,
          strokes: [stroke.id],
          geom: { a: verdict.fit.a, b: verdict.fit.b },
        });
        recognized(line.id, "line", cause);
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
          recognized(crossing.id, "crossing", cause);
          found.push(crossing.id);
        }
        return found;
      }

      const shape = classifyShape(stroke);
      if (shape.kind === null) return [];
      const prefix = { box: "sb", circle: "sc", arrow: "sa" }[shape.kind];
      const object = add({
        id: scene.nextId(prefix),
        kind: shape.kind,
        label: shape.kind,
        box: strokeBox(stroke),
        confidence: shape.confidence,
        strokes: [stroke.id],
        ...(shape.kind === "arrow" ? { geom: { a: shape.a, b: shape.b } } : {}),
      });
      recognized(object.id, shape.kind, cause);
      return [object.id];
    },

    madeFrom(strokeId) {
      const made = scene
        .all()
        .filter((o) => o.pack === SHAPES_PACK && o.strokes?.includes(strokeId))
        .map((o) => o.id);
      const crossings = scene
        .all()
        .filter((o) => o.kind === "crossing" && o.relations.some((r) => made.includes(r.to)))
        .map((o) => o.id);
      return [...made, ...crossings];
    },
  };
}
