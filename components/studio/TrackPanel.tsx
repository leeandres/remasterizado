"use client";

import { Activity, FileAudio, Sparkles } from "lucide-react";
import { useStudio } from "@/lib/store";
import { getGenre } from "@/lib/presets";
import { cn, formatBytes, formatLufs, formatTime } from "@/lib/utils";
import { Waveform } from "./Waveform";
import { Transport } from "./Transport";

export function TrackPanel() {
  const track = useStudio((state) => state.track);
  const genre = useStudio((state) => state.genre);
  const platform = useStudio((state) => state.platform);
  const target = useStudio((state) => state.settings.targetLUFS);
  const bypass = useStudio((state) => state.bypass);
  const busy = useStudio((state) => state.busy);
  const runAnalysis = useStudio((state) => state.runAnalysis);

  if (!track) return null;
  const profile = getGenre(genre);

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.055] px-3 py-2.5 sm:px-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-lime-acid/20 bg-lime-acid/[0.07]">
          <FileAudio size={16} className="text-lime-acid/85" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h2 className="max-w-[42ch] truncate text-[12px] font-semibold text-white" title={track.name}>
              {track.name}
            </h2>
            <span className="rounded border border-white/[0.08] bg-white/[0.035] px-1 py-px text-[7px] font-semibold uppercase tracking-wider text-ink-300">
              {track.extension}
            </span>
            {track.bitDepth && (
              <span className="num rounded border border-white/[0.06] px-1 py-px text-[7px] text-ink-200">
                {track.bitDepth}-bit
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8.5px] text-ink-200">
            <span className="num">{formatTime(track.duration)}</span>
            <span className="text-ink-300">·</span>
            <span className="num">{(track.sampleRate / 1000).toFixed(1)} kHz</span>
            <span className="text-ink-300">·</span>
            <span className="num">{track.channels === 1 ? "mono" : "estéreo"}</span>
            <span className="text-ink-300">·</span>
            <span>{formatBytes(track.size)}</span>
            <span className="text-ink-300">·</span>
            <span className="num">Entrada {formatLufs(track.stats.lufsIntegrated)} LUFS</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.025] px-2 py-1 md:flex">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: profile.accent, boxShadow: `0 0 6px ${profile.accent}66` }}
            />
            <span className="text-[8.5px] font-medium text-ink-300">{profile.name}</span>
            <span className="num text-[8px] text-ink-200">{target.toFixed(1)} LUFS</span>
          </div>
          <button
            type="button"
            onClick={() => void runAnalysis()}
            disabled={!!busy}
            className="focus-ring inline-flex h-7 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 text-[9px] font-medium text-ink-300 transition hover:border-white/15 hover:text-white disabled:opacity-40"
            title="Render de prueba y comparativa"
          >
            <Activity size={11} />
            <span className="hidden sm:inline">Analizar cadena</span>
            <span className="sm:hidden">Analizar</span>
          </button>
        </div>
      </div>

      <div className="relative bg-[#0a0c10]/60 px-2 py-2">
        <Waveform />
      </div>

      <Transport />

      <div className="flex items-center justify-between border-t border-white/[0.045] px-3 py-1.5 text-[8px] text-ink-300">
        <span className="inline-flex items-center gap-1">
          <Sparkles size={8} className="text-lime-acid/50" />
          {platform === "spotify"
            ? "Optimizado para Spotify · normalización de sonoridad"
            : "Cadena preparada para el objetivo seleccionado"}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wider",
            bypass
              ? "border border-amber-glow/20 bg-amber-glow/[0.06] text-amber-glow/80"
              : "border border-lime-acid/20 bg-lime-acid/[0.06] text-lime-acid/80",
          )}
        >
          <span className={cn("h-1 w-1 rounded-full", bypass ? "bg-amber-glow" : "bg-lime-acid")} />
          {bypass ? "Escuchando original" : "Escuchando master"}
        </span>
      </div>
    </section>
  );
}
