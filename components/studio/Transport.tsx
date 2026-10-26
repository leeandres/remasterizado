"use client";

import { useEffect, useRef } from "react";
import {
  Pause,
  Play,
  Repeat2,
  Square,
  Volume1,
  Volume2,
  VolumeX,
  Scissors,
} from "lucide-react";
import { previewEngine, useStudio } from "@/lib/store";
import { cn, formatTime } from "@/lib/utils";

export function Transport() {
  const track = useStudio((state) => state.track);
  const isPlaying = useStudio((state) => state.isPlaying);
  const loop = useStudio((state) => state.loop);
  const region = useStudio((state) => state.region);
  const bypass = useStudio((state) => state.bypass);
  const volume = useStudio((state) => state.volume);
  const togglePlay = useStudio((state) => state.togglePlay);
  const stop = useStudio((state) => state.stop);
  const toggleLoop = useStudio((state) => state.toggleLoop);
  const setBypass = useStudio((state) => state.setBypass);
  const setVolume = useStudio((state) => state.setVolume);
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (timeRef.current) {
        timeRef.current.textContent = formatTime(previewEngine.getCurrentTime(), true);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const selectionDuration = region ? region.end - region.start : null;

  return (
    <div className="flex flex-col gap-2 border-t border-white/[0.055] px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!track}
          className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime-acid text-[#0a0c04] shadow-[0_0_24px_-6px_rgba(216,255,87,0.6)] transition hover:bg-[#e5ff86] active:scale-95 disabled:opacity-30"
          aria-label={isPlaying ? "Pausa" : "Reproducir"}
        >
          {isPlaying ? (
            <Pause size={17} fill="currentColor" />
          ) : (
            <Play size={17} fill="currentColor" className="ml-0.5" />
          )}
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={!track}
          className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-ink-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
          aria-label="Detener"
        >
          <Square size={13} fill="currentColor" />
        </button>
        <button
          type="button"
          onClick={toggleLoop}
          disabled={!track}
          className={cn(
            "focus-ring grid h-8 w-8 place-items-center rounded-lg border transition disabled:opacity-30",
            loop
              ? "border-lime-acid/30 bg-lime-acid/10 text-lime-acid"
              : "border-transparent text-ink-400 hover:bg-white/[0.06] hover:text-white",
          )}
          aria-label="Repetir"
          title={region ? "Repetir selección" : "Repetir pista completa"}
        >
          <Repeat2 size={14} />
        </button>

        <div className="ml-1 min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span ref={timeRef} className="num text-[13px] font-semibold text-white">
              0:00.000
            </span>
            <span className="text-[10px] text-ink-600">/</span>
            <span className="num text-[10px] text-ink-400">
              {formatTime(track?.duration ?? 0, true)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-ink-500">
            {region ? (
              <>
                <Scissors size={9} className="text-lime-acid/70" />
                <span className="num text-lime-acid/75">
                  {formatTime(region.start)} – {formatTime(region.end)}
                </span>
                <span>· {formatTime(selectionDuration ?? 0)} seleccionados</span>
              </>
            ) : (
              <span>Pista completa · {track?.sampleRate ? `${(track.sampleRate / 1000).toFixed(1)} kHz` : "—"}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-black/20 p-0.5">
          <button
            type="button"
            onClick={() => setBypass(true)}
            disabled={!track}
            className={cn(
              "focus-ring rounded-md px-2.5 py-1 text-[10px] font-semibold transition disabled:opacity-30",
              bypass ? "bg-amber-glow/90 text-[#1a1205]" : "text-ink-400 hover:text-white",
            )}
            title="Escuchar original (A)"
          >
            A
          </button>
          <button
            type="button"
            onClick={() => setBypass(false)}
            disabled={!track}
            className={cn(
              "focus-ring rounded-md px-2.5 py-1 text-[10px] font-semibold transition disabled:opacity-30",
              !bypass ? "bg-lime-acid text-[#0a0c04]" : "text-ink-400 hover:text-white",
            )}
            title="Escuchar masterizado (B)"
          >
            B
          </button>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={() => setVolume(volume > 0 ? 0 : 0.9)}
            className="focus-ring grid h-7 w-7 place-items-center rounded-md text-ink-400 transition hover:text-white"
            aria-label={volume > 0 ? "Silenciar" : "Activar sonido"}
          >
            {volume <= 0 ? (
              <VolumeX size={14} />
            ) : volume < 0.45 ? (
              <Volume1 size={14} />
            ) : (
              <Volume2 size={14} />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1.2}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="range w-20"
            aria-label="Volumen del monitor"
            style={{
              ["--range-pct" as string]: `${(volume / 1.2) * 100}%`,
              ["--range-accent" as string]: "#5eead4",
            } as React.CSSProperties}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pl-[52px] text-[9px] text-ink-600">
        <span className="inline-flex items-center gap-1">
          <span className={cn("h-1 w-1 rounded-full", bypass ? "bg-amber-glow" : "bg-lime-acid")} />
          {bypass ? "Original sin procesar" : "Cadena MasterAI activa"}
        </span>
        <span className="text-ink-700">·</span>
        <span>Vista previa con limitador aproximado; la exportación usa brickwall true-peak.</span>
      </div>
    </div>
  );
}
