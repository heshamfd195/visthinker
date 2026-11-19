// A one-of-a-few choice (theme, grid type…): shadcn/ui's ToggleGroup, single, owned here.
import { ToggleGroup as G } from "radix-ui";
import { cn } from "../cn.ts";

export interface SegmentedProps<V extends string> {
  value: V;
  options: readonly { value: V; label: string }[];
  onChange(value: V): void;
  label: string;
  className?: string;
}

export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: SegmentedProps<V>) {
  return (
    <G.Root
      type="single"
      value={value}
      aria-label={label}
      onValueChange={(next) => next && onChange(next as V)}
      className={cn("inline-flex overflow-hidden rounded-md border", className)}
    >
      {options.map((o) => (
        <G.Item
          key={o.value}
          value={o.value}
          className={cn(
            "px-2.5 py-1 text-xs text-muted-foreground outline-none",
            "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
            "hover:bg-accent data-[state=on]:hover:bg-primary focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
        >
          {o.label}
        </G.Item>
      ))}
    </G.Root>
  );
}
