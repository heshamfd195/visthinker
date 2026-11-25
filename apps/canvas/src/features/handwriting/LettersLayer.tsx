// What the handwriting ability read, over each letter (T51 · D116). Its name under it ("H 92%",
// "?" when unsure), and in the debug view what was measured: its box and number (#1), each part
// (a line solid, a curve dashed from end to end) with its number, a dot where ends meet, a ring
// where lines cross or touch, and each loop. All in recognized blue, the colour of what the canvas
// read, and in screen pixels so it looks the same at any zoom. The debug view also says who named
// each letter, your examples or the cards (D174). Never listening.
import { Fragment } from "react";
import { Circle, Ellipse, Layer, Line, Text } from "react-konva";
import type { LetterMarks } from "./handwriting.utils.ts";

const SEEN = "#339af0";

export interface LettersLayerProps {
  letters: readonly LetterMarks[];
  /** Stage scale, so lines and labels stay the same size on screen. */
  scale: number;
  /** Each letter's name under it (D116): "H 92%", or "?" when unsure. */
  names: boolean;
  /** Its score beside the name. */
  scores: boolean;
  /** What was measured, drawn over it (the debug view). */
  parts: boolean;
}

export function LettersLayer({ letters, scale, names, scores, parts }: LettersLayerProps) {
  const px = 1 / (scale > 0 ? scale : 1);
  return (
    <Layer listening={false}>
      {letters.map((l) => (
        <Fragment key={l.key}>
          {parts && <LetterParts letter={l} px={px} />}
          {names && l.name && <LetterName letter={l} px={px} score={scores} />}
          {parts && l.by && <LetterNamedBy letter={l} px={px} />}
        </Fragment>
      ))}
    </Layer>
  );
}

/** "H 92%" centred under the letter; "?" when the cards aren't sure (D115 · D116). */
function LetterName({ letter, px, score }: { letter: LetterMarks; px: number; score: boolean }) {
  const [x, y, w, h] = letter.box;
  const name = letter.name!;
  // "…" while you're still writing it; "?" when unsure (D115).
  const text = name.clear && score ? `${name.label} ${Math.round(name.score)}%` : name.label;
  const width = 120 * px;
  return (
    <Text
      x={x + w / 2 - width / 2}
      y={y + h + 6 * px}
      width={width}
      align="center"
      text={text}
      fontSize={13 * px}
      fontStyle="bold"
      fill={SEEN}
      opacity={name.clear ? 1 : 0.7}
    />
  );
}

/** In the debug view, who named it, under its name: your examples or the cards (D174). */
function LetterNamedBy({ letter, px }: { letter: LetterMarks; px: number }) {
  const [x, y, w, h] = letter.box;
  const width = 160 * px;
  return (
    <Text
      x={x + w / 2 - width / 2}
      y={y + h + 22 * px}
      width={width}
      align="center"
      text={letter.by}
      fontSize={10 * px}
      fill={SEEN}
      opacity={0.8}
    />
  );
}

function LetterParts({ letter, px }: { letter: LetterMarks; px: number }) {
  const [corner] = letter.outline;
  const turn = letter.turn ?? 0;
  return (
    <>
      {/* The box it was measured in, turned with a tilted letter. */}
      <Line
        points={letter.outline.flat()}
        closed
        stroke={SEEN}
        strokeWidth={px}
        dash={[2 * px, 3 * px]}
        opacity={0.6}
      />
      <Text
        x={corner![0]}
        y={corner![1]}
        offsetX={-2 * px}
        offsetY={-2 * px}
        rotation={turn}
        text={
          turn ? `#${letter.index} · turned ${Math.round(Math.abs(turn))}°` : `#${letter.index}`
        }
        fontSize={10 * px}
        fill={SEEN}
        opacity={0.8}
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
          rotation={turn}
          stroke={SEEN}
          strokeWidth={1.5 * px}
          dash={[3 * px, 3 * px]}
        />
      ))}
    </>
  );
}
