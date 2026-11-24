# 🎨 Design system

The one place for how Visual Thinker looks. The values live in code: [`theme.css`](../apps/canvas/src/shared/theme.css) for the UI tokens, [`theme.ts`](../apps/canvas/src/shared/theme.ts) for the canvas colours. This file explains them and the rules. If the two disagree, the code wins and this file gets fixed.

## ✋ Principles

| rule               | means                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⚫ greyscale first | the UI is grey. Colour is kept for meaning: your pen colours, what the canvas read (blue), what Claude added (violet), danger (red).                        |
| 🥞 two layers      | **Konva draws only the drawing**: ink, shapes, guides, selection. **Everything else is HTML floating on top**: toolbar, chat, panels, events box, settings. |
| 🤫 quiet UI        | the drawing is the star. Panels are small cards that collapse, and a focus state hides all but one button.                                                  |
| 🧩 owned pieces    | shadcn/ui components are copied into `shared/ui` and stripped to greyscale. We change them there, not with one-off styles.                                  |

## 🎨 Colour

### 🌓 UI tokens

All tokens are OKLCH greys, set in `:root` (light) and `.dark` (dark). Tailwind reads them as `bg-*`, `text-*`, `border-*`.

| token                          | used for                                                         | light              | dark                       |
| ------------------------------ | ---------------------------------------------------------------- | ------------------ | -------------------------- |
| `background` / `foreground`    | page and its text                                                | white / near black | dark grey / light grey     |
| `card`                         | floating surfaces (toolbar, panels)                              | white              | dark grey                  |
| `popover`                      | menus, popovers, dialogs                                         | white              | a step lighter than `card` |
| `primary`                      | the strongest control: a picked segment, default button, tooltip | near black         | light grey                 |
| `secondary`, `muted`, `accent` | quiet fills; `accent` is hover and a picked tool                 | pale grey          | mid-dark grey              |
| `muted-foreground`             | secondary text, icons, hints                                     | mid grey           | mid grey                   |
| `border`, `input`              | hairlines and field outlines                                     | pale grey          | white at 12% / 15%         |
| `ring`                         | focus rings                                                      | mid grey           | darker grey                |
| `destructive`                  | the only coloured token: clear and other "this deletes" buttons  | red                | softer red                 |

- 🌓 **Dark is the default.** The `.dark` class on `<html>` switches every token. Settings → appearance picks dark or light.
- 🎯 `--canvas` and `--ink` also sit in `theme.css` as tokens; the drawing itself uses the canvas colours below.

### 🖼️ Canvas colours

Konva needs plain colours, so these are hex in `theme.ts` (`CANVAS_COLORS`).

| name               | hex       | dark? |
| ------------------ | --------- | ----- |
| ⚫ black (default) | `#0f0f0f` | yes   |
| 🌑 graphite        | `#1f1f1f` | yes   |
| 📄 paper           | `#fbfaf7` | no    |

### 🖊️ Ink and the colours that mean something

| colour                                  | hex                                                  | where                                                                                                                                                                      |
| --------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🖊️ **ink**                              | `#e8e8e8` on black and graphite · `#222222` on paper | the default pen colour. It's stored as `"ink"` and **follows the canvas**, so a drawing stays readable when you switch. Selection outlines, handles and guides use it too. |
| 🔴 red · 🟢 green · 🔵 blue · 🟠 orange | `#e03131` · `#2f9e44` · `#1971c2` · `#f08c00`        | the other pen colours; they stay as they are on any canvas                                                                                                                 |
| 🔷 recognized blue                      | `#339af0`                                            | what the canvas read from your ink (`SEEN` in `features/objects/ObjectsLayer.tsx`)                                                                                         |
| 🟣 Claude's colour                      | `#7048e8`                                            | notes Claude adds through `act` (`CLAUDE_COLOR` in `features/objects/objects.utils.ts`)                                                                                    |
| ⚪ reply dot                            | `#bdbdbd`                                            | the small dot on an object Claude talked about; a click opens that message                                                                                                 |

## 🔤 Type

| what                           | font                                                                          | size                                                      |
| ------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| 🖥️ UI                          | `system-ui, sans-serif`, line height 1.4                                      | 13px base; settings → text size: S 12px · M 13px · L 15px |
| 🤖 Claude in the chat          | Tailwind's `font-serif` stack (switch it off in settings → Claude's typeface) | `text-sm`                                                 |
| 🙋 your messages               | the UI font                                                                   | `text-sm`                                                 |
| 📜 the events list             | `font-mono`                                                                   | 11px                                                      |
| 🏷️ small labels and hints      | the UI font                                                                   | `text-xs`, sometimes 10px or 11px                         |
| ✏️ text on the canvas          | `system-ui, sans-serif`                                                       | grows with its box                                        |
| π library glyphs on the canvas | `Georgia, serif`                                                              | grows with its box                                        |
| 🔷 a read symbol's label       | the canvas default                                                            | 12px                                                      |

- ✂️ Keep to these sizes. No new sizes for one place.

## 📏 Spacing, radius and borders

| thing                 | value                                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| 📐 spacing            | Tailwind's 4px steps. Gaps are mostly `gap-1.5` (6px) and `gap-2` (8px). |
| 🧭 floating panels    | 12px from the screen edges (`top-3`, `right-3`, `bottom-3`)              |
| ⭕ radius             | `--radius` is 8px: `sm` 4px · `md` 6px · `lg` 8px · `xl` 12px            |
| 🔘 buttons            | `rounded-md`; sizes 36px (`default`, `icon`) and 32px (`sm`, `icon-sm`)  |
| 🗂️ surfaces           | `Surface`: `rounded-lg`, `border`, `bg-card`, `shadow-sm`                |
| 💬 menus and popovers | `rounded-lg`, `border`, `bg-popover`, `shadow-md`                        |
| 🪟 dialogs            | `rounded-xl`, `shadow-lg`, over a black 55% overlay                      |
| ➖ borders            | 1px in the `border` token; never a colour                                |

## 🧩 Components

Every piece lives in `apps/canvas/src/shared/ui` and is exported from its `index.ts`.

| piece                       | from                  | for                                                                |
| --------------------------- | --------------------- | ------------------------------------------------------------------ |
| `Button`                    | shadcn/ui             | variants `default`, `secondary`, `outline`, `ghost`, `destructive` |
| `Tip`, `TooltipProvider`    | shadcn/ui Tooltip     | a name on hover, e.g. `Undo · ⌘Z`                                  |
| `DropdownMenu`              | shadcn/ui             | a list of commands or choices                                      |
| `Popover`                   | shadcn/ui             | small controls that stay open while you adjust them                |
| `Dialog`                    | shadcn/ui             | a window in the middle that needs you                              |
| `Switch`, `Slider`, `Input` | shadcn/ui             | on/off, a range, a text field                                      |
| `Segmented`                 | shadcn/ui ToggleGroup | one of a few choices (theme, text size)                            |
| `Surface`                   | ours                  | the card every floating part sits on                               |

- ✏️ **Icons: Lucide** (`lucide-react`), outline only. No other icon set.
- 🔘 Toolbar buttons are `ghost` + `icon-sm`; the picked tool gets `bg-accent`.

### 🤔 Popover, dropdown or dialog?

| use         | when                                               | today                                                                                                                       |
| ----------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 📋 dropdown | you pick one thing and it closes                   | select by arrow, box or lasso · the shapes button · the modes button · the "⋯" menu (save, export, clear) · the layout menu |
| 🎛️ popover  | you set something and watch it change              | the pen colour · the guides                                                                                                 |
| 🪟 dialog   | it needs your full attention, or it's a big window | "Clear the whole canvas?" · settings                                                                                        |

## 🖌️ On the canvas

| thing                        | how it looks                                                                                                                                        | code                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 🖊️ pen ink                   | a filled outline from `perfect-freehand`, from the raw points; pen size 4, smoothing 0.5 by default                                                 | `features/ink`                          |
| 🔲 placed box, circle, arrow | 3px line in the pen colour; a box has 4px corners                                                                                                   | `features/objects`                      |
| ✏️ placing a shape           | a dashed preview while you drag: dash 6 · 4, 70% opacity                                                                                            | `DraftShape` in `ObjectsLayer.tsx`      |
| 🔷 what was read             | recognized blue, 1.5px, dash 5 · 4, 90% opacity; a crossing is a blue dot (radius 5); a symbol gets a frame and a label like `X 87%`                | `RecognizedShape` in `ObjectsLayer.tsx` |
| 🟣 a note from Claude        | Claude's colour, 2px, dash 6 · 4, 6px corners, its label inside at 13px                                                                             | `ObjectShape` in `ObjectsLayer.tsx`     |
| ⬚ selection outline          | ink colour, 1.5px, dash 6 · 4, 80% opacity, 6px out from the thing, 6px corners; it turns with a turned box, circle, glyph or text                  | `ObjectsLayer.tsx`, `InkLayer.tsx`      |
| ⋯ pointed at                 | the same outline, **dotted** (2 · 4), when a chip or an event row points at it                                                                      | `ObjectsLayer.tsx`                      |
| 🐜 box and lasso select      | ink colour, 1.5px, dash 8 · 6, **marching** at 24px a second; all in screen pixels, so it looks the same at any zoom                                | `features/ink/ink.select.ts`            |
| 🔄 transform frame           | a dashed frame (4 · 4) in the ink colour, 6px out; 8px white handles with an ink border and 2px corners; a rotate handle above that snaps every 45° | `features/transform/TransformLayer.tsx` |

### 📐 Guides

One guide at a time, background only: the Fast Brain never reads it.

| setting       | values                                                                             |
| ------------- | ---------------------------------------------------------------------------------- |
| kind          | none · dots · grid · lines (lines can add a writing guide in the middle)           |
| size          | 24 by default; when you zoom out, guides closer than 6px on screen are thinned out |
| opacity       | faint 15% · soft 30% (default) · strong 55%                                        |
| dotted        | grid and lines drawn as round dots instead of solid                                |
| writing guide | dashed and lighter (70% of the guide's opacity)                                    |
| colour        | the ink colour                                                                     |
| snap          | placed things snap to dots or grid crossings                                       |

## 🚧 Open work

| issue                                                          | what                                              |
| -------------------------------------------------------------- | ------------------------------------------------- |
| [#85](https://github.com/heshamfd195/visual-thinker/issues/85) | cleaner selection design                          |
| [#86](https://github.com/heshamfd195/visual-thinker/issues/86) | cleaner design for drawing boxes and other shapes |
| [#87](https://github.com/heshamfd195/visual-thinker/issues/87) | simpler menus                                     |
