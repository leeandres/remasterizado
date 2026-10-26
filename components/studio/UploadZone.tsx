"use client";

import { useRef, useState } from "react";
import {
  AudioLines,
  FileAudio,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { useStudio } from "@/lib/store";
import { cn, formatBytes, formatLufs, formatTime } from "@/lib/utils";
import { useAudioLoader } from "./useAudioLoader";

export function UploadZone({ variant = "compact" }: { variant?: "compact" | "hero" }) {
  const track = useStudio((state) => state.track);
  const clearTrack = useStudio((state) => state.clearTrack);
  const notify = useStudio((state) => state.notify);
  const { processing, handleFiles } = useAudioLoader();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void handleFiles(event.dataTransfer.files);
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".mp3,.wav,.wave,.flac,audio/mpeg,audio/wav,audio/flac,audio/x-flac"
      className="hidden"
      onChange={(event) => {
        void handleFiles(event.target.files);
        event.target.value = "";
      }}
    />
  );

  if (variant === "hero") {
    return (
      <section className="panel relative overflow-hidden">
        {input}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-acid/50 to-transparent" />
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-lime-acid/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-24 h-64 w-64 rounded-full bg-cyan-glow/[0.05] blur-3xl" />
        <div className="relative grid gap-7 p-5 sm:p-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-9 lg:p-9">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-acid shadow-[0_0_7px_rgba(216,255,87,0.8)]" />
              <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-ink-300">
                Motor DSP en tu navegador
              </span>
            </div>
            <h1 className="text-balance text-[30px] font-semibold leading-[1.06] tracking-[-0.035em] text-white sm:text-[40px] lg:text-[44px]">
              Masteriza como un estudio.
              <span className="block text-lime-acid">En minutos.</span>
            </h1>
            <p className="mt-4 max-w-md text-[12px] leading-relaxed text-ink-300 sm:text-[13px]">
              Sube tu mezcla, analiza cada frecuencia y aplica una cadena profesional de EQ,
              compresión, saturación y limitación true-peak. Exporta al estándar exacto de cada
              plataforma.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={openPicker}
                disabled={processing}
                className="focus-ring inline-flex h-11 items-center gap-2 rounded-xl bg-lime-acid px-5 text-[12px] font-semibold text-[#0a0c04] shadow-[0_0_34px_-8px_rgba(216,255,87,0.65)] transition hover:bg-[#e4ff82] active:scale-[0.98] disabled:opacity-50"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                {processing ? "Analizando audio…" : "Seleccionar audio"}
              </button>
              <div className="flex items-center gap-1.5 text-[10px] text-ink-200">
                <ShieldCheck size={12} className="text-lime-acid/60" />
                Procesado 100% local
              </div>
            </div>

            <div className="mt-6 grid max-w-md grid-cols-3 gap-2">
              {[
                { label: "Loudness", value: "EBU R128" },
                { label: "Techo", value: "−1.0 dBTP" },
                { label: "Salida", value: "24-bit / 48k" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-white/[0.055] bg-white/[0.02] px-2.5 py-2"
                >
                  <div className="text-[8px] uppercase tracking-[0.12em] text-ink-300">{item.label}</div>
                  <div className="num mt-0.5 text-[10px] font-medium text-ink-200">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={openPicker}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") openPicker();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "focus-ring group relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed p-6 text-center transition-all duration-200",
              dragging
                ? "border-lime-acid/70 bg-lime-acid/[0.06]"
                : "border-white/[0.13] bg-black/20 hover:border-lime-acid/35 hover:bg-white/[0.02]",
            )}
          >
            <div className="pointer-events-none absolute inset-0 opacity-[0.55]">
              <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-white/[0.07] to-transparent" />
            </div>

            <div
              className={cn(
                "relative grid h-16 w-16 place-items-center rounded-2xl border transition-all duration-300",
                dragging
                  ? "scale-105 border-lime-acid/60 bg-lime-acid/15"
                  : "border-white/10 bg-white/[0.04] group-hover:border-lime-acid/30 group-hover:bg-lime-acid/[0.06]",
              )}
            >
              {processing ? (
                <Loader2 size={26} className="animate-spin text-lime-acid" />
              ) : (
                <UploadCloud size={26} className="text-lime-acid/80" strokeWidth={1.5} />
              )}
              <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-lime-acid/30 bg-[#0b0d12]">
                <Plus size={10} className="text-lime-acid" />
              </span>
            </div>

            <div className="mt-4 text-[13px] font-medium text-ink-100">
              {dragging ? "Suelta el archivo" : "Arrastra tu tema aquí"}
            </div>
            <div className="mt-1 text-[10px] text-ink-200">
              o haz clic para explorar tus archivos
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              {["MP3", "WAV", "FLAC"].map((format) => (
                <span
                  key={format}
                  className="rounded-[5px] border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[8px] font-semibold tracking-wide text-ink-300"
                >
                  {format}
                </span>
              ))}
              <span className="text-[8px] text-ink-300">·</span>
              <span className="inline-flex items-center gap-1 text-[8px] text-ink-200">
                <HardDrive size={9} /> Hasta 500 MB
              </span>
            </div>

            <div className="mt-6 flex items-end gap-[3px] opacity-50 transition-opacity group-hover:opacity-90">
              {[5, 10, 7, 16, 11, 20, 8, 14, 6, 12, 18, 9, 15, 7, 11, 5].map((h, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-lime-acid/50"
                  style={{ height: h, animationDelay: `${i * 60}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!track) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") openPicker();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "focus-ring group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-7 text-center transition",
          dragging
            ? "border-lime-acid/60 bg-lime-acid/[0.06]"
            : "border-white/[0.12] bg-white/[0.015] hover:border-lime-acid/30 hover:bg-white/[0.025]",
        )}
      >
        {input}
        {processing ? (
          <Loader2 size={20} className="animate-spin text-lime-acid" />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
            <AudioLines size={18} className="text-lime-acid/80" />
          </div>
        )}
        <p className="mt-3 text-[11px] font-medium text-ink-200">
          {processing ? "Analizando audio…" : "Añade tu primera pista"}
        </p>
        <p className="mt-0.5 text-[9px] text-ink-200">MP3 · WAV · FLAC · máx. 500 MB</p>
        <span className="mt-3 text-[9px] font-medium text-lime-acid/80">
          Seleccionar archivo
        </span>
      </div>
    );
  }

  return (
    <div className="panel-soft overflow-hidden">
      {input}
      <div className="flex items-start gap-2.5 p-3">
        <div className="relative mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-lime-acid/20 bg-lime-acid/[0.07]">
          <FileAudio size={16} className="text-lime-acid/85" />
          {processing && (
            <span className="absolute inset-0 grid place-items-center rounded-lg bg-[#0b0d12]/80">
              <Loader2 size={13} className="animate-spin text-lime-acid" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <p className="truncate text-[11px] font-medium text-ink-100" title={track.name}>
              {track.name}
            </p>
            <button
              type="button"
              onClick={() => {
                clearTrack();
                notify("info", "Pista quitada", "La sesión de masterizado se ha reiniciado.");
              }}
              className="focus-ring -mr-1 -mt-1 grid h-5 w-5 shrink-0 place-items-center rounded text-ink-300 transition hover:bg-white/[0.06] hover:text-danger"
              aria-label="Quitar pista"
            >
              <X size={11} />
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-ink-200">
            <span className="rounded border border-white/[0.07] bg-white/[0.03] px-1 py-px font-semibold uppercase text-ink-300">
              {track.extension}
            </span>
            <span className="num">{formatTime(track.duration)}</span>
            <span>{formatBytes(track.size)}</span>
            <span className="num">
              {(track.sampleRate / 1000).toFixed(1)} kHz
            </span>
            {track.bitDepth && <span className="num">{track.bitDepth}-bit</span>}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[9px]">
            <span className="text-ink-200">Entrada</span>
            <span className="num font-medium text-ink-200">
              {formatLufs(track.stats.lufsIntegrated)} LUFS
            </span>
            <span className="text-ink-300">·</span>
            <span className="num text-ink-300">{track.stats.truePeakDb.toFixed(1)} dBTP</span>
          </div>
        </div>
      </div>
      <div className="flex border-t border-white/[0.05]">
        <button
          type="button"
          onClick={openPicker}
          disabled={processing}
          className="focus-ring flex flex-1 items-center justify-center gap-1.5 py-2 text-[9px] font-medium text-ink-300 transition hover:bg-white/[0.03] hover:text-white disabled:opacity-40"
        >
          <RefreshCw size={10} />
          Reemplazar audio
        </button>
        <div className="w-px bg-white/[0.05]" />
        <div className="flex items-center gap-1 px-2 text-[8px] uppercase tracking-wider text-lime-acid/60">
          <Sparkles size={9} />
          Analizada
        </div>
      </div>
    </div>
  );
}
