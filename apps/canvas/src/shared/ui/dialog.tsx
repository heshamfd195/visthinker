// shadcn/ui's Dialog (D140), owned here.
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../cn.ts";

export const Dialog = D.Root;
export const DialogTitle = D.Title;
export const DialogDescription = D.Description;

/** A centred window over a dimmed canvas (D128). */
export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof D.Content> & { children: ReactNode }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/55 animate-in fade-in-0" />
      <D.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover",
          "text-popover-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95",
          className,
        )}
        {...props}
      >
        {children}
        <D.Close
          className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
