// The scene described (T32): each object's relations, derived from geometry, so Claude reads the
// layout, not just a list. Relations the store already holds (a crossing on its lines, lines
// that cross) are kept; derived ones are added, never duplicated.
import type { Box, Point2, Relation, SceneObject } from "@visthinker/contract";

/** How close counts, in world units. */
export const RELATION_TOLERANCES = {
  /** A child may stick out of its container by this much and still be inside. */
  insideSlack: 4,
  /** Boxes this close (or overlapping) are touching. */
  touchGap: 6,
  /** An arrow's end connects to an object whose box, grown by this much, holds it. */
  arrowReach: 15,
  /** Something on a line sits within this distance of it. */
  onLine: 8,
} as const;

/** Kinds that can hold other objects. */
const CONTAINERS = new Set(["box", "circle", "note"]);
/** Kinds that are parts of a structure, not free objects that touch things. */
const STRUCTURAL = new Set(["line", "crossing", "arrow"]);

const area = (b: Box) => b[2] * b[3];
const grow = (b: Box, d: number): Box => [b[0] - d, b[1] - d, b[2] + 2 * d, b[3] + 2 * d];
const holdsPoint = (b: Box, [x, y]: Point2) =>
  x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];
const holdsBox = (outer: Box, inner: Box, slack: number) =>
  inner[0] >= outer[0] - slack &&
  inner[1] >= outer[1] - slack &&
  inner[0] + inner[2] <= outer[0] + outer[2] + slack &&
  inner[1] + inner[3] <= outer[1] + outer[3] + slack;
const gap = (a: Box, b: Box) =>
  Math.hypot(
    Math.max(0, a[0] - (b[0] + b[2]), b[0] - (a[0] + a[2])),
    Math.max(0, a[1] - (b[1] + b[3]), b[1] - (a[1] + a[3])),
  );
const centre = (b: Box): Point2 => [b[0] + b[2] / 2, b[1] + b[3] / 2];

/** Distance from a point to a segment. */
function toSegment([x, y]: Point2, [a, b]: [Point2, Point2]): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

const ends = (o: SceneObject): [Point2, Point2] | undefined =>
  o.geom && "a" in o.geom && "b" in o.geom ? [o.geom.a as Point2, o.geom.b as Point2] : undefined;

/** The scene with each object's relations filled in. Returns copies; the store is untouched. */
export function describeScene(
  objects: readonly SceneObject[],
  tol = RELATION_TOLERANCES,
): SceneObject[] {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const derived = new Map<string, Relation[]>(objects.map((o) => [o.id, []]));
  const add = (from: string, type: string, to: string) => derived.get(from)!.push({ type, to });
  const has = (o: SceneObject, type: string) => o.relations.some((r) => r.type === type);

  for (const o of objects) {
    // inside: the smallest container that holds it (unless it already says where it is).
    if (!has(o, "inside") && o.kind !== "line" && o.kind !== "crossing") {
      const parent = objects
        .filter(
          (c) =>
            c.id !== o.id &&
            CONTAINERS.has(c.kind) &&
            area(c.box) > area(o.box) &&
            holdsBox(c.box, o.box, tol.insideSlack),
        )
        .sort((a, b) => area(a.box) - area(b.box))[0];
      if (parent) add(o.id, "inside", parent.id);
    }

    // connected: an arrow's tail, then its head, to what each end points at.
    const line = ends(o);
    if (o.kind === "arrow" && line) {
      for (const point of line) {
        const target = objects
          .filter(
            (t) =>
              t.id !== o.id &&
              !STRUCTURAL.has(t.kind) &&
              holdsPoint(grow(t.box, tol.arrowReach), point),
          )
          .sort((a, b) => area(a.box) - area(b.box))[0];
        if (
          target &&
          !derived.get(o.id)!.some((r) => r.type === "connected" && r.to === target.id)
        ) {
          add(o.id, "connected", target.id);
        }
      }
    }

    // on: a free object whose centre sits on a drawn line.
    if (!STRUCTURAL.has(o.kind)) {
      for (const l of objects) {
        const seg = l.kind === "line" ? ends(l) : undefined;
        if (seg && toSegment(centre(o.box), seg) <= tol.onLine) add(o.id, "on", l.id);
      }
    }
  }

  // touching: free objects that meet without one holding the other.
  const free = objects.filter((o) => !STRUCTURAL.has(o.kind));
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      const [a, b] = [free[i]!, free[j]!];
      const nested =
        holdsBox(a.box, b.box, tol.insideSlack) || holdsBox(b.box, a.box, tol.insideSlack);
      if (!nested && gap(a.box, b.box) <= tol.touchGap) {
        add(a.id, "touching", b.id);
        add(b.id, "touching", a.id);
      }
    }
  }

  return objects.map((o) => {
    const extra = derived
      .get(o.id)!
      .filter(
        (r) => byId.has(r.to) && !o.relations.some((k) => k.type === r.type && k.to === r.to),
      );
    return { ...structuredClone(o), relations: [...o.relations, ...extra] };
  });
}
