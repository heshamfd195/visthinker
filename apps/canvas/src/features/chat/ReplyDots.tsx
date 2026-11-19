// Reply dots (D136): a small dot on each object Claude said something about; a click opens
// the chat at that message.
import type { SceneObject, VisEvent } from "@visthinker/contract";
import type Konva from "konva";
import { Circle, Layer } from "react-konva";
import { focusMessage } from "./chat.focus.ts";
import { dotsFor } from "./chat.utils.ts";

const cursor = (e: Konva.KonvaEventObject<MouseEvent>, value: string) => {
  const container = e.target.getStage()?.container();
  if (container) container.style.cursor = value;
};

export interface ReplyDotsProps {
  events: readonly VisEvent[];
  objects: readonly SceneObject[];
}

export function ReplyDots({ events, objects }: ReplyDotsProps) {
  return (
    <Layer>
      {dotsFor(events, objects).map((d) => (
        <Circle
          key={d.target}
          x={d.x}
          y={d.y}
          radius={5}
          fill="#bdbdbd"
          hitStrokeWidth={8}
          onClick={() => focusMessage(d.seq)}
          onTap={() => focusMessage(d.seq)}
          onMouseEnter={(e) => cursor(e, "pointer")}
          onMouseLeave={(e) => cursor(e, "")}
        />
      ))}
    </Layer>
  );
}
