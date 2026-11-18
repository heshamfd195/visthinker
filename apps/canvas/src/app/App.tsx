import { recordStroke } from "@visthinker/core";
import type { Stroke } from "@visthinker/contract";
import { useCallback, useMemo, useState } from "react";
import { Layer, Stage, Text } from "react-konva";
import { InkLayer } from "../features/ink/index.ts";
import { createSession } from "./session.ts";
import { useWindowSize } from "./useWindowSize.ts";

export function App() {
  const session = useMemo(() => createSession(), []);
  const { width, height } = useWindowSize();
  const [strokeCount, setStrokeCount] = useState(0);

  const now = useCallback(() => session.clock.now(), [session]);
  const nextId = useCallback(() => session.strokes.nextId(), [session]);
  const onStroke = useCallback(
    (stroke: Stroke) => {
      recordStroke(session.story, session.strokes, stroke);
      setStrokeCount(session.strokes.all().length);
    },
    [session],
  );

  return (
    <Stage width={width} height={height} style={{ touchAction: "none" }}>
      <InkLayer width={width} height={height} now={now} nextId={nextId} onStroke={onStroke} />
      <Layer listening={false}>
        <Text
          x={16}
          y={16}
          text={`Visthinker · strokes: ${strokeCount} · fakes: ${session.fakes.join(", ")}`}
          fontSize={13}
          fill="#888"
        />
      </Layer>
    </Stage>
  );
}
