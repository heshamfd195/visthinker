// The `grid` block (D80 · D92 · D95): cells from the crossings, numbered row by row from the
// top left. Cells follow the drawn lines: each is a quad (`geom.poly`), not an upright square.
import type { Box, GridRules, Point2, SceneObject } from "@visthinker/contract";

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const at = (o: SceneObject): Point2 => (o.geom as { at: Point2 }).at;

export interface CrossingLattice {
  /** Crossing ids [i][j]: i over the horizontal lines (top to bottom), j over the vertical ones (left to right). */
  ids: string[][];
  points: Point2[][];
}

/**
 * Sorts crossings into a rows × cols lattice through the lines they are `on`, or says why they
 * don't make one. Lines of one family never cross each other; the family closer to the x axis
 * is the horizontal one. Two rows of two is the "two-by-two" a tic-tac-toe grid makes.
 */
export function arrangeCrossings(
  crossings: SceneObject[],
  lines: SceneObject[],
  rows: number,
  cols: number,
): CrossingLattice | { error: string } {
  if (crossings.length !== rows * cols)
    return {
      error: `${crossings.length} crossings, a ${rows} × ${cols} layout needs ${rows * cols}`,
    };
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const ends = new Map<string, [string, string]>();
  for (const x of crossings) {
    const on = x.relations.filter((r) => r.type === "on").map((r) => r.to);
    if (on.length !== 2 || !on.every((id) => lineById.has(id)))
      return { error: `${x.id} is not on two lines` };
    ends.set(x.id, [on[0]!, on[1]!]);
  }

  // Two-colour the lines: a crossing always joins one line of each family.
  const family = new Map<string, 0 | 1>();
  const used = [...new Set([...ends.values()].flat())];
  for (const start of used) {
    if (family.has(start)) continue;
    family.set(start, 0);
    const queue = [start];
    while (queue.length) {
      const line = queue.shift()!;
      for (const [a, b] of ends.values()) {
        const other = a === line ? b : b === line ? a : undefined;
        if (other === undefined) continue;
        const want = family.get(line) === 0 ? 1 : 0;
        if (!family.has(other)) {
          family.set(other, want);
          queue.push(other);
        } else if (family.get(other) !== want) return { error: "the lines do not make a grid" };
      }
    }
  }

  const flatness = (id: string) => {
    const g = lineById.get(id)!.geom as { a?: Point2; b?: Point2 } | undefined;
    if (!g?.a || !g.b) return 0.5;
    const dx = g.b[0] - g.a[0];
    const dy = g.b[1] - g.a[1];
    return Math.abs(dx) / (Math.hypot(dx, dy) || 1);
  };
  const groups = [0, 1].map((f) => used.filter((id) => family.get(id) === f));
  const flat = groups.map((g) => mean(g.map(flatness)));
  const [horizontal, vertical] = flat[0]! >= flat[1]! ? groups : [groups[1]!, groups[0]!];
  if (horizontal!.length !== rows || vertical!.length !== cols)
    return {
      error: `${horizontal!.length} × ${vertical!.length} lines, the layout needs ${rows} × ${cols}`,
    };

  const crossingsOn = (line: string) =>
    crossings.filter((x) => ends.get(x.id)!.includes(line)).map(at);
  const h = [...horizontal!].sort(
    (p, q) => mean(crossingsOn(p).map((c) => c[1])) - mean(crossingsOn(q).map((c) => c[1])),
  );
  const v = [...vertical!].sort(
    (p, q) => mean(crossingsOn(p).map((c) => c[0])) - mean(crossingsOn(q).map((c) => c[0])),
  );

  const ids: string[][] = [];
  const points: Point2[][] = [];
  for (const hi of h) {
    const idRow: string[] = [];
    const pointRow: Point2[] = [];
    for (const vj of v) {
      const x = crossings.filter((c) => {
        const [a, b] = ends.get(c.id)!;
        return (a === hi && b === vj) || (a === vj && b === hi);
      });
      if (x.length !== 1) return { error: `${hi} and ${vj} should cross once` };
      idRow.push(x[0]!.id);
      pointRow.push(at(x[0]!));
    }
    ids.push(idRow);
    points.push(pointRow);
  }

  for (let i = 0; i + 1 < rows; i++)
    for (let j = 0; j + 1 < cols; j++) {
      const quad = [points[i]![j]!, points[i]![j + 1]!, points[i + 1]![j + 1]!, points[i + 1]![j]!];
      if (!isConvexClockwise(quad))
        return { error: `the crossings around ${ids[i]![j]} fold over` };
    }
  return { ids, points };
}

/** Parses "c1..c9" into its prefix and count. */
export function parseIds(ids: string): { prefix: string; count: number } {
  const m = /^([a-z]+)1\.\.([a-z]+)(\d+)$/.exec(ids);
  if (!m || m[1] !== m[2]) throw new Error(`ids "${ids}" must look like c1..c9`);
  return { prefix: m[1]!, count: Number(m[3]) };
}

export interface GridPlan {
  board: Box;
  /** Row by row from the top left; `outer` cells touch the board's edge. */
  cells: { id: string; label: string; box: Box; poly: Point2[]; outer: boolean }[];
}

/**
 * Plans the board and its cells (D95). The crossings P[i][j] are the inner corners. The lattice
 * is extended by copying the middle cell outward along each line (P[0][j] = 2·P[1][j] − P[2][j],
 * and so on, corners from the extended rows), so sloppy line ends never matter.
 */
export function planGrid(
  rules: GridRules,
  crossings: SceneObject[],
  lines: SceneObject[],
): GridPlan | { error: string } {
  const { prefix, count } = parseIds(rules.ids);
  if (count !== rules.rows * rules.cols)
    return {
      error: `ids ${rules.ids} name ${count} cells, the grid has ${rules.rows * rules.cols}`,
    };
  const n = rules.rows - 1;
  const m = rules.cols - 1;
  if (n < 2 || m < 2) return { error: "a grid needs at least 2 × 2 crossings to size its cells" };
  const lattice = arrangeCrossings(crossings, lines, n, m);
  if ("error" in lattice) return lattice;

  const P: Point2[][] = Array.from({ length: n + 2 }, () => Array<Point2>(m + 2));
  const away = (p: Point2, q: Point2): Point2 => [2 * p[0] - q[0], 2 * p[1] - q[1]];
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) P[i]![j] = lattice.points[i - 1]![j - 1]!;
  for (let j = 1; j <= m; j++) {
    P[0]![j] = away(P[1]![j]!, P[2]![j]!);
    P[n + 1]![j] = away(P[n]![j]!, P[n - 1]![j]!);
  }
  for (let i = 0; i <= n + 1; i++) {
    P[i]![0] = away(P[i]![1]!, P[i]![2]!);
    P[i]![m + 1] = away(P[i]![m]!, P[i]![m - 1]!);
  }
  const R = P.map((row) => row.map(([x, y]): Point2 => [round1(x), round1(y)]));

  const cells: GridPlan["cells"] = [];
  for (let r = 0; r < rules.rows; r++) {
    for (let c = 0; c < rules.cols; c++) {
      const k = r * rules.cols + c + 1;
      const poly = [R[r]![c]!, R[r]![c + 1]!, R[r + 1]![c + 1]!, R[r + 1]![c]!];
      cells.push({
        id: `${prefix}${k}`,
        label: `cell ${k}`,
        box: boxOf(poly),
        poly,
        outer: r === 0 || c === 0 || r === rules.rows - 1 || c === rules.cols - 1,
      });
    }
  }
  return { board: boxOf(R.flat()), cells };
}

/**
 * Plans an upright board of `rows × cols` equal cells inside `box`: a ready-made board the user
 * places from the toolbar, so there are no drawn crossings to follow.
 */
export function planUniformGrid(rules: GridRules, box: Box): GridPlan | { error: string } {
  const { prefix, count } = parseIds(rules.ids);
  if (count !== rules.rows * rules.cols) {
    return {
      error: `ids ${rules.ids} name ${count} cells, the grid has ${rules.rows * rules.cols}`,
    };
  }
  const [x, y, w, h] = box;
  if (w <= 0 || h <= 0) return { error: "the board needs a size" };
  const cw = w / rules.cols;
  const ch = h / rules.rows;
  const cells: GridPlan["cells"] = [];
  for (let r = 0; r < rules.rows; r++) {
    for (let c = 0; c < rules.cols; c++) {
      const [x0, y0, x1, y1] = [x + c * cw, y + r * ch, x + (c + 1) * cw, y + (r + 1) * ch].map(
        round1,
      ) as [number, number, number, number];
      const poly: Point2[] = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ];
      const k = r * rules.cols + c + 1;
      cells.push({
        id: `${prefix}${k}`,
        label: `cell ${k}`,
        box: boxOf(poly),
        poly,
        outer: r === 0 || c === 0 || r === rules.rows - 1 || c === rules.cols - 1,
      });
    }
  }
  return { board: [round1(x), round1(y), round1(w), round1(h)], cells };
}

// ── polygon helpers ──────────────────────────────────────────────────────────

export function boxOf(points: Point2[]): Box {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return [round1(x), round1(y), round1(Math.max(...xs) - x), round1(Math.max(...ys) - y)];
}

/** Even-odd ray casting. */
export function inPolygon([x, y]: Point2, poly: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polyArea(poly: Point2[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    s += poly[j]![0] * poly[i]![1] - poly[i]![0] * poly[j]![1];
  return Math.abs(s) / 2;
}

export function polyCentre(poly: Point2[]): Point2 {
  return [mean(poly.map((p) => p[0])), mean(poly.map((p) => p[1]))];
}

export function scalePoly(poly: Point2[], k: number): Point2[] {
  const [cx, cy] = polyCentre(poly);
  return poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

/** Corners TL → TR → BR → BL make a convex quad that turns clockwise on screen (y down). */
function isConvexClockwise(quad: Point2[]): boolean {
  for (let k = 0; k < quad.length; k++) {
    const [ax, ay] = quad[k]!;
    const [bx, by] = quad[(k + 1) % quad.length]!;
    const [cx, cy] = quad[(k + 2) % quad.length]!;
    if ((bx - ax) * (cy - by) - (by - ay) * (cx - bx) <= 0) return false;
  }
  return true;
}
