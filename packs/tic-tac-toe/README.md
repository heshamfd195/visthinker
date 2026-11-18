# Tic-tac-toe

Two players take turns marking the cells of a 3 by 3 grid. You play X, Claude plays O, and you go first. Three marks in a row, column or diagonal win; a full grid with no line is a draw.

## How the canvas finds it

Draw two lines down and two across, crossing in a two-by-two layout: 4 lines and 4 crossings (D68). The `grid` block turns the crossings into cells `c1…c9`, row by row from the top left, following the lines as you drew them.

## Blocks

| block     | rules                                                 |
| --------- | ----------------------------------------------------- |
| `grid`    | 3 × 3 from the crossings, ids `c1..c9`                |
| `turns`   | user, then claude; user X, claude O                   |
| `line-of` | 3 in a row; the 8 win lines are listed by cell number |

Data only (D80 · D92): the blocks are in the core.
