// The composition root (D83): the one place that picks an adapter for each core port.
// The clock and renderer are real. Opened from the bridge's link, the transport is the real
// WebSocket (T18); opened on its own, it stays a fake. The bridge's packs replace the last fake.
import {
  createComparator,
  createMemoryPackSource,
  createMemoryTransport,
  createPackRegistry,
  createPackSearch,
  createSceneStore,
  createStory,
  createStrokeStore,
  createToolHandler,
  STARTER_PACKS,
  type Actor,
  type Games,
  type Clock,
  type Comparator,
  type PackRegistry,
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
  /** Applies the user's answers to Claude's asks and proposals. */
  actor: Actor;
  /** Boards placed from the toolbar, and the user's taps on them. */
  games: Games;
  /** Reads each finished stroke: lines, crossings, and one-stroke shapes (T27). */
  comparator: Comparator;
  /** Set when the page was opened from the bridge's link. */
  bridge: WsTransport | undefined;
  packs: PackSource;
  /** The packs loaded now: the starter packs (D74), and any Claude writes. */
  registry: PackRegistry;
  /** Which ports still run on fakes, shown on the canvas until they're real. */
  fakes: string[];
}

export interface SessionOptions {
  clock?: Clock;
  /** The bridge's WebSocket address with its token, read from the page's link. */
  bridgeUrl?: string | null;
}

export function createSession(options: SessionOptions = {}): Session {
  const clock = options.clock ?? createSystemClock();
  const story = createStory(clock);
  const scene = createSceneStore();
  const renderer = createReactRenderer();
  // Until the Fast Brain drives it, the scene is pushed to the screen after every event.
  story.subscribe(() => renderer.render(scene.all()));
  const strokes = createStrokeStore();
  const bridge = options.bridgeUrl ? createWsTransport({ url: options.bridgeUrl }) : undefined;
  const transport = bridge ?? createMemoryTransport();
  // Claude's calls are answered by the core (D90).
  const registry = createPackRegistry(STARTER_PACKS);
  const handler = createToolHandler({ clock, packs: registry, story, scene, strokes });
  transport.serve(handler);
  // The fast search over packs: a drawing that matches one asks "Tic-tac-toe?" (D68).
  createPackSearch({ story, scene, packs: registry, games: handler.games });
  return {
    clock,
    story,
    scene,
    strokes,
    renderer,
    transport,
    actor: handler.actor,
    games: handler.games,
    comparator: createComparator({
      scene,
      story,
      strokes,
      clock,
      packs: () => registry.names().map((name) => registry.get(name)!.pack),
    }),
    bridge,
    packs: createMemoryPackSource(),
    registry,
    fakes: bridge ? ["packs"] : ["transport", "packs"],
  };
}
