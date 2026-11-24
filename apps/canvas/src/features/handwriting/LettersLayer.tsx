// The handwriting ability's debug view (T51): over each letter, what was measured. Its box and
// number, each part (a line solid, a curve dashed from end to end) with its number, a dot where
// ends meet, a ring where lines cross or touch, and each loop; the letter's number (#1) below it. All in recognized blue, the colour
// of what the canvas read, and in screen pixels so it looks the same at any zoom. Never listening.
import { Circle, Ellipse, Layer, Line, Rect, Text } from "react-konva";
import type { LetterMarks } from "./handwriting.utils.ts";

const SEEN = "#339af0";

export interface LettersLayerProps {
  letters: readonly LetterMarks[];
  /** Stage scale, so lines and labels stay the same size on screen. */
  scale: number;
}

export function LettersLayer({ letters, scale }: LettersLayerProps) {
  const px = 1 / (scale > 0 ? scale : 1);
  return (
    <Layer listening={false}>
      {letters.map((l) => (
        <LetterView key={l.key} letter={l} px={px} />
      ))}
    </Layer>
  );
}

function LetterView({ letter, px }: { letter: LetterMarks; px: number }) {
  const [x, y, w, h] = letter.box;
  return (
    <>
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        stroke={SEEN}
        strokeWidth={px}
        dash={[2 * px, 3 * px]}
        opacity={0.6}
      />
      <Text
        x={x}
        y={y + h + 6 * px}
        text={`#${letter.index}`}
        fontSize={12 * px}
        fontStyle="bold"
        fill={SEEN}
      />
      {letter.parts.map((p) => (
        <Line
          key={`p${p.label}`}
          points={[...p.a, ...p.b]}
          stroke={SEEN}
          strokeWidth={2 * px}
          dash={p.kind === "curve" ? [5 * px, 4 * px] : undefined}
          lineCap="round"
          opacity={0.9}
        />
      ))}
      {letter.parts.map((p) => (
        <Text
          key={`n${p.label}`}
          x={p.at[0] + 4 * px}
          y={p.at[1] - 12 * px}
          text={p.label}
          fontSize={10 * px}
          fill={SEEN}
        />
      ))}
      {letter.meets.map((at, i) => (
        <Circle key={`m${i}`} x={at[0]} y={at[1]} radius={3.5 * px} fill={SEEN} />
      ))}
      {letter.crossings.map((at, i) => (
        <Circle
          key={`c${i}`}
          x={at[0]}
          y={at[1]}
          radius={5 * px}
          stroke={SEEN}
          strokeWidth={1.5 * px}
        />
      ))}
      {letter.loops.map((l, i) => (
        <Ellipse
          key={`l${i}`}
          x={l.center[0]}
          y={l.center[1]}
          radiusX={l.rx}
          radiusY={l.ry}
          stroke={SEEN}
          strokeWidth={1.5 * px}
          dash={[3 * px, 3 * px]}
        />
      ))}
    </>
  );
}
