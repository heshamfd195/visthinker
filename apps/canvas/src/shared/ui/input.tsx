// shadcn/ui's Input (D140), owned here.
import type { ComponentProps } from "react";
import { cn } from "../cn.ts";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-8 w-full min-w-0 rounded-md border bg-transparent px-2.5 text-sm outline-none",
        "placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}
