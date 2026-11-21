// The guides button on the right-hand strip (T48 · D124): one background guide at a time, dots, a
// grid or writing lines, with its spacing, strength and style.
import { Grid3x3 } from "lucide-react";
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
import { useUi, type GuideKind, type GuideOpacity, type Guides } from "../shell/index.ts";

const KINDS: readonly { value: GuideKind; label: string }[] = [
  { value: "none", label: "None" },
  { value: "dots", label: "Dots" },
  { value: "grid", label: "Grid" },
  { value: "lines", label: "Lines" },
];

const OPACITIES: readonly { value: GuideOpacity; label: string }[] = [
  { value: "faint", label: "Faint" },
  { value: "soft", label: "Soft" },
  { value: "strong", label: "Strong" },
];

export function GuidesControl() {
  const guides = useUi((s) => s.guides);
  const set = useUi((s) => s.set);
  const patch = (p: Partial<Guides>) => set({ guides: { ...guides, ...p } });
  const { kind } = guides;
  return (
    <Control label="Guides" icon={<Grid3x3 />} active={kind !== "none"}>
      <Segmented label="Guide" value={kind} options={KINDS} onChange={(k) => patch({ kind: k })} />
      {kind !== "none" && (
        <>
          <Field label={kind === "lines" ? "Line spacing" : "Size"} value={guides.size}>
            <Slider
              aria-label="Guide size"
              min={12}
              max={96}
              step={4}
              value={[guides.size]}
              onValueChange={([size]) => size !== undefined && patch({ size })}
            />
          </Field>
          <div className="flex flex-col gap-1.5 text-xs">
            Opacity
            <Segmented
              label="Opacity"
              value={guides.opacity}
              options={OPACITIES}
              onChange={(opacity) => patch({ opacity })}
            />
          </div>
          {kind !== "dots" && (
            <Toggle
              label="Dotted"
              checked={guides.dotted}
              onChange={(dotted) => patch({ dotted })}
            />
          )}
          {kind === "lines" && (
            <Toggle
              label="Writing guide"
              checked={guides.writing}
              onChange={(writing) => patch({ writing })}
            />
          )}
          {kind !== "lines" && (
            <Toggle
              label="Snap to guide"
              checked={guides.snap}
              onChange={(snap) => patch({ snap })}
            />
          )}
        </>
      )}
      <Note>Background only. Claude never reads it as strokes.</Note>
    </Control>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange(on: boolean): void }) {
  return (
    <label className="flex items-center justify-between text-xs">
      {props.label}
      <Switch checked={props.checked} onCheckedChange={props.onChange} />
    </label>
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
