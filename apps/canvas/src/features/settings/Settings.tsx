// The settings window in the middle of the canvas (D128). How things look stays in the browser;
// how things behave is saved on disk with the projects (D143).
import type { BehaviourSettings } from "@visthinker/contract";
import {
  Eye,
  Info,
  Keyboard,
  Lock,
  Palette,
  Pencil,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../../shared/cn.ts";
import { applyTheme, CANVAS_COLORS, type CanvasColor } from "../../shared/theme.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Segmented,
  Slider,
  Switch,
} from "../../shared/ui/index.ts";
import { useUi } from "../shell/index.ts";
import { SECTIONS, SHORTCUTS, type SectionId } from "./settings.utils.ts";

export interface SettingsDialogProps {
  /** Undefined until the bridge sends them (the canvas wasn't opened from Claude Code). */
  behaviour: BehaviourSettings | undefined;
  onBehaviour(next: BehaviourSettings): void;
  connected: boolean;
  version: string;
}

const ICONS: Record<SectionId, LucideIcon> = {
  appearance: Palette,
  drawing: Pencil,
  reading: Eye,
  claude: Sparkles,
  privacy: Lock,
  shortcuts: Keyboard,
  about: Info,
};

const CANVAS_NAMES: Record<CanvasColor, string> = {
  black: "Black",
  graphite: "Graphite",
  paper: "Paper",
};

export function SettingsDialog(props: SettingsDialogProps) {
  const open = useUi((s) => s.settingsOpen);
  const set = useUi((s) => s.set);
  const [section, setSection] = useState<SectionId>("appearance");
  const label = SECTIONS.find((s) => s.id === section)!.label;

  return (
    <Dialog open={open} onOpenChange={(o) => set({ settingsOpen: o })}>
      <DialogContent className="flex h-[400px] w-[560px] max-w-[calc(100vw-24px)] overflow-hidden">
        <nav aria-label="Settings sections" className="w-40 shrink-0 space-y-0.5 border-r p-2">
          {SECTIONS.map((s) => {
            const Icon = ICONS[s.id];
            return (
              <button
                key={s.id}
                type="button"
                aria-current={s.id === section || undefined}
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  s.id === section && "bg-accent text-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {s.label}
              </button>
            );
          })}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <DialogTitle className="px-5 pt-4 pb-3 text-base font-semibold">{label}</DialogTitle>
          <DialogDescription className="sr-only">Visthinker settings: {label}</DialogDescription>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            <Section id={section} {...props} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ id, ...props }: SettingsDialogProps & { id: SectionId }) {
  switch (id) {
    case "appearance":
      return <Appearance />;
    case "drawing":
      return <Drawing />;
    case "reading":
      return <Reading {...props} />;
    case "claude":
      return <Claude connected={props.connected} />;
    case "privacy":
      return <Privacy {...props} />;
    case "shortcuts":
      return <Shortcuts />;
    case "about":
      return <About version={props.version} />;
  }
}

/** One setting: its name on the left, its control on the right. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 border-b py-2 last:border-b-0">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="pt-2 text-xs text-muted-foreground">{children}</p>;
}

// How things look, kept in this browser (D143).
function Appearance() {
  const { theme, canvas, textSize, claudeSerif, showRead, showScore, showLetterParts, set } =
    useUi();
  return (
    <div>
      <Row label="Theme">
        <Segmented
          label="Theme"
          value={theme}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
          onChange={(next) => {
            applyTheme(next);
            set({ theme: next });
          }}
        />
      </Row>
      <Row label="Canvas colour">
        <div role="radiogroup" aria-label="Canvas colour" className="flex gap-1.5">
          {(Object.keys(CANVAS_COLORS) as CanvasColor[]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={canvas === c}
              aria-label={CANVAS_NAMES[c]}
              title={CANVAS_NAMES[c]}
              onClick={() => set({ canvas: c })}
              style={{ background: CANVAS_COLORS[c] }}
              className={cn(
                "size-6 rounded-md border border-muted-foreground/40 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                canvas === c && "ring-2 ring-ring ring-offset-2 ring-offset-popover",
              )}
            />
          ))}
        </div>
      </Row>
      <Row label="Text size">
        <Segmented
          label="Text size"
          value={textSize}
          options={[
            { value: "s", label: "S" },
            { value: "m", label: "M" },
            { value: "l", label: "L" },
          ]}
          onChange={(next) => set({ textSize: next })}
        />
      </Row>
      <Row label="Claude's typeface">
        <Segmented
          label="Claude's typeface"
          value={claudeSerif ? "serif" : "sans"}
          options={[
            { value: "serif", label: "Serif" },
            { value: "sans", label: "Sans" },
          ]}
          onChange={(next) => set({ claudeSerif: next === "serif" })}
        />
      </Row>
      <Row label="Show what was read">
        <Switch
          aria-label="Show what was read"
          checked={showRead}
          onCheckedChange={(on) => set({ showRead: on })}
        />
      </Row>
      <Row label="Show the score">
        <Switch
          aria-label="Show the score"
          checked={showScore}
          onCheckedChange={(on) => set({ showScore: on })}
        />
      </Row>
      <Row label="Show what handwriting measured">
        <Switch
          aria-label="Show what handwriting measured"
          checked={showLetterParts}
          onCheckedChange={(on) => set({ showLetterParts: on })}
        />
      </Row>
    </div>
  );
}

function Drawing() {
  const { penSize, smoothing, set } = useUi();
  return (
    <div>
      <Row label="Pen size">
        <div className="flex w-48 items-center gap-3">
          <Slider
            aria-label="Pen size"
            min={2}
            max={12}
            step={1}
            value={[penSize]}
            onValueChange={([v]) => v !== undefined && set({ penSize: v })}
          />
          <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">
            {penSize}
          </span>
        </div>
      </Row>
      <Row label="Smoothing">
        <div className="flex w-48 items-center gap-3">
          <Slider
            aria-label="Smoothing"
            min={0}
            max={1}
            step={0.1}
            value={[smoothing]}
            onValueChange={([v]) => v !== undefined && set({ smoothing: v })}
          />
          <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">
            {smoothing.toFixed(1)}
          </span>
        </div>
      </Row>
    </div>
  );
}

const ON_DISK_NOTE = "Open the canvas from Claude Code to change this; it's saved on disk.";

// How things behave, saved on disk (D143).
function Reading({ behaviour, onBehaviour }: SettingsDialogProps) {
  return (
    <div>
      <Row label="Ask Claude when the Fast Brain isn't sure">
        <Switch
          aria-label="Ask Claude when the Fast Brain isn't sure"
          disabled={!behaviour}
          checked={behaviour?.askClaudeWhenUnsure ?? true}
          onCheckedChange={(on) =>
            behaviour && onBehaviour({ ...behaviour, askClaudeWhenUnsure: on })
          }
        />
      </Row>
      {!behaviour && <Muted>{ON_DISK_NOTE}</Muted>}
    </div>
  );
}

function Privacy({ behaviour, onBehaviour }: SettingsDialogProps) {
  return (
    <div>
      {/* Off by default; nothing personal is kept (D47). */}
      <Row label="Save game stories (opt-in, nothing personal)">
        <Switch
          aria-label="Save game stories"
          disabled={!behaviour}
          checked={behaviour?.saveStories ?? false}
          onCheckedChange={(on) => behaviour && onBehaviour({ ...behaviour, saveStories: on })}
        />
      </Row>
      {!behaviour && <Muted>{ON_DISK_NOTE}</Muted>}
    </div>
  );
}

function Claude({ connected }: { connected: boolean }) {
  return (
    <div>
      <Row label="Connection">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              connected ? "bg-foreground" : "border border-muted-foreground",
            )}
          />
          {connected ? "Claude Code connected" : "Not connected"}
        </span>
      </Row>
      <Muted>
        Claude reaches the canvas through the visthinker MCP server. Permissions for its tools are
        set in Claude Code.
      </Muted>
    </div>
  );
}

function Shortcuts() {
  return (
    <table className="w-full text-sm">
      <tbody>
        {SHORTCUTS.map(([label, keys]) => (
          <tr key={label} className="border-b last:border-b-0">
            <td className="py-1.5">{label}</td>
            <td className="py-1.5 text-right">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                {keys}
              </kbd>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function About({ version }: { version: string }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-semibold">Visthinker</p>
      <p className="text-muted-foreground">Version {version}</p>
      <p className="text-muted-foreground">MIT licence</p>
      <Muted>Your projects are saved in ~/.visthinker/projects.</Muted>
    </div>
  );
}
