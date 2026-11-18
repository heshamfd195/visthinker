import { useMemo } from "react";
import { Layer, Stage, Text } from "react-konva";
import { createSession } from "./session.ts";
import { useWindowSize } from "./useWindowSize.ts";

export function App() {
  const session = useMemo(() => createSession(), []);
  const { width, height } = useWindowSize();

  return (
    <Stage width={width} height={height}>
      <Layer listening={false}>
        <Text
          x={16}
          y={16}
          text={`Visthinker · fakes: ${session.fakes.join(", ")}`}
          fontSize={13}
          fill="#888"
        />
      </Layer>
    </Stage>
  );
}
