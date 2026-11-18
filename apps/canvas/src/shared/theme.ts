// Dark or light (D128): the `.dark` class on <html> switches every colour token in theme.css.
export type ThemeMode = "dark" | "light";

export function applyTheme(mode: ThemeMode, root: HTMLElement = document.documentElement): void {
  root.classList.toggle("dark", mode === "dark");
}

export function currentTheme(root: HTMLElement = document.documentElement): ThemeMode {
  return root.classList.contains("dark") ? "dark" : "light";
}
