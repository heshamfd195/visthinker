// The floating surface every part of the layout sits on (D119): a dark card over the canvas.
import type { ComponentProps } from "react";
import { cn } from "../cn.ts";

export function Surface({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "pointer-events-auto rounded-lg border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
