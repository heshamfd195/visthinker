import type { Stroke } from "@visthinker/contract";
import {
  colorsFromStory,
  moveObject,
  placeObject,
  recordStroke,
  type PlaceInput,
} from "@visthinker/core";
import { useCallback, useMemo } from "react";
import { Layer, Stage, Text } from "react-konva";
import { InkLayer } from "../features/ink/index.ts";
import { ObjectsLayer } from "../features/objects/index.ts";
import { Panel, PANEL_WIDTH, StoryPanel, usePanels } from "../features/panels/index.ts";
import { Toolbar, useToolbar } from "../features/toolbar/index.ts";
import { createSession } from "./session.ts";
import { useFrame } from "./useFrame.ts";
import { useStoryVersion } from "./useStoryVersion.ts";
import { useWindowSize } from "./useWindowSize.ts";

export function App() {
  const session = useMemo(() => createSession(), []);
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
  const colors = useMemo(() => colorsFromStory(events), [events]);

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
            onPlace={onPlace}
            onMove={onMove}
          />
          <Layer listening={false}>
            <Text
              x={16}
              y={height - 28}
              text={`events: ${version} · fakes: ${session.fakes.join(", ")}`}
              fontSize={12}
              fill="#999"
            />
          </Layer>
        </Stage>
        <Toolbar />
      </main>
      <Panel id="story" side="right" title={`Story · ${events.length}`}>
        <StoryPanel events={events} />
      </Panel>
    </div>
  );
}
