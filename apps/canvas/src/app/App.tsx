import type { Box, Stroke } from "@visthinker/contract";
import {
  colorsFromStory,
  moveObject,
  placeObject,
  recordStroke,
  type PlaceInput,
} from "@visthinker/core";
import { useCallback, useEffect, useMemo } from "react";
import { Layer, Stage, Text } from "react-konva";
import { InkLayer } from "../features/ink/index.ts";
import { markColors, ObjectsLayer } from "../features/objects/index.ts";
import { Panel, PANEL_WIDTH, StoryPanel, usePanels } from "../features/panels/index.ts";
import { MessageStrip, winningLine } from "../features/talk/index.ts";
import { Toolbar, useToolbar } from "../features/toolbar/index.ts";
import { bridgeUrlFromPage } from "../adapters/ws-transport/index.ts";
import { createSession } from "./session.ts";
import { useFrame } from "./useFrame.ts";
import { useLinkStatus } from "./useLinkStatus.ts";
import { useStoryVersion } from "./useStoryVersion.ts";
import { useWindowSize } from "./useWindowSize.ts";

export function App() {
  const session = useMemo(
    () => createSession({ bridgeUrl: bridgeUrlFromPage(window.location.search) }),
    [],
  );
  const link = useLinkStatus(session.transport);

  // Connect one tick after mount: React's dev mode mounts twice, and a socket from the throwaway
  // first mount would take the bridge's one tab slot (D82 ④). Cleanup cancels it before it opens.
  useEffect(() => {
    const bridge = session.bridge;
    if (!bridge) return;
    let opened = false;
    const timer = setTimeout(() => {
      opened = true;
      bridge.start();
    }, 0);
    return () => {
      clearTimeout(timer);
      if (opened) bridge.close();
    };
  }, [session]);
  const screen = useWindowSize();
  const storyOpen = usePanels((s) => s.open["story"] ?? false);
  // The canvas takes what the open panels leave.
  const width = screen.width - (storyOpen ? PANEL_WIDTH : 0);
  const height = screen.height;
  const { tool, color } = useToolbar();
  const version = useStoryVersion(session.story);

  // The core pushes the scene through the renderer port (T13); the story drives the rest.
  const objects = useFrame(session.renderer);
  const events = useMemo(() => session.story.all(), [session, version]);
  const colors = useMemo(
    () => new Map([...colorsFromStory(events), ...markColors(events)]),
    [events],
  );
  const highlight = useMemo(() => winningLine(events), [events]);

  const now = useCallback(() => session.clock.now(), [session]);
  const nextId = useCallback(() => session.strokes.nextId(), [session]);
  const onStroke = useCallback(
    (stroke: Stroke) => recordStroke(session.story, session.strokes, stroke),
    [session],
  );
  const onPlace = useCallback(
    (input: PlaceInput) => placeObject(session.story, session.scene, input),
    [session],
  );
  const onTap = useCallback((at: [number, number]) => session.games.tap(at), [session]);
  const onPlaceBoard = useCallback(
    (box: Box) => {
      try {
        session.games.placeBoard("tic-tac-toe", box);
      } catch (error) {
        console.warn(error instanceof Error ? error.message : error); // e.g. a board is already there
      }
    },
    [session],
  );
  const onMove = useCallback(
    (id: string, dx: number, dy: number) =>
      moveObject(session.story, session.scene, id, { dx, dy }),
    [session],
  );

  return (
    <div style={{ position: "relative", display: "flex", height: "100%" }}>
      <main style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <Stage width={width} height={height} style={{ touchAction: "none" }}>
          <InkLayer
            width={width}
            height={height}
            now={now}
            nextId={nextId}
            onStroke={onStroke}
            onTap={onTap}
            color={color}
            enabled={tool === "pen"}
          />
          <ObjectsLayer
            width={width}
            height={height}
            objects={objects}
            colors={colors}
            tool={tool}
            color={color}
            highlight={highlight}
            onPlace={onPlace}
            onPlaceBoard={onPlaceBoard}
            onMove={onMove}
          />
          <Layer listening={false}>
            <Text
              x={16}
              y={height - 28}
              text={`events: ${version} · bridge: ${session.bridge ? link : "not opened from Claude"} · fakes: ${session.fakes.join(", ")}`}
              fontSize={12}
              fill="#999"
            />
          </Layer>
        </Stage>
        <Toolbar />
        <MessageStrip
          events={events}
          onAnswer={(seq, choice) => session.actor.answer(seq, choice)}
        />
      </main>
      <Panel id="story" side="right" title={`Story · ${events.length}`}>
        <StoryPanel events={events} />
      </Panel>
    </div>
  );
}
