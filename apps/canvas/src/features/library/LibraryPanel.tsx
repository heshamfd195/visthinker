// The library panel (T46 · D123): artifacts, symbols and the person's own drawings, to click
// into the middle of the view or drag onto the canvas.
import { BookOpen, FileUp, Plus, Sparkles, X } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { cn } from "../../shared/cn.ts";
import { Button, Input, Surface } from "../../shared/ui/index.ts";
import { useUi } from "../shell/index.ts";
import {
  BUILT_IN,
  filterItems,
  GROUPS,
  LIBRARY_DRAG_TYPE,
  loadYours,
  newId,
  normaliseStrokes,
  parseImportedSymbols,
  saveYours,
  strokesPreview,
  type LibraryFilter,
  type LibraryItem,
} from "./library.utils.ts";

export interface LibraryPanelProps {
  /** A tile was clicked: the parent drops the item in the middle of the view. */
  onPlace(item: LibraryItem): void;
  /** The current selection as a drawing item, or undefined when nothing is selected. */
  onAddSelection(): LibraryItem | undefined;
  /** Ask Claude to make a new item from a prompt. */
  onGenerate(prompt: string): void;
}

const FILTERS: readonly { value: LibraryFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...GROUPS,
];

export function LibraryPanel({ onPlace, onAddSelection, onGenerate }: LibraryPanelProps) {
  const set = useUi((s) => s.set);
  const [yours, setYours] = useState<LibraryItem[]>(() => loadYours());
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const shown = useMemo(
    () => filterItems([...BUILT_IN, ...yours], filter, search),
    [yours, filter, search],
  );

  const keep = (added: LibraryItem[]) => {
    if (!added.length) return;
    const next = [...yours, ...added];
    setYours(next);
    saveYours(next);
  };

  const addSelection = () => {
    const item = onAddSelection();
    if (!item) return;
    const name = window.prompt("Name this drawing", "My drawing");
    if (name === null) return;
    keep([
      {
        ...item,
        id: newId(),
        group: "yours",
        name: name.trim() || "My drawing",
        ...(item.strokes ? { strokes: normaliseStrokes(item.strokes) } : {}),
      },
    ]);
  };

  const importSymbols = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    try {
      keep(parseImportedSymbols(await picked.text()));
    } catch {
      // An unreadable file adds nothing.
    }
  };

  const generate = () => {
    const text = prompt.trim();
    if (!text) return;
    onGenerate(text);
    setPrompt("");
  };

  return (
    <Surface className="flex max-h-full w-[300px] flex-col overflow-hidden" aria-label="Library">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <BookOpen className="size-4 text-muted-foreground" />
        <h2 className="flex-1 text-sm font-medium">Library</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          aria-label="Close library"
          onClick={() => set({ side: undefined })}
        >
          <X />
        </Button>
      </header>

      <div className="flex flex-col gap-2 px-3 pt-3">
        <Input
          type="search"
          placeholder="Search"
          aria-label="Search the library"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {GROUPS.filter((g) => filter === "all" || filter === g.value).map((g) => {
          const items = shown.filter((i) => i.group === g.value);
          if (!items.length && g.value !== "yours") return null;
          return (
            <section key={g.value} className="mb-3 last:mb-0">
              <h3 className="mb-1.5 text-xs text-muted-foreground">{g.label}</h3>
              {items.length ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {items.map((item) => (
                    <Tile key={item.id} item={item} onPlace={onPlace} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {search ? "Nothing matches." : "Add a selection or import symbols."}
                </p>
              )}
            </section>
          );
        })}
      </div>

      <footer className="flex flex-col gap-1.5 border-t px-3 py-2.5">
        <Button variant="ghost" size="sm" className="justify-start" onClick={addSelection}>
          <Plus /> Add selection to library
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => file.current?.click()}
        >
          <FileUp /> Import symbols
        </Button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => void importSymbols(e)}
        />
        <p className="mt-1 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <Sparkles className="size-3.5" /> Generate with Claude
        </p>
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <Input
            placeholder="A pendulum, a triangle…"
            aria-label="What Claude should make"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="sm" disabled={!prompt.trim()}>
            Generate
          </Button>
        </form>
      </footer>
    </Surface>
  );
}

function Tile({ item, onPlace }: { item: LibraryItem; onPlace(item: LibraryItem): void }) {
  const drag = (e: DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(LIBRARY_DRAG_TYPE, JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
  };
  return (
    <button
      type="button"
      draggable
      onDragStart={drag}
      onClick={() => onPlace(item)}
      title={item.name}
      className={cn(
        "flex flex-col items-center gap-1 rounded-md border p-1.5 outline-none",
        "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 cursor-grab active:cursor-grabbing",
      )}
    >
      <span className="flex size-9 items-center justify-center text-foreground">
        <Preview item={item} />
      </span>
      <span className="w-full truncate text-center text-[10px] text-muted-foreground">
        {item.name}
      </span>
    </button>
  );
}

const svg = {
  width: 32,
  height: 32,
  viewBox: "0 0 32 32",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function Preview({ item }: { item: LibraryItem }) {
  switch (item.kind) {
    case "box":
      return (
        <svg {...svg}>
          <rect x="5" y="8" width="22" height="16" rx="2" />
        </svg>
      );
    case "circle":
      return (
        <svg {...svg}>
          <circle cx="16" cy="16" r="10" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...svg}>
          <path d="M5 16h21M20 10l6 6-6 6" />
        </svg>
      );
    case "symbol":
      return <span className="text-xl leading-none">{item.glyph}</span>;
    case "drawing": {
      const { paths, viewBox } = strokesPreview(item.strokes ?? []);
      return (
        <svg {...svg} viewBox={viewBox}>
          {paths.map((d, i) => (
            <path key={i} d={d} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      );
    }
  }
}
