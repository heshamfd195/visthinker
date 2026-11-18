# Shapes

The built-in pack (D74 · D89 · D96). Always loaded, so its `match` is empty.

| block      | what it finds                                                                                | scene object                                                         |
| ---------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `line`     | a stroke that is straight: every point near the fitted line, no steady bow, no doubling back | `kind: "line"`, ids `l1…`, `geom: { a, b }`, `strokes: [the stroke]` |
| `crossing` | two lines that cross (at least 20° apart; a line may stop a little short)                    | `kind: "crossing"`, ids `x1…`, `geom: { at }`, `on` both lines       |
| `symbol`   | strokes drawn close together, read together as one symbol                                    | `kind: "symbol"`, ids `y1…`, `label` "X", "O" or "?"                 |

Lines that cross get `crosses` relations to each other. Each object found adds a `recognized` event, `detail: { kind }`, whose `cause` is the stroke event.

## Symbols

`rules.json` → `symbol` holds 16 $P point-cloud templates: 10 X (both stroke orders and directions, square, wide, tall, off-centre and unequal) and 6 O (clockwise and anticlockwise, from the top, left and right, wide and tall ovals), resampled to `points: 32`. A drawing scores `1 / (1 + d)`, d the $P distance; below `threshold: 0.45` it is "?".

Data only: the geometry and the recognizer are core blocks (D80), built in week 3 (T27 · T28). Until then this pack loads and its blocks do nothing.
