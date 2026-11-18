// The composition root (D83): the one place that picks an adapter for each core port.
// The clock and the renderer are real; the WebSocket transport (T18) and the bridge's packs
// replace the last two fakes later, without touching the core.
import {
  createMemoryPackSource,
  createMemoryTransport,
  createSceneStore,
  createStory,
  createStrokeStore,
  type Clock,
  type PackSource,
  type SceneStore,
  type Story,
  type StrokeStore,
  type Transport,
} from "@visthinker/core";
import { createReactRenderer, type ReactRenderer } from "../adapters/react-renderer/index.ts";
import { createSystemClock } from "../adapters/system-clock/index.ts";

export interface Session {
  clock: Clock;
  story: Story;
  scene: SceneStore;
  strokes: StrokeStore;
  renderer: ReactRenderer;
  transport: Transport;
  packs: PackSource;
  /** Which ports still run on fakes, shown on the canvas until they're real. */
  fakes: string[];
}

export function createSession(clock: Clock = createSystemClock()): Session {
  const story = createStory(clock);
  const scene = createSceneStore();
  const renderer = createReactRenderer();
  // Until the Fast Brain drives it, the scene is pushed to the screen after every event.
  story.subscribe(() => renderer.render(scene.all()));
  return {
    clock,
    story,
    scene,
    strokes: createStrokeStore(),
    renderer,
    transport: createMemoryTransport(),
    packs: createMemoryPackSource(),
    fakes: ["transport", "packs"],
  };
}
