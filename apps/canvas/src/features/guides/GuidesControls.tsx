// The grid and lines buttons on the right-hand strip, each opening its settings (T48 · D124).
import { Grid3x3, Rows3 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../shared/cn.ts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Segmented,
  Slider,
  Switch,
  Tip,
} from "../../shared/ui/index.ts";
import { useUi, type GridKind, type LinesKind } from "../shell/index.ts";

const GRID_KINDS: readonly { value: GridKind; label: string }[] = [
  { value: "none", label: "None" },
  { value: "dots", label: "Dots" },
  { value: "squares", label: "Squares" },
];

const LINES_KINDS: readonly { value: LinesKind; label: string }[] = [
  { value: "none", label: "None" },
  { value: "ruled", label: "Ruled" },
  { value: "writing", label: "Writing" },
];

export function GridControl() {
  const grid = useUi((s) => s.grid);
  const set = useUi((s) => s.set);
  const patch = (p: Partial<typeof grid>) => set({ grid: { ...grid, ...p } });
  return (
    <Control label="Grid" icon={<Grid3x3 />} active={grid.kind !== "none"}>
      <Segmented
        label="Grid"
        value={grid.kind}
        options={GRID_KINDS}
        onChange={(kind) => patch({ kind })}
      />
      <Field label="Size" value={grid.size}>
        <Slider
          aria-label="Grid size"
          min={12}
          max={64}
          step={4}
          value={[grid.size]}
          onValueChange={([size]) => size !== undefined && patch({ size })}
        />
      </Field>
      <label className="flex items-center justify-between text-xs">
        Snap to grid
        <Switch checked={grid.snap} onCheckedChange={(snap) => patch({ snap })} />
      </label>
      <Note>Background only. Claude never reads it as strokes.</Note>
    </Control>
  );
}

export function LinesControl() {
  const lines = useUi((s) => s.lines);
  const set = useUi((s) => s.set);
  const patch = (p: Partial<typeof lines>) => set({ lines: { ...lines, ...p } });
  return (
    <Control label="Lines" icon={<Rows3 />} active={lines.kind !== "none"}>
      <Segmented
        label="Lines"
        value={lines.kind}
        options={LINES_KINDS}
        onChange={(kind) => patch({ kind })}
      />
      <Field label="Spacing" value={lines.spacing}>
        <Slider
          aria-label="Line spacing"
          min={24}
          max={96}
          step={4}
          value={[lines.spacing]}
          onValueChange={([spacing]) => spacing !== undefined && patch({ spacing })}
        />
      </Field>
      <Note>Writing adds a middle guide, like school paper.</Note>
    </Control>
  );
}

function Control({
  label,
  icon,
  active,
  children,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Popover>
      <Tip label={label} side="left">
        <PopoverTrigger asChild>
          <IconButton aria-label={label} active={active}>
            {icon}
          </IconButton>
        </PopoverTrigger>
      </Tip>
      <PopoverContent side="left" align="start" className="flex w-[220px] flex-col gap-3">
        <h3 className="text-xs font-medium">{label}</h3>
        {children}
      </PopoverContent>
    </Popover>
  );
}

function IconButton({
  active,
  className,
  ...props
}: ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex size-[26px] items-center justify-center rounded-md outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-4",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

function Field({ label, value, children }: { label: string; value: number; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-[11px] text-muted-foreground">{children}</p>;
}
