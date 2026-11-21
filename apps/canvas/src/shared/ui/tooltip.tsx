// shadcn/ui's Tooltip (D140), owned here.
import { Tooltip as T } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../cn.ts";

export function TooltipProvider(props: ComponentProps<typeof T.Provider>) {
  return <T.Provider delayDuration={300} {...props} />;
}

/** A label shown on hover or focus, e.g. a toolbar icon's name and its shortcut (D123). */
export function Tip({
  label,
  side = "bottom",
  children,
}: {
  label: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
}) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground",
            "animate-in fade-in-0 zoom-in-95",
          )}
        >
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
