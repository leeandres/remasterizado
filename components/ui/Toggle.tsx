"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function Toggle({ checked, onChange, label, disabled, size = "md", className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "focus-ring relative shrink-0 rounded-full border transition-all duration-200",
        size === "sm" ? "h-4 w-7" : "h-5 w-9",
        checked
          ? "border-lime-acid/50 bg-lime-acid/90 shadow-[0_0_12px_-2px_rgba(216,255,87,0.5)]"
          : "border-white/10 bg-white/[0.07]",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200",
          size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5",
          checked
            ? size === "sm"
              ? "left-[15px] bg-[#121507]"
              : "left-[19px] bg-[#121507]"
            : size === "sm"
              ? "left-[3px] bg-ink-300"
              : "left-[3px] bg-ink-300",
        )}
      />
    </button>
  );
}
