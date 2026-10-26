"use client";

import { useEffect, useState } from "react";
import { Activity, Radio, Shield, Waves } from "lucide-react";
import { previewEngine, useStudio } from "@/lib/store";
import type { LiveMeters } from "@/lib/types";
import { cn, formatLufs } from "@/lib/utils";

const EMPTY: LiveMeters = {
  momentary: -70,
  shortTerm: -70,
  integrated: -70,
  truePeakDb: -96,
  correlation: 0,
  clipping: false,
};

function levelFromAnalyser(analyser: AnalyserNode | null): number {
  if (!analyser) return -96;
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  return peak > 1e-9 ? 20 * Math.log10(peak) : -96;
}

export function LiveMeters() {
  const track = useStudio((state) => state.track);
  const target = useStudio((state) => state.settings.targetLUFS);
  const isPlaying = useStudio((state) => state.isPlaying);
  const [meters, setMeters] = useState<LiveMeters>(EMPTY);
  const [left, setLeft] = useState(-96);
  const [right, setRight] = useState(-96);
  const [reduction, setReduction] = useState(0);

  useEffect(() => {
    if (!track) {
      setMeters(EMPTY);
      return;
    }
    const update = () => {
      setMeters(previewEngine.getLiveMeters());
      setLeft(levelFromAnalyser(previewEngine.getAnalyserL()));
      setRight(levelFromAnalyser(previewEngine.getAnalyserR()));
      setReduction(previewEngine.getGainReduction());
    };
    update();
    const interval = window.setInterval(update, 90);
    return () => window.clearInterval(interval);
  }, [track, isPlaying]);

  const shortPct = Math.max(0, Math.min(100, ((meters.shortTerm + 40) / 34) * 100));
  const peakPct = Math.max(0, Math.min(100, ((meters.truePeakDb + 14) / 14) * 100));
  const corrPct = Math.max(0, Math.min(100, ((meters.correlation + 1) / 2) * 100));
  const integratedPct = Math.max(0, Math.min(100, ((meters.integrated + 30) / 24) * 100));
  const targetPct = Math.max(0, Math.min(100, ((target + 30) / 24) * 100));
  const delta =
    meters.integrated > -69 ? meters.integrated - target : null;

  const peakHot = meters.truePeakDb > -1;

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <div className="panel-soft relative overflow-hidden px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="label">Integrated</span>
            <Activity size={12} className="text-lime-acid/60" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="num text-[26px] font-semibold leading-none text-white">
              {track ? formatLufs(meters.integrated) : "—"}
            </span>
            <span className="text-[9px] uppercase text-ink-200">LUFS</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-glow/70 to-lime-acid transition-[width] duration-150"
              style={{ width: `${integratedPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[9px]">
            <span className="text-ink-200">Objetivo {target.toFixed(1)}</span>
            <span
              className={cn(
                "num",
                delta === null
                  ? "text-ink-300"
                  : Math.abs(delta) <= 0.5
                    ? "text-lime-acid"
                    : "text-amber-glow",
              )}
            >
              {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
            </span>
          </div>
          <div
            className="absolute inset-y-0 w-px bg-white/20"
            style={{ left: `${targetPct}%` }}
          />
        </div>

        <div className="panel-soft px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="label">Short-term</span>
            <Waves size={12} className="text-cyan-glow/60" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="num text-[26px] font-semibold leading-none text-white">
              {track ? formatLufs(meters.shortTerm) : "—"}
            </span>
            <span className="text-[9px] uppercase text-ink-200">LUFS</span>
          </div>
          <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-glow via-lime-acid to-amber-glow transition-[width] duration-150"
              style={{ width: `${shortPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[9px] text-ink-200">
            <span>−40</span>
            <span>−6</span>
          </div>
        </div>

        <div className="panel-soft px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="label">True peak</span>
            <Shield
              size={12}
              className={peakHot ? "text-danger" : "text-amber-glow/60"}
            />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span
              className={cn(
                "num text-[26px] font-semibold leading-none",
                peakHot ? "text-danger" : "text-white",
              )}
            >
              {track && meters.truePeakDb > -95 ? meters.truePeakDb.toFixed(1) : "—"}
            </span>
            <span className="text-[9px] uppercase text-ink-200">dBTP</span>
          </div>
          <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-150",
                peakHot ? "bg-danger" : "bg-gradient-to-r from-amber-glow/60 to-amber-glow",
              )}
              style={{ width: `${peakPct}%` }}
            />
            <div className="absolute inset-y-0 left-[92.8%] w-px bg-white/25" title="-1 dBTP" />
          </div>
          <div className="mt-1.5 flex justify-between text-[9px]">
            <span className="text-ink-200">−14</span>
            <span className={peakHot ? "font-semibold text-danger" : "text-lime-acid/80"}>
              {peakHot ? "SOBRE −1.0" : "PROTEGIDO"}
            </span>
          </div>
        </div>

        <div className="panel-soft px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="label">Correlación</span>
            <Radio
              size={12}
              className={meters.correlation < 0.1 ? "text-amber-glow/60" : "text-violet-glow/60"}
            />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="num text-[26px] font-semibold leading-none text-white">
              {track ? `${meters.correlation >= 0 ? "+" : ""}${meters.correlation.toFixed(2)}` : "—"}
            </span>
          </div>
          <div className="relative mt-2 h-1 rounded-full bg-white/[0.07]">
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-150",
                meters.correlation < 0
                  ? "bg-danger"
                  : meters.correlation < 0.2
                    ? "bg-amber-glow"
                    : "bg-gradient-to-r from-cyan-glow to-lime-acid",
              )}
              style={{ width: `${corrPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[9px] text-ink-200">
            <span>−1</span>
            <span>{meters.correlation < 0.1 ? "RIESGO MONO" : "COMPATIBLE MONO"}</span>
            <span>+1</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-white/[0.045] bg-black/20 px-3 py-2">
        <div className="flex flex-1 items-center gap-3">
          <span className="num text-[9px] font-semibold text-ink-300">L</span>
          <div className="h-1.5 min-w-[50px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-lime-acid/50 to-lime-acid transition-[width] duration-100"
              style={{ width: `${Math.max(0, Math.min(100, ((left + 54) / 54) * 100))}%` }}
            />
          </div>
          <span className="num text-[9px] font-semibold text-ink-300">R</span>
          <div className="h-1.5 min-w-[50px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-glow/50 to-cyan-glow transition-[width] duration-100"
              style={{ width: `${Math.max(0, Math.min(100, ((right + 54) / 54) * 100))}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-wide text-ink-200">GR</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-glow to-danger transition-[width] duration-100"
              style={{ width: `${Math.min(100, (reduction / 12) * 100)}%` }}
            />
          </div>
          <span className="num w-9 text-right text-[9px] text-ink-300">
            {reduction > 0.1 ? `−${reduction.toFixed(1)}` : "0.0"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isPlaying ? "bg-lime-acid animate-pulse-soft" : "bg-ink-600",
            )}
          />
          <span className="text-[9px] uppercase tracking-wide text-ink-200">
            {isPlaying ? "En vivo" : "En pausa"}
          </span>
        </div>
      </div>
    </div>
  );
}
