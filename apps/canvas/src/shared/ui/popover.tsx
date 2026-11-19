// shadcn/ui's Popover (D140), owned here.
import { Popover as P } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../cn.ts";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-64 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md outline-none",
          "animate-in fade-in-0 zoom-in-95",
          className,
        )}
        {...props}
      />
    </P.Portal>
  );
}
