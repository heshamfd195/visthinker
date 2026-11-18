// The composition root (D83): the one place that picks an adapter for each core port.
// The clock and renderer are real. Opened from the bridge's link, the transport is the real
// WebSocket (T18); opened on its own, it stays a fake. The bridge's packs replace the last fake.
import { ContractError, type BrowserCall } from "@visthinker/contract";
import {
  createMemoryPackSource,
  createMemoryTransport,
  createSceneStore,
  createStory,
  createStrokeStore,
  type CallHandler,
  type Clock,
  type PackSource,
  type SceneStore,
  type Story,
  type StrokeStore,
  type Transport,
} from "@visthinker/core";
import { createReactRenderer, type ReactRenderer } from "../adapters/react-renderer/index.ts";
import { createSystemClock } from "../adapters/system-clock/index.ts";
import { createWsTransport, type WsTransport } from "../adapters/ws-transport/index.ts";

export interface Session {
  clock: Clock;
  story: Story;
  scene: SceneStore;
  strokes: StrokeStore;
  renderer: ReactRenderer;
  transport: Transport;
  /** Set when the page was opened from the bridge's link. */
  bridge: WsTransport | undefined;
  packs: PackSource;
  /** Which ports still run on fakes, shown on the canvas until they're real. */
  fakes: string[];
}

export interface SessionOptions {
  clock?: Clock;
  /** The bridge's WebSocket address with its token, read from the page's link. */
  bridgeUrl?: string | null;
}

/** Until the tools are built (T19–T21), the canvas tells Claude which call it can't answer yet. */
const notYet: CallHandler = async (call: BrowserCall) => {
  throw new ContractError("unknown_call", `the canvas doesn't answer ${call} yet (T19–T21)`);
};

export function createSession(options: SessionOptions = {}): Session {
  const clock = options.clock ?? createSystemClock();
  const story = createStory(clock);
  const scene = createSceneStore();
  const renderer = createReactRenderer();
  // Until the Fast Brain drives it, the scene is pushed to the screen after every event.
  story.subscribe(() => renderer.render(scene.all()));
  const bridge = options.bridgeUrl ? createWsTransport({ url: options.bridgeUrl }) : undefined;
  const transport = bridge ?? createMemoryTransport();
  transport.serve(notYet);
  return {
    clock,
    story,
    scene,
    strokes: createStrokeStore(),
    renderer,
    transport,
    bridge,
    packs: createMemoryPackSource(),
    fakes: bridge ? ["packs"] : ["transport", "packs"],
  };
}
