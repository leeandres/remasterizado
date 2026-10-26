"use client";

import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent } from "react";
import { cn, clamp } from "@/lib/utils";

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  size?: number;
  accent?: string;
  disabled?: boolean;
}

export function Knob({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  format,
  onChange,
  size = 54,
  accent = "#d8ff57",
  disabled,
}: KnobProps) {
  const drag = useRef<{ startY: number; startValue: number } | null>(null);
  const pct = clamp((value - min) / (max - min), 0, 1);
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * 0.75;
  const display = format ? format(value) : String(value);

  const commit = (next: number) => {
    if (disabled) return;
    const stepped = Math.round(next / step) * step;
    onChange(Number(clamp(stepped, min, max).toFixed(6)));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startValue: value };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const delta = (drag.current.startY - event.clientY) / 130;
    commit(drag.current.startValue + delta * (max - min));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      commit(value + step);
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      commit(value - step);
    } else if (event.key === "Home") {
      event.preventDefault();
      commit(min);
    } else if (event.key === "End") {
      event.preventDefault();
      commit(max);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={display}
        disabled={disabled}
        tabIndex={0}
        className={cn(
          "focus-ring relative touch-none rounded-full outline-none transition-opacity",
          disabled ? "opacity-35" : "cursor-ns-resize",
        )}
        style={{ width: size, height: size }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => defaultValue !== undefined && commit(defaultValue)}
        onKeyDown={onKeyDown}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[135deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth="3"
            strokeDasharray={`${arc} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={accent}
            strokeWidth="3"
            strokeDasharray={`${arc * pct} ${circumference}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${accent}55)` }}
          />
        </svg>
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: accent,
            transform: `translate(-50%, -50%) rotate(${pct * 270 - 135}deg) translateY(-${radius - 3}px)`,
            boxShadow: `0 0 5px ${accent}`,
          }}
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="num text-[10px] font-semibold text-ink-100">{display}</span>
        </span>
      </button>
      <span className="select-none text-[9px] uppercase tracking-[0.08em] text-ink-300">
        {label}
      </span>
    </div>
  );
}
