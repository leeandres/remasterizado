"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  accent?: string;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  id?: string;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  accent = "#d8ff57",
  className,
  compact,
  disabled,
  format,
  onChange,
  id,
}: SliderProps) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const display = format ? format(value) : `${value}${unit}`;
  return (
    <div className={cn("group/slider", compact ? "space-y-0.5" : "space-y-1.5", className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <label
            htmlFor={id}
            className={cn(
              "select-none text-ink-300",
              compact ? "text-[10px]" : "text-[11px] font-medium",
            )}
          >
            {label}
          </label>
          <span
            className={cn(
              "num text-ink-100",
              compact ? "text-[10px]" : "text-[11px] font-semibold",
            )}
          >
            {display}
          </span>
        </div>
      )}
      <input
        id={id}
        type="range"
        className="range w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        style={
          {
            "--range-pct": `${pct}%`,
            "--range-accent": accent,
          } as CSSProperties
        }
      />
    </div>
  );
}
