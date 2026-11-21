// The selection's handles (like Figma or Illustrator): drag a corner or side to resize (Shift keeps
// the proportions), the handle above to rotate, the inside to move. Konva's Transformer works on
// an invisible frame around the selection; the frame's change is one matrix, previewed live on
// copies of the selected nodes and handed on once the drag ends. A click inside the frame still
// picks what's under it.
import type { Box } from "@visthinker/contract";
import type { Matrix } from "@visthinker/core";
import Konva from "konva";
import { useEffect, useRef } from "react";
import { Layer, Rect, Transformer } from "react-konva";
import { itemIdOf, itemName } from "../../shared/items.ts";

export interface TransformLayerProps {
  /** The frame around the selection, or undefined for no handles. */
  bounds: Box | undefined;
  /** Every id whose nodes move with the frame: the selection and the ink it's made of. */
  ids: readonly string[];
  /** The handle and frame colour: a plain colour, Konva can't read CSS tokens. */
  color: string;
  /** The frame was resized, rotated or moved by this matrix, in world units. */
  onReshape(m: Matrix): void;
  /** A click inside the frame: the item under it, or undefined for empty space. */
  onPick(id: string | undefined, add: boolean): void;
}

/** Rotation snaps every 45°, within 5°. */
const SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];
/** The smallest the frame can get, in screen pixels. */
const MIN_SIDE = 4;

export function TransformLayer({ bounds, ids, color, onReshape, onPick }: TransformLayerProps) {
  const frame = useRef<Konva.Rect>(null);
  const handles = useRef<Konva.Transformer>(null);
  /** The frame's transform when the drag began, and the live preview. */
  const drag = useRef<{ start: Konva.Transform; preview: Konva.Group; hidden: Konva.Node[] }>(
    undefined,
  );

  useEffect(() => {
    const t = handles.current;
    if (!t) return;
    t.nodes(bounds && frame.current ? [frame.current] : []);
    t.getLayer()?.batchDraw();
  }, [bounds]);

  if (!bounds) return null;
  const [x, y, w, h] = bounds;

  // Copies of the selected nodes in a group that follows the frame; the originals hide meanwhile.
  const begin = () => {
    const rect = frame.current;
    const stage = rect?.getStage();
    const layer = rect?.getLayer();
    if (!rect || !stage || !layer || drag.current) return;
    const preview = new Konva.Group({ listening: false });
    const hidden: Konva.Node[] = [];
    for (const id of ids)
      for (const node of stage.find(`.${itemName(id)}`)) {
        preview.add(node.clone({ listening: false, draggable: false }));
        node.hide();
        node.getLayer()?.batchDraw();
        hidden.push(node);
      }
    layer.add(preview);
    preview.moveToBottom();
    drag.current = { start: rect.getTransform().copy(), preview, hidden };
  };

  /** How the frame changed since the drag began, as one matrix. */
  const change = (): Konva.Transform | undefined => {
    const d = drag.current;
    const rect = frame.current;
    if (!d || !rect) return undefined;
    return rect.getTransform().copy().multiply(d.start.copy().invert());
  };

  const during = () => {
    const m = change();
    if (!m || !drag.current) return;
    drag.current.preview.setAttrs(m.decompose());
  };

  const end = () => {
    const m = change();
    const d = drag.current;
    drag.current = undefined;
    if (!d) return;
    d.preview.destroy();
    for (const node of d.hidden) {
      node.show();
      node.getLayer()?.batchDraw();
    }
    // Back to a plain frame; the new bounds arrive with the reshaped selection.
    frame.current?.setAttrs({ x, y, width: w, height: h, scaleX: 1, scaleY: 1, rotation: 0 });
    frame.current?.getLayer()?.batchDraw();
    const matrix = m?.getMatrix() as Matrix | undefined;
    if (matrix && !isIdentity(matrix)) onReshape(matrix);
  };

  // A click (no drag) inside the frame: pick what lies under it on the layers below.
  const click = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const add = "shiftKey" in e.evt && e.evt.shiftKey;
    const stage = e.target.getStage();
    const at = stage?.getPointerPosition();
    if (!stage || !at) return;
    const own = frame.current?.getLayer();
    const layers = stage.getLayers().filter((l) => l !== own && l.listening());
    for (const layer of layers.reverse()) {
      const shape = layer.getIntersection(at);
      const named = shape?.findAncestor((n: Konva.Node) => !!itemIdOf(n.name()), true);
      const id = named ? itemIdOf(named.name()) : shape && itemIdOf(shape.name());
      if (id) return onPick(id, add);
    }
    onPick(undefined, add);
  };

  return (
    <Layer>
      <Rect
        ref={frame}
        x={x}
        y={y}
        width={w}
        height={h}
        // Transparent but hit: the whole inside drags the selection.
        fill="transparent"
        draggable
        onDragStart={begin}
        onDragMove={during}
        onDragEnd={end}
        onTransformStart={begin}
        onTransform={during}
        onTransformEnd={end}
        onClick={click}
        onTap={click}
      />
      <Transformer
        ref={handles}
        // Free resize; Shift keeps the proportions (Konva flips keepRatio with Shift).
        keepRatio={false}
        flipEnabled={false}
        rotationSnaps={SNAPS}
        rotationSnapTolerance={5}
        anchorSize={8}
        anchorCornerRadius={2}
        anchorStroke={color}
        anchorFill="#fff"
        borderStroke={color}
        borderDash={[4, 4]}
        // The Transformer draws in screen pixels, whatever the zoom.
        padding={6}
        ignoreStroke
        boundBoxFunc={(old, next) =>
          Math.abs(next.width) < MIN_SIDE || Math.abs(next.height) < MIN_SIDE ? old : next
        }
      />
    </Layer>
  );
}

function isIdentity(m: Matrix): boolean {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  return (
    near(m[0], 1) &&
    near(m[1], 0) &&
    near(m[2], 0) &&
    near(m[3], 1) &&
    near(m[4], 0) &&
    near(m[5], 0)
  );
}
