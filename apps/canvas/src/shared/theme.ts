// Dark or light (D128): the `.dark` class on <html> switches every colour token in theme.css.
export type ThemeMode = "dark" | "light";

export function applyTheme(mode: ThemeMode, root: HTMLElement = document.documentElement): void {
  root.classList.toggle("dark", mode === "dark");
}

export function currentTheme(root: HTMLElement = document.documentElement): ThemeMode {
  return root.classList.contains("dark") ? "dark" : "light";
}

/** The drawing surface's colours (D128). Konva needs plain colours, so these are hex. */
export const CANVAS_COLORS = {
  black: "#0f0f0f",
  graphite: "#1f1f1f",
  paper: "#fbfaf7",
} as const;
export type CanvasColor = keyof typeof CANVAS_COLORS;

/** The default pen colour follows the canvas: light on a dark canvas, dark on paper. */
export const INK = "ink";
const LEGACY_INK = new Set([INK, "#222", "#222222"]);

export function isDarkCanvas(canvas: CanvasColor): boolean {
  return canvas !== "paper";
}

/** The colour to paint: "ink" (and the old dark ink) becomes the canvas's own ink. */
export function paint(color: string | undefined, canvas: CanvasColor): string {
  if (!color || LEGACY_INK.has(color)) return isDarkCanvas(canvas) ? "#e8e8e8" : "#222222";
  return color;
}
