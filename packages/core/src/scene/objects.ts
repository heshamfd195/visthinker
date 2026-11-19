// Pre-built objects (D67): a box, a circle or an arrow the user places from the toolbar is data
// from the start, with no recognition needed. Placing and moving are events in the story.
import type { Box, Point2, SceneObject, VisEvent, Who } from "@visthinker/contract";
import type { SceneStore } from "./store.ts";
import type { Story } from "./story.ts";

/** Box, circle and arrow from the toolbar (D67); a glyph (π, ∑…) from the library and a text note (D123). */
export const PREBUILT_KINDS = ["box", "circle", "arrow", "glyph", "text"] as const;
export type PrebuiltKind = (typeof PREBUILT_KINDS)[number];

/** The pack name for objects made by construction, not recognized from ink. */
export const BUILTIN_PACK = "builtin";

const PREFIX: Record<PrebuiltKind, string> = {
  box: "b",
  circle: "o",
  arrow: "a",
  glyph: "g",
  text: "t",
};

export interface PlaceInput {
  kind: PrebuiltKind;
  box: Box;
  /** An arrow's ends, from `a` to `b`. */
  ends?: { a: Point2; b: Point2 };
  color: string;
  label?: string;
}

const round = (n: number) => Math.round(n * 10) / 10;
const roundBox = (b: Box): Box => [round(b[0]), round(b[1]), round(b[2]), round(b[3])];
const roundPoint = (p: Point2): Point2 => [round(p[0]), round(p[1])];

/** Adds the object to the scene and appends its `place` event. Returns both. */
export function placeObject(
  story: Story,
  scene: SceneStore,
  input: PlaceInput,
  who: Who = "user",
): { object: SceneObject; event: VisEvent } {
  if (!PREBUILT_KINDS.includes(input.kind)) throw new Error(`unknown kind ${String(input.kind)}`);
  const box = roundBox(input.box);
  const object: SceneObject = {
    id: scene.nextId(PREFIX[input.kind]),
    kind: input.kind,
    label: input.label ?? input.kind,
    pack: BUILTIN_PACK,
    parts: [],
    relations: [],
    box,
    confidence: 1,
    ...(input.ends ? { geom: { a: roundPoint(input.ends.a), b: roundPoint(input.ends.b) } } : {}),
  };
  scene.add(object, who);
  const event = story.append({
    who,
    type: "place",
    target: object.id,
    detail: { kind: object.kind, box, color: input.color },
  });
  return { object, event };
}

/** Moves an object by dx, dy (its box, and an arrow's ends) and appends a `move` event. */
export function moveObject(
  story: Story,
  scene: SceneStore,
  id: string,
  by: { dx: number; dy: number },
  who: Who = "user",
): VisEvent {
  const before = scene.get(id);
  if (!before) throw new Error(`no object ${id}`);
  const dx = round(by.dx);
  const dy = round(by.dy);
  const shift = (p: Point2): Point2 => [round(p[0] + dx), round(p[1] + dy)];
  scene.update(id, (o) => {
    const [x, y, w, h] = o.box;
    const geom =
      o.geom && "a" in o.geom && "b" in o.geom
        ? { ...o.geom, a: shift(o.geom.a as Point2), b: shift(o.geom.b as Point2) }
        : o.geom;
    return { ...o, box: [round(x + dx), round(y + dy), w, h], ...(geom ? { geom } : {}) };
  });
  return story.append({
    who,
    type: "move",
    target: id,
    detail: { from: before.box, to: scene.get(id)!.box },
  });
}

/** The colour each object was placed with, read back from the story. */
export function colorsFromStory(events: VisEvent[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const e of events) {
    const color = e.type === "place" ? e.detail?.["color"] : undefined;
    if (e.target && typeof color === "string") colors.set(e.target, color);
  }
  return colors;
}
