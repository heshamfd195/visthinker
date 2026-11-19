// shadcn/ui's Slider (D140), owned here.
import { Slider as S } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../cn.ts";

export function Slider({ className, ...props }: ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn("relative flex h-4 w-full touch-none items-center select-none", className)}
      {...props}
    >
      <S.Track className="relative h-1 grow overflow-hidden rounded-full bg-muted">
        <S.Range className="absolute h-full bg-primary" />
      </S.Track>
      <S.Thumb
        className="block size-3.5 rounded-full border bg-primary shadow outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label={props["aria-label"]}
      />
    </S.Root>
  );
}
