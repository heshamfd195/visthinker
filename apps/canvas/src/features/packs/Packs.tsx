// The packs panel, beside the right-hand side bar (D122): switch packs on or off, install more.
import {
  Package,
  PenLine,
  Plus,
  Shapes,
  Sparkles,
  ToggleRight,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Input, Surface, Switch, Tip } from "../../shared/ui/index.ts";
import { useUi } from "../shell/index.ts";
import {
  filterPacks,
  packIcon,
  packTag,
  splitPacks,
  type PackIcon,
  type PackRow,
} from "./packs.utils.ts";

export interface PacksPanelProps {
  packs: PackRow[];
  /** Whether the Visthinker API (the catalog) can be reached. */
  available: boolean;
  onToggle(name: string, on: boolean): void;
  onInstall(name: string): void;
  onNew(): void;
  onWriteWithClaude(): void;
}

const ICONS: Record<PackIcon, LucideIcon> = {
  pen: PenLine,
  shapes: Shapes,
  modes: ToggleRight,
  package: Package,
};

export function PacksPanel({
  packs,
  available,
  onToggle,
  onInstall,
  onNew,
  onWriteWithClaude,
}: PacksPanelProps) {
  const set = useUi((s) => s.set);
  const [search, setSearch] = useState("");
  const { installed, catalog } = splitPacks(filterPacks(packs, search));

  return (
    <Surface aria-label="Packs" className="flex max-h-full w-[300px] flex-col">
      <header className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <Package className="size-4 text-muted-foreground" />
        <span className="flex-1 text-sm font-semibold">Packs</span>
        <Tip label="Close">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close packs"
            onClick={() => set({ side: undefined })}
          >
            <X />
          </Button>
        </Tip>
      </header>

      <div className="px-3 pb-2">
        <Input
          type="search"
          placeholder="Search packs"
          aria-label="Search packs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <Heading>Installed · {installed.length}</Heading>
        <ul className="space-y-1.5">
          {installed.map((p) => (
            <li key={p.name}>
              <InstalledCard pack={p} onToggle={onToggle} />
            </li>
          ))}
        </ul>

        <Heading>From the catalog</Heading>
        {!available ? (
          <p className="px-1.5 text-xs text-muted-foreground">
            The Visthinker API isn&apos;t connected, so the catalog is empty.
          </p>
        ) : catalog.length === 0 ? (
          <p className="px-1.5 text-xs text-muted-foreground">Nothing more to install.</p>
        ) : (
          <ul className="space-y-1.5">
            {catalog.map((p) => {
              const Icon = ICONS[packIcon(p.name)];
              return (
                <li key={p.name} className="flex items-center gap-2.5 rounded-md border p-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {p.note ?? p.version}
                    </span>
                  </span>
                  <Button variant="outline" size="sm" onClick={() => onInstall(p.name)}>
                    Install
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="flex gap-1.5 border-t p-2">
        <Button variant="ghost" size="sm" className="flex-1" onClick={onNew}>
          <Plus />
          New pack
        </Button>
        <Button variant="ghost" size="sm" className="flex-1" onClick={onWriteWithClaude}>
          <Sparkles />
          Write with Claude
        </Button>
      </footer>
    </Surface>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <div className="px-1.5 pt-2 pb-1.5 text-xs text-muted-foreground">{children}</div>;
}

/** An installed pack: off means it stops reading the drawing but stays installed (D122). */
function InstalledCard({
  pack,
  onToggle,
}: {
  pack: PackRow;
  onToggle(name: string, on: boolean): void;
}) {
  const Icon = ICONS[packIcon(pack.name)];
  return (
    <div className="flex items-start gap-2.5 rounded-md border p-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm">{pack.name}</span>
          <span className="shrink-0 rounded border px-1 text-[10px] text-muted-foreground">
            {packTag(pack)}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{pack.version}</span>
        </div>
        {pack.note && <p className="truncate text-xs text-muted-foreground">{pack.note}</p>}
      </div>
      <Switch
        className="mt-0.5"
        checked={pack.enabled}
        onCheckedChange={(on) => onToggle(pack.name, on)}
        aria-label={`Switch ${pack.name} on or off`}
      />
    </div>
  );
}
