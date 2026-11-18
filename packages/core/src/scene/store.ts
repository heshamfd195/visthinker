// The scene store: what is on the canvas now (D79). Ids are stable and never reused:
// each prefix ("l", "x", "c", "m", "board") has its own counter that only goes up.
import type { SceneObject, Who } from "@visthinker/contract";

export interface SceneStore {
  /** The next id for a prefix, e.g. "l" → "l1", "l2"…; never handed out twice. */
  nextId(prefix: string): string;
  add(object: SceneObject, owner: Who): void;
  get(id: string): SceneObject | undefined;
  has(id: string): boolean;
  /** Changes an object; the change gets a copy and returns the new version. */
  update(id: string, change: (object: SceneObject) => SceneObject): void;
  /** Removes the object and every relation and part that points to it. */
  remove(id: string): void;
  /** Who made the object: the user's own drawing, a Fast Brain build, Claude's move. */
  owner(id: string): Who | undefined;
  /** Live objects in the order they were added, as copies. */
  all(): SceneObject[];
}

export function createSceneStore(): SceneStore {
  const objects = new Map<string, SceneObject>();
  const owners = new Map<string, Who>();
  const counters = new Map<string, number>();
  const used = new Set<string>();
  const copy = (object: SceneObject): SceneObject => structuredClone(object);

  return {
    nextId(prefix) {
      let id: string;
      do {
        const n = (counters.get(prefix) ?? 0) + 1;
        counters.set(prefix, n);
        id = `${prefix}${n}`;
      } while (used.has(id));
      used.add(id);
      return id;
    },
    add(object, owner) {
      if (objects.has(object.id)) throw new Error(`object ${object.id} already exists`);
      used.add(object.id);
      objects.set(object.id, copy(object));
      owners.set(object.id, owner);
    },
    get(id) {
      const object = objects.get(id);
      return object && copy(object);
    },
    has: (id) => objects.has(id),
    update(id, change) {
      const object = objects.get(id);
      if (!object) throw new Error(`no object ${id}`);
      const next = change(copy(object));
      if (next.id !== id) throw new Error("an update cannot change an object's id");
      objects.set(id, copy(next));
    },
    remove(id) {
      objects.delete(id);
      owners.delete(id);
      for (const object of objects.values()) {
        object.relations = object.relations.filter((r) => r.to !== id);
        object.parts = object.parts.filter((p) => p !== id);
      }
    },
    owner: (id) => owners.get(id),
    all: () => [...objects.values()].map(copy),
  };
}
