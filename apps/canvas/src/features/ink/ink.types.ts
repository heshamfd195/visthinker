/** A pointer sample as the canvas sees it: world units, pressure 0–1, time on the session clock. */
export interface RawPoint {
  x: number;
  y: number;
  pressure: number;
  time: number;
}

export interface PenStyle {
  color: string;
  width: number;
}
