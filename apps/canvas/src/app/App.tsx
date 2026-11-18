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
import { Toolbar, useToolbar } from "../features/toolbar/index.ts";
import { createSession } from "./session.ts";
import { useStoryVersion } from "./useStoryVersion.ts";
import { useWindowSize } from "./useWindowSize.ts";

export function App() {
  const session = useMemo(() => createSession(), []);
  const { width, height } = useWindowSize();
  const { tool, color } = useToolbar();
  const version = useStoryVersion(session.story);

  // The view re-reads the scene and colours from the core each time the story grows.
  const objects = useMemo(() => session.scene.all(), [session, version]);
  const colors = useMemo(() => colorsFromStory(session.story.all()), [session, version]);

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
    <>
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
    </>
  );
}
