"use client";

import { useEffect } from "react";
import { Cpu, Loader2, ShieldCheck } from "lucide-react";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";

const PHASE_LABELS: Record<string, string> = {
  decoding: "Decodificando audio",
  analyzing: "Analizando la mezcla",
  peaks: "Generando forma de onda",
  preparing: "Preparando render",
  rendering: "Render offline",
  measuring: "Midiendo loudness",
  normalizing: "Normalizando",
  limiting: "Limitando picos",
  encoding: "Codificando",
  saving: "Guardando",
  done: "Listo",
};

export function BusyOverlay() {
  const busy = useStudio((state) => state.busy);
  const open = Boolean(busy);
  const percent = Math.round((busy?.progress ?? 0) * 100);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!busy) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#06070a]/80 px-4 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label={`${busy.label}. ${busy.detail}`}
    >
      <div className="animate-fade-up relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0b0d12] p-5 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.95)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-acid/60 to-transparent" />
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-lime-acid/[0.07] blur-3xl" />

        <div className="relative flex items-center gap-4">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full border border-white/[0.07]">
            <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="3"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#d8ff57"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(percent / 100) * 175.9} 175.9`}
                className="transition-all duration-300"
              />
            </svg>
            <span className="num absolute text-[15px] font-semibold text-white">{percent}%</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin text-lime-acid" />
              <h2 className="truncate text-[12px] font-semibold text-white">{busy.label}</h2>
            </div>
            <p className="mt-1 text-[9px] leading-relaxed text-ink-300">{busy.detail}</p>
            <div className="mt-2 flex items-center gap-1.5 text-[8px] text-ink-300">
              <span className="rounded border border-white/[0.07] px-1 py-px uppercase tracking-wider">
                {PHASE_LABELS[busy.phase] ?? busy.phase}
              </span>
            </div>
          </div>
        </div>

        <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-glow via-lime-acid to-lime-acid transition-[width] duration-300"
            style={{ width: `${Math.max(3, percent)}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3 text-[8px] text-ink-300">
          <span className="inline-flex items-center gap-1.5">
            <Cpu size={10} className="text-ink-200" />
            Procesado local · sin subir archivos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={10} className={cn("text-lime-acid/60")} />
            EBU R128
          </span>
        </div>

        <div className="mt-3 flex h-5 items-end justify-center gap-1 opacity-60" aria-hidden>
          {[4, 9, 14, 7, 18, 11, 16, 6, 12, 19, 8, 13, 5, 10, 15].map((height, index) => (
            <span
              key={index}
              className="w-1 rounded-full bg-lime-acid/60"
              style={{
                height,
                animation: `eq-bounce 900ms ${index * 55}ms ease-in-out infinite`,
                transformOrigin: "bottom",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
