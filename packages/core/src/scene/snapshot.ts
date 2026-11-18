// A project's canvas as data (D142): the story, the raw ink, the scene and the undo history.
// Saving takes a snapshot; opening a project builds fresh stores from one.
import {
  Snapshot,
  type SceneObject,
  type Stroke,
  type VisEvent,
  type Who,
} from "@visthinker/contract";
import type { HistoryState } from "./history.ts";
import type { SceneStore } from "./store.ts";
import type { Story } from "./story.ts";
import type { StrokeStore } from "./strokes.ts";

export interface SnapshotSource {
  story: Story;
  scene: SceneStore;
  strokes: StrokeStore;
  history: { state(): HistoryState };
}

export function takeSnapshot({ story, scene, strokes, history }: SnapshotSource): Snapshot {
  return {
    version: 1,
    events: story.all(),
    strokes: strokes.all(),
    objects: scene.all().map((object) => ({ object, owner: scene.owner(object.id) ?? "user" })),
    history: history.state(),
  };
}

export interface RestoredParts {
  events: VisEvent[];
  strokes: Stroke[];
  objects: { object: SceneObject; owner: Who }[];
  /** Every id the story ever named, so a restored scene never hands one out again. */
  usedIds: string[];
  history: HistoryState;
}

/** Checks a snapshot read from disk against the contract. Throws when it doesn't fit. */
export function readSnapshot(raw: unknown): RestoredParts {
  const snap = Snapshot.parse(raw);
  return {
    events: snap.events,
    strokes: snap.strokes,
    objects: snap.objects,
    usedIds: [
      ...new Set(
        snap.events.flatMap((e) => {
          const mark = e.detail?.["mark"];
          return [...(e.target ? [e.target] : []), ...(typeof mark === "string" ? [mark] : [])];
        }),
      ),
    ],
    history: snap.history as HistoryState,
  };
}
