// Joins class names and lets a later Tailwind class win over an earlier one (shadcn/ui's `cn`).
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
