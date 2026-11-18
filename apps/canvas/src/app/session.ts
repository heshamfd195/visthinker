// The composition root (D83): the one place that picks an adapter for each core port.
// For now every port but the clock is an in-memory fake; the real Konva renderer (T13),
// WebSocket transport (T18) and bridge packs replace them one by one, without touching the core.
import {
  createMemoryPackSource,
  createMemoryRenderer,
  createMemoryTransport,
  createSceneStore,
  createStory,
  type Clock,
  type PackSource,
  type Renderer,
  type SceneStore,
  type Story,
  type Transport,
} from "@visthinker/core";
import { createSystemClock } from "../adapters/system-clock/index.ts";

export interface Session {
  clock: Clock;
  story: Story;
  scene: SceneStore;
  renderer: Renderer;
  transport: Transport;
  packs: PackSource;
  /** Which ports still run on fakes, shown on the canvas until they're real. */
  fakes: string[];
}

export function createSession(clock: Clock = createSystemClock()): Session {
  return {
    clock,
    story: createStory(clock),
    scene: createSceneStore(),
    renderer: createMemoryRenderer(),
    transport: createMemoryTransport(),
    packs: createMemoryPackSource(),
    fakes: ["renderer", "transport", "packs"],
  };
}
