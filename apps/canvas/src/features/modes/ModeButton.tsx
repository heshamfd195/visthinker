// The mode chip, top right (T50 · D129): auto by default, or a mode picked by hand that holds
// until the person chooses auto again.
import { MODES, type Mode } from "@visthinker/contract";
import type { ModeState } from "@visthinker/core";
import {
  BookOpen,
  Check,
  Gamepad2,
  GraduationCap,
  Wand2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../shared/cn.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../shared/ui/index.ts";
import { chipText, modeLabel, type ModeInfos } from "./modes.utils.ts";

export const MODE_ICONS: Record<Mode, LucideIcon> = {
  playing: Gamepad2,
  learning: BookOpen,
  teaching: GraduationCap,
  contributing: Wrench,
};

export interface ModeButtonProps {
  state: ModeState;
  /** Labels and roles from the `modes` pack (D139). */
  infos: ModeInfos;
  onPick(mode: Mode | "auto"): void;
}

export function ModeButton({ state, infos, onPick }: ModeButtonProps) {
  const chip = chipText(state, infos);
  const Icon = state.manual && state.mode ? MODE_ICONS[state.mode] : Wand2;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Mode: ${chip.main}${chip.sub ? `, ${chip.sub}` : ""}`}
          className={cn(
            "pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5",
            "text-xs text-card-foreground shadow-sm outline-none hover:bg-accent",
            "focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
        >
          <Icon className="size-3.5" />
          <span>{chip.main}</span>
          {chip.sub && <span className="text-muted-foreground">{chip.sub}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[270px]">
        <DropdownMenuItem onSelect={() => onPick("auto")} className="items-start">
          <Wand2 className="mt-0.5" />
          <span className="flex-1">
            Auto
            <span className="block text-xs text-muted-foreground">
              Claude picks from what you say and draw
            </span>
          </span>
          {!state.manual && <Check className="mt-0.5" aria-label="current" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {MODES.map((m) => {
          const ModeIcon = MODE_ICONS[m];
          const role = infos[m]?.role;
          return (
            <DropdownMenuItem key={m} onSelect={() => onPick(m)} className="items-start">
              <ModeIcon className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  {modeLabel(m, infos)}
                  {!state.manual && state.mode === m && (
                    <span className="rounded border px-1 text-[10px] leading-4 text-muted-foreground">
                      now
                    </span>
                  )}
                </span>
                {role && (
                  <span className="block truncate text-xs text-muted-foreground">{role}</span>
                )}
              </span>
              {state.manual && state.mode === m && (
                <Check className="mt-0.5" aria-label="current" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
