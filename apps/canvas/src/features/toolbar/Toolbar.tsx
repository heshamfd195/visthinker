// The toolbar (D120): drawing tools, then undo and redo, then a "⋯" menu with save, export and
// clear. It never collapses (D121); only focus hides it.
import {
  ArrowRight,
  Circle,
  Download,
  Eraser,
  Grid3x3,
  Hand,
  MousePointer2,
  MoreHorizontal,
  Pencil,
  Redo2,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "../../shared/cn.ts";
import { paint, type CanvasColor } from "../../shared/theme.ts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Surface,
  Tip,
} from "../../shared/ui/index.ts";
import { COLORS, SHAPE_TOOLS, TOOLS, useToolbar } from "./toolbar.store.ts";
import type { Tool } from "./toolbar.types.ts";

const ICONS: Record<Tool, LucideIcon> = {
  select: MousePointer2,
  hand: Hand,
  pen: Pencil,
  eraser: Eraser,
  box: Square,
  circle: Circle,
  arrow: ArrowRight,
  board: Grid3x3,
  text: Type,
};

export interface ToolbarProps {
  canvas: CanvasColor;
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  onSave(): void;
  onExport(): void;
  /** Called once the person confirmed "Clear the whole canvas?" (D132). */
  onClear(): void;
}

const keyOf = (tool: Tool) => TOOLS.find((t) => t.tool === tool)!;

export function Toolbar({
  canvas,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onExport,
  onClear,
}: ToolbarProps) {
  const { tool, color, shape, setTool, setColor } = useToolbar();
  const [confirm, setConfirm] = useState(false);
  const ShapeIcon = ICONS[shape];
  const shapeOn = SHAPE_TOOLS.includes(tool);

  const toolButton = (t: Tool) => {
    const Icon = ICONS[t];
    const { label, key } = keyOf(t);
    return (
      <Tip key={t} label={`${label} · ${key.toUpperCase()}`}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={tool === t}
          className={cn(tool === t && "bg-accent text-accent-foreground")}
          onClick={() => setTool(t)}
        >
          <Icon />
        </Button>
      </Tip>
    );
  };

  return (
    <>
      <Surface className="flex items-center gap-0.5 p-1" role="toolbar" aria-label="Tools">
        {toolButton("select")}
        {toolButton("hand")}
        {toolButton("pen")}
        {toolButton("eraser")}
        <DropdownMenu>
          <Tip label="Shapes">
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Shapes"
                className={cn(shapeOn && "bg-accent text-accent-foreground")}
              >
                <ShapeIcon />
              </Button>
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="center">
            {SHAPE_TOOLS.map((t) => {
              const Icon = ICONS[t];
              const { label, key } = keyOf(t);
              return (
                <DropdownMenuItem key={t} onSelect={() => setTool(t)}>
                  <Icon />
                  <span className="flex-1">{label}</span>
                  <span className="text-xs text-muted-foreground">{key.toUpperCase()}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {toolButton("text")}
        <Popover>
          <Tip label="Colour">
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Colour">
                <span
                  className="size-3.5 rounded-full border border-border"
                  style={{ background: paint(color, canvas) }}
                />
              </Button>
            </PopoverTrigger>
          </Tip>
          <PopoverContent className="flex w-auto gap-1.5 p-2" side="bottom">
            {COLORS.map((c) => (
              <button
                key={c.color}
                type="button"
                aria-label={c.label}
                aria-pressed={color === c.color}
                onClick={() => setColor(c.color)}
                className={cn(
                  "size-6 rounded-full border-2 border-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  color === c.color && "border-foreground",
                )}
                style={{ background: paint(c.color, canvas) }}
              />
            ))}
          </PopoverContent>
        </Popover>
        <span className="mx-1 h-5 w-px bg-border" />
        <Tip label="Undo · ⌘Z">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo2 />
          </Button>
        </Tip>
        <Tip label="Redo · ⇧⌘Z">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <Redo2 />
          </Button>
        </Tip>
        <span className="mx-1 h-5 w-px bg-border" />
        <DropdownMenu>
          <Tip label="More">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onSave}>
              <Save /> Save
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onExport}>
              <Download /> Export
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setConfirm(true)}>
              <Trash2 /> Clear canvas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Surface>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="w-80 p-5">
          <DialogTitle className="text-sm font-medium">Clear the whole canvas?</DialogTitle>
          <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
            Everything goes, yours and Claude's. One undo brings it all back.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setConfirm(false);
                onClear();
              }}
            >
              Clear
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
