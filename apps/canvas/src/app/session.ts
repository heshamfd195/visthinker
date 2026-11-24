// The composition root (D83): the one place that picks an adapter for each core port.
// The clock and renderer are real. Opened from the bridge's link, the transport is the real
// WebSocket (T18) and projects are saved through the bridge's HTTP API (D142); opened on its own,
// the transport stays a fake and nothing is saved.
//
// A session holds one connection and one set of packs, and one canvas at a time: opening a
// project builds a fresh canvas from its snapshot and serves Claude's calls from it instead.
import type { BrowserCall } from "@visthinker/contract";
import {
  createComparator,
  createMemoryPackSource,
  createMemoryTransport,
  createPackRegistry,
  createSceneStore,
  createStory,
  createStrokeStore,
  createToolHandler,
  STARTER_PACKS,
  type Actor,
  type CallRecord,
  type Clock,
  type Comparator,
  type History,
  type PackRegistry,
  type PackSource,
  type RestoredParts,
  type SceneStore,
  type Story,
  type StrokeStore,
  type ToolHandler,
  type Transport,
} from "@visthinker/core";
import {
  bridgeHttpFromPage,
  createBridgeHttp,
  type BridgeHttp,
} from "../adapters/bridge-http/index.ts";
import { createReactRenderer, type ReactRenderer } from "../adapters/react-renderer/index.ts";
import { createSystemClock } from "../adapters/system-clock/index.ts";
import { createWsTransport, type WsTransport } from "../adapters/ws-transport/index.ts";

/** One canvas: its story, ink, scene and the Fast Brain parts that read it. */
export interface Canvas {
  story: Story;
  scene: SceneStore;
  strokes: StrokeStore;
  renderer: ReactRenderer;
  /** Applies the user's answers to Claude's asks and proposals. */
  actor: Actor;
  /** Undo, redo, clear and the eraser (D130–D133). */
  history: History;
  /** Reads each finished stroke: lines, crossings, and one-stroke shapes (T27). */
  comparator: Comparator;
  /** Whether Claude is waiting for events now (D134), and each call it makes (D127). */
  handler: ToolHandler;
}

/** Which project the canvas now shows, for the `project` event Claude reads. */
export interface OpenedProject {
  id: string;
  name: string;
}

export interface Session extends Canvas {
  clock: Clock;
  transport: Transport;
  /** Set when the page was opened from the bridge's link. */
  bridge: WsTransport | undefined;
  /** The bridge's HTTP API, when opened from the bridge's link. */
  http: BridgeHttp | undefined;
  packs: PackSource;
  /** The packs loaded now: the starter packs (D74), and any Claude writes or you install. */
  registry: PackRegistry;
  /** Which ports still run on fakes, shown on the canvas until they're real. */
  fakes: string[];
  /** The canvas now. */
  canvas(): Canvas;
  /**
   * Replaces the canvas with a fresh one, or one rebuilt from a saved project. With `project`,
   * Claude is told: a `project` event opens the new story, and any wait still open on the old
   * canvas ends at once, so Claude's next call reaches this one.
   */
  open(parts?: RestoredParts, project?: OpenedProject): Canvas;
  /** Called after `open`. Returns an unsubscribe function. */
  onCanvas(listener: (canvas: Canvas) => void): () => void;
}

export interface SessionOptions {
  clock?: Clock;
  /** The bridge's WebSocket address with its token, read from the page's link. */
  bridgeUrl?: string | null;
  /** The page's query string, for the bridge's HTTP API. */
  search?: string;
}

export function createSession(options: SessionOptions = {}): Session {
  const clock = options.clock ?? createSystemClock();
  const bridge = options.bridgeUrl ? createWsTransport({ url: options.bridgeUrl }) : undefined;
  const transport = bridge ?? createMemoryTransport();
  const link = options.bridgeUrl && options.search ? bridgeHttpFromPage(options.search) : null;
  const http = link ? createBridgeHttp(link) : undefined;
  const registry = createPackRegistry(STARTER_PACKS);
  const listeners = new Set<(canvas: Canvas) => void>();

  let current: Canvas;
  let stopServing: (() => void) | undefined;

  const build = (parts?: RestoredParts): Canvas => {
    const story = createStory(clock, parts?.events);
    const scene = createSceneStore(parts?.objects, parts?.usedIds);
    const strokes = createStrokeStore(parts?.strokes);
    const renderer = createReactRenderer();
    // Until the Fast Brain drives it, the scene is pushed to the screen after every event.
    story.subscribe(() => renderer.render(scene.all()));
    // Claude's calls are answered by the core (D90).
    const handler = createToolHandler({
      clock,
      packs: registry,
      story,
      scene,
      strokes,
      ...(parts ? { history: parts.history } : {}),
    });
    renderer.render(scene.all());
    return {
      story,
      scene,
      strokes,
      renderer,
      actor: handler.actor,
      history: handler.history,
      handler,
      comparator: createComparator({
        scene,
        story,
        strokes,
        clock,
        packs: () => registry.active(),
      }),
    };
  };

  const open = (parts?: RestoredParts, project?: OpenedProject): Canvas => {
    const previous = current as Canvas | undefined;
    stopServing?.();
    current = build(parts);
    const handler = current.handler;
    stopServing = transport.serve((call: BrowserCall, args: unknown) => handler(call, args));
    if (project) {
      // Unread, so it's the first thing Claude reads here; a saved project's own events stay read.
      current.story.append({
        who: "user",
        type: "project",
        detail: {
          id: project.id,
          name: project.name,
          opened: parts ? "saved" : "new",
          objects: current.scene.all().length,
        },
      });
    }
    // A wait still open on the old canvas would never wake: end it, so Claude asks again here.
    previous?.handler.release();
    for (const listener of [...listeners]) listener(current);
    return current;
  };
  open();

  return {
    clock,
    transport,
    bridge,
    http,
    packs: createMemoryPackSource(),
    registry,
    fakes: bridge ? [] : ["transport"],
    canvas: () => current,
    open,
    onCanvas(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get story() {
      return current.story;
    },
    get scene() {
      return current.scene;
    },
    get strokes() {
      return current.strokes;
    },
    get renderer() {
      return current.renderer;
    },
    get actor() {
      return current.actor;
    },
    get history() {
      return current.history;
    },
    get comparator() {
      return current.comparator;
    },
    get handler() {
      return current.handler;
    },
  };
}

export type { CallRecord };
