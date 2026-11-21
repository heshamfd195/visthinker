/** The toolbar's tools (D120). Box, circle, arrow and board sit under one "shapes" button. */
export type Tool =
  "select" | "hand" | "pen" | "eraser" | "box" | "circle" | "arrow" | "board" | "text";

/** How the select tool picks: the arrow clicks things; a box or a lasso is dragged around them. */
export type SelectBy = "pointer" | "box" | "lasso";
