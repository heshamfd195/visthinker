// shadcn/ui's Switch (D140), owned here.
import { Switch as S } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../cn.ts";

export function Switch({ className, ...props }: ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        "inline-flex h-4 w-7 shrink-0 items-center rounded-full border border-transparent transition-colors",
        "bg-input data-[state=checked]:bg-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <S.Thumb
        className={cn(
          "pointer-events-none block size-3 rounded-full bg-background shadow transition-transform",
          "translate-x-0.5 data-[state=checked]:translate-x-3",
        )}
      />
    </S.Root>
  );
}
