"use client";

import { Activity, Radio, SlidersHorizontal } from "lucide-react";
import { useStudio } from "@/lib/store";
import type { AnalyzerTab } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Spectrum } from "./Spectrum";
import { EQEditor } from "./EQEditor";
import { Goniometer } from "./Goniometer";

const TABS: Array<{ id: AnalyzerTab; label: string; icon: typeof Activity }> = [
  { id: "spectrum", label: "Espectro", icon: Activity },
  { id: "eq", label: "EQ", icon: SlidersHorizontal },
  { id: "phase", label: "Fase", icon: Radio },
];

const HINTS: Record<AnalyzerTab, string> = {
  spectrum: "FFT 4096 · frecuencia logarítmica · peak hold",
  eq: "Arrastra los nodos · doble clic para resetear la ganancia",
  phase: "Lissajous estéreo · correlación en tiempo real",
};

export function AnalyzerCard() {
  const tab = useStudio((state) => state.analyzerTab);
  const setTab = useStudio((state) => state.setAnalyzerTab);
  const isPlaying = useStudio((state) => state.isPlaying);
  const eq = useStudio((state) => state.settings.eq);
  const patchSettings = useStudio((state) => state.patchSettings);

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.055] px-2.5 py-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-black/25 p-0.5">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "focus-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[9.5px] font-medium transition",
                  active
                    ? "bg-white/[0.08] text-white shadow-sm"
                    : "text-ink-200 hover:text-ink-200",
                )}
              >
                <Icon size={11} className={active ? "text-lime-acid" : ""} />
                {item.label}
              </button>
            );
          })}
        </div>

        <span className="hidden flex-1 truncate text-right text-[8px] text-ink-300 lg:block">
          {HINTS[tab]}
        </span>

        <span className="ml-auto flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-black/30 px-2 py-0.5 lg:ml-0">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isPlaying ? "bg-lime-acid animate-pulse-soft" : "bg-ink-600",
            )}
          />
          <span className="num text-[7.5px] uppercase tracking-[0.12em] text-ink-200">
            {isPlaying ? "live" : "hold"}
          </span>
        </span>
      </div>

      {tab === "spectrum" && <Spectrum active={isPlaying} />}
      {tab === "eq" && (
        <EQEditor
          bands={eq.bands}
          enabled={eq.enabled}
          active={isPlaying}
          onChange={(index, patch) =>
            patchSettings((next) => {
              const band = next.eq.bands[index];
              if (!band) return;
              if (patch.freq !== undefined) band.freq = patch.freq;
              if (patch.gain !== undefined) band.gain = patch.gain;
              if (patch.q !== undefined) band.q = patch.q;
              if (patch.type !== undefined) band.type = patch.type;
            })
          }
        />
      )}
      {tab === "phase" && <Goniometer active={isPlaying} />}
    </section>
  );
}
