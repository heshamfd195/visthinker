// Undo, redo and clear that change the canvas too, not only the story (D130–D133 · D141).
// The story says what happened; the history keeps the scene and the visible ink in step with it:
// an undone stroke hides its ink and the objects read only from it, an undone mark or placed
// object leaves the scene, an undone move goes back, and a clear hides everything before it.
import type { Point2, SceneObject, VisEvent, Who } from "@visthinker/contract";
import type { SceneStore } from "./store.ts";
import type { Story } from "./story.ts";
import { findRedoable, findUndoable, undoneSeqs } from "./undo.ts";

interface Saved {
  objects: { object: SceneObject; owner: Who }[];
  strokes: string[];
}

/** What the history holds besides the story, so a saved project can bring it back (D142). */
export interface HistoryState {
  hidden: string[];
  saved: [number, Saved][];
}

export interface History {
  /** Takes back the user's latest action (D130). Undefined when there is nothing to take back. */
  undo(): VisEvent | undefined;
  /** Brings back what the user just undid (D133). */
  redo(): VisEvent | undefined;
  /** One event that hides everything; a single undo brings it all back (D132). */
  clear(): VisEvent | undefined;
  /** The eraser: hides these strokes and removes these objects, as one undoable event. */
  erase(ids: string[]): VisEvent | undefined;
  /** Takes back one given event, e.g. Claude's move in an accepted take-back (D131). */
  undoEvent(seq: number, who: Who, cause?: number): VisEvent | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
  /**
   * In a game, once Claude has answered the user's move, undo becomes a take-back that asks
   * Claude first (D131): the user's mark and Claude's answer to it.
   */
  takeBack(): { mine: VisEvent; theirs: VisEvent } | undefined;
  /** Strokes whose ink is hidden by an undo or a clear. */
  hiddenStrokes(): ReadonlySet<string>;
  state(): HistoryState;
}

export interface HistoryDeps {
  story: Story;
  scene: SceneStore;
  /** Every stroke id recorded so far, for a clear to hide. */
  strokeIds: () => string[];
  state?: HistoryState;
}

const round = (n: number) => Math.round(n * 10) / 10;

function shift(scene: SceneStore, id: string, dx: number, dy: number): void {
  if (!scene.has(id)) return;
  const by = (p: Point2): Point2 => [round(p[0] + dx), round(p[1] + dy)];
  scene.update(id, (o) => {
    const [x, y, w, h] = o.box;
    const geom =
      o.geom && "a" in o.geom && "b" in o.geom
        ? { ...o.geom, a: by(o.geom.a as Point2), b: by(o.geom.b as Point2) }
        : o.geom;
    return { ...o, box: [round(x + dx), round(y + dy), w, h], ...(geom ? { geom } : {}) };
  });
}

export function createHistory({ story, scene, strokeIds, state }: HistoryDeps): History {
  const hidden = new Set<string>(state?.hidden ?? []);
  const saved = new Map<number, Saved>(state?.saved ?? []);

  const save = (seq: number, objects: SceneObject[], strokes: string[] = []) => {
    const entry: Saved = {
      objects: objects.map((object) => ({ object, owner: scene.owner(object.id) ?? "user" })),
      strokes,
    };
    for (const object of objects) scene.remove(object.id);
    saved.set(seq, entry);
  };

  const restore = (seq: number) => {
    const entry = saved.get(seq);
    if (!entry) return;
    for (const { object, owner } of entry.objects) {
      if (!scene.has(object.id)) scene.add(object, owner);
    }
    for (const id of entry.strokes) hidden.delete(id);
    saved.delete(seq);
  };

  /**
   * What a `mark` or `place` event put on the canvas. A move names its cell, and the mark itself
   * comes in the Fast Brain's `place` that answers it; a board brings its cells along.
   */
  const objectsOf = (event: VisEvent): SceneObject[] => {
    if (event.type === "mark") {
      const placed = story
        .all()
        .find((e) => e.type === "place" && e.cause === event.seq && e.detail?.["mark"]);
      const id = placed?.detail?.["mark"];
      const mark = typeof id === "string" ? scene.get(id) : undefined;
      return mark ? [mark] : [];
    }
    // A mark placed into a cell (Claude's move): the mark, never the cell it names.
    const markId = event.detail?.["mark"];
    if (typeof markId === "string") {
      const mark = scene.get(markId);
      return mark ? [mark] : [];
    }
    const object = event.target ? scene.get(event.target) : undefined;
    if (!object) return [];
    const parts = scene
      .all()
      .filter(
        (o) =>
          object.parts.includes(o.id) ||
          o.relations.some((r) => r.type === "inside" && r.to === object.id && o.kind === "cell"),
      );
    return [object, ...parts];
  };

  /** Objects read only from strokes that are now all hidden. */
  const orphans = () =>
    scene.all().filter((o) => o.strokes?.length && o.strokes.every((s) => hidden.has(s)));

  const moveDelta = (event: VisEvent): [number, number] | undefined => {
    const from = event.detail?.["from"];
    const to = event.detail?.["to"];
    if (!Array.isArray(from) || !Array.isArray(to)) return undefined;
    return [Number(to[0]) - Number(from[0]), Number(to[1]) - Number(from[1])];
  };

  /** Reverses what the event did to the canvas. */
  const takeAway = (event: VisEvent) => {
    switch (event.type) {
      case "stroke":
        if (event.target) hidden.add(event.target);
        save(event.seq, orphans());
        break;
      case "mark":
      case "place":
        save(event.seq, objectsOf(event));
        break;
      case "move": {
        const d = moveDelta(event);
        if (d && event.target) shift(scene, event.target, -d[0], -d[1]);
        break;
      }
      case "clear":
      case "erase":
        restore(event.seq);
        break;
    }
  };

  /** Does the event's change again. */
  const bringBack = (event: VisEvent) => {
    switch (event.type) {
      case "stroke":
        if (event.target) hidden.delete(event.target);
        restore(event.seq);
        break;
      case "mark":
      case "place":
        restore(event.seq);
        break;
      case "move": {
        const d = moveDelta(event);
        if (d && event.target) shift(scene, event.target, d[0], d[1]);
        break;
      }
      case "clear":
        hideAll(event.seq);
        break;
      case "erase":
        hideSome(event.seq, (event.detail?.["ids"] as string[] | undefined) ?? []);
        break;
    }
  };

  const hideSome = (seq: number, ids: string[]) => {
    const strokes = ids.filter((id) => strokeIds().includes(id) && !hidden.has(id));
    for (const id of strokes) hidden.add(id);
    const objects = scene.all().filter((o) => ids.includes(o.id));
    const orphaned = orphans().filter((o) => !objects.some((x) => x.id === o.id));
    save(seq, [...objects, ...orphaned], strokes);
  };

  const hideAll = (seq: number) => {
    const strokes = strokeIds().filter((id) => !hidden.has(id));
    for (const id of strokes) hidden.add(id);
    save(seq, scene.all(), strokes);
  };

  // The canvas changes first, then the event goes in: the screen redraws on each new event.
  const undoOf = (target: VisEvent, who: Who, cause?: number) => {
    takeAway(target);
    return story.append({
      who,
      type: "undo",
      cause: target.seq,
      ...(target.target === undefined ? {} : { target: target.target }),
      ...(cause === undefined ? {} : { detail: { request: cause } }),
    });
  };

  /** The seq the next event will get: a clear or an erase keeps what it hid under it. */
  const nextSeq = () => story.all().length + 1;

  return {
    undo() {
      const target = findUndoable(story.all());
      return target && undoOf(target, "user");
    },
    redo() {
      const undoEvent = findRedoable(story.all());
      const target = undoEvent?.cause !== undefined ? story.get(undoEvent.cause) : undefined;
      if (!undoEvent || !target) return undefined;
      bringBack(target);
      return story.append({
        who: "user",
        type: "redo",
        cause: undoEvent.seq,
        ...(target.target === undefined ? {} : { target: target.target }),
      });
    },
    clear() {
      if (scene.all().length === 0 && strokeIds().every((id) => hidden.has(id))) return undefined;
      hideAll(nextSeq());
      return story.append({ who: "user", type: "clear" });
    },
    erase(ids) {
      const live = ids.filter(
        (id) => (strokeIds().includes(id) && !hidden.has(id)) || scene.has(id),
      );
      if (live.length === 0) return undefined;
      hideSome(nextSeq(), live);
      return story.append({ who: "user", type: "erase", detail: { ids: live } });
    },
    undoEvent(seq, who, cause) {
      const target = story.get(seq);
      if (!target || undoneSeqs(story.all()).has(seq)) return undefined;
      return undoOf(target, who, cause);
    },
    canUndo: () => findUndoable(story.all()) !== undefined,
    canRedo: () => findRedoable(story.all()) !== undefined,
    takeBack() {
      const events = story.all();
      const mine = findUndoable(events);
      if (mine?.type !== "mark") return undefined;
      const undone = undoneSeqs(events);
      // Claude's move is the Fast Brain placing its mark "by claude" (act → placeMark).
      const theirs = events.find(
        (e) =>
          e.seq > mine.seq &&
          e.type === "place" &&
          e.detail?.["by"] === "claude" &&
          typeof e.detail?.["mark"] === "string" &&
          !undone.has(e.seq),
      );
      return theirs ? { mine, theirs } : undefined;
    },
    hiddenStrokes: () => hidden,
    state: () => ({
      hidden: [...hidden],
      saved: [...saved].map(([k, v]) => [k, structuredClone(v)]),
    }),
  };
}
