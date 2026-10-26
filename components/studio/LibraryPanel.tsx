"use client";

import {
  Check,
  Disc3,
  Feather,
  Flame,
  Guitar,
  History,
  RefreshCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { GENRES, PLATFORMS, PLATFORM_LIST, getGenre } from "@/lib/presets";
import { useStudio } from "@/lib/store";
import type { GenreId, SpectralBands } from "@/lib/types";
import {
  cn,
  formatLufs,
  formatTime,
} from "@/lib/utils";
import { UploadZone } from "./UploadZone";

const GENRE_ICONS = {
  sparkles: Sparkles,
  flame: Flame,
  guitar: Guitar,
  disc: Disc3,
  feather: Feather,
};

function GenreIcon({ genre, active }: { genre: GenreId; active: boolean }) {
  const profile = getGenre(genre);
  const Icon = GENRE_ICONS[profile.icon as keyof typeof GENRE_ICONS] ?? Sparkles;
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition",
        active ? "border-transparent" : "border-white/[0.055] bg-white/[0.025]",
      )}
      style={
        active
          ? { background: `${profile.accent}1f`, color: profile.accent, borderColor: `${profile.accent}45` }
          : { color: "#858fa3" }
      }
    >
      <Icon size={15} strokeWidth={1.8} />
    </span>
  );
}

function PresetSection() {
  const genre = useStudio((state) => state.genre);
  const platform = useStudio((state) => state.platform);
  const settings = useStudio((state) => state.settings);
  const track = useStudio((state) => state.track);
  const setGenre = useStudio((state) => state.setGenre);
  const setPlatform = useStudio((state) => state.setPlatform);
  const runAutoMaster = useStudio((state) => state.runAutoMaster);
  const resetSettings = useStudio((state) => state.resetSettings);
  const busy = useStudio((state) => state.busy);
  const profile = getGenre(genre);

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.055] px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles size={11} className="text-lime-acid/70" />
          <span className="label">Perfil de masterización</span>
        </div>
        <button
          type="button"
          onClick={resetSettings}
          className="focus-ring inline-flex items-center gap-1 rounded px-1 py-0.5 text-[8px] text-ink-300 transition hover:text-ink-300"
          title="Restablecer ajustes del preset"
        >
          <RefreshCcw size={9} />
          Reset
        </button>
      </div>

      <div className="space-y-1 px-2 py-2">
        {GENRES.map((item) => {
          const active = item.id === genre;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setGenre(item.id)}
              className={cn(
                "focus-ring group flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition",
                active
                  ? "border-white/[0.1] bg-white/[0.04]"
                  : "border-transparent hover:bg-white/[0.025]",
              )}
            >
              <GenreIcon genre={item.id} active={active} />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-[11px] font-medium",
                    active ? "text-white" : "text-ink-300 group-hover:text-ink-100",
                  )}
                >
                  {item.name}
                </span>
                <span className="block truncate text-[8px] text-ink-300">{item.subtitle}</span>
              </span>
              {active && (
                <span
                  className="grid h-4 w-4 place-items-center rounded-full"
                  style={{ background: `${item.accent}20`, color: item.accent }}
                >
                  <Check size={9} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-white/[0.05] px-3 py-2.5">
        <p className="text-[9px] leading-relaxed text-ink-200">{profile.tagline}</p>
      </div>

      <div className="border-t border-white/[0.05] px-3 py-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Target size={10} className="text-ink-200" />
          <span className="label">Plataforma destino</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {PLATFORM_LIST.map((item) => {
            const active = item.id === platform;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPlatform(item.id)}
                className={cn(
                  "focus-ring flex flex-col rounded-lg border px-2 py-1.5 text-left transition",
                  active
                    ? "border-white/15 bg-white/[0.045]"
                    : "border-white/[0.055] bg-transparent hover:border-white/10 hover:bg-white/[0.02]",
                )}
                style={
                  active
                    ? { borderColor: `${item.color}55`, background: `${item.color}0e` }
                    : undefined
                }
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: item.color,
                      boxShadow: active ? `0 0 6px ${item.color}` : undefined,
                    }}
                  />
                  <span
                    className={cn(
                      "truncate text-[9px] font-medium",
                      active ? "text-white" : "text-ink-300",
                    )}
                  >
                    {item.shortName}
                  </span>
                </span>
                <span className="num mt-0.5 text-[8px] text-ink-300">
                  {item.targetLUFS} LUFS
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between rounded-md border border-white/[0.05] bg-black/20 px-2 py-1.5">
          <span className="text-[8px] uppercase tracking-wide text-ink-300">Objetivo</span>
          <span className="num text-[9px] font-medium text-ink-200">
            {formatLufs(settings.targetLUFS)} LUFS · {settings.limiter.ceiling.toFixed(1)} dBTP
          </span>
        </div>
      </div>

      <div className="border-t border-white/[0.05] p-2.5">
        <button
          type="button"
          onClick={runAutoMaster}
          disabled={!track || !!busy}
          className={cn(
            "focus-ring group relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] disabled:opacity-40",
            "border-lime-acid/25 bg-gradient-to-r from-lime-acid/[0.14] via-lime-acid/[0.07] to-transparent hover:border-lime-acid/40",
          )}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-lime-acid text-[#0a0c04] shadow-[0_0_20px_-4px_rgba(216,255,87,0.6)]">
            <Sparkles size={15} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-white">Auto-Master IA</span>
              <span className="rounded border border-lime-acid/30 bg-lime-acid/10 px-1 py-px text-[6px] font-bold uppercase tracking-wider text-lime-acid">
                Auto
              </span>
            </span>
            <span className="mt-0.5 block text-[8px] leading-tight text-ink-300">
              Analiza tu mezcla y ajusta la cadena completa
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}

function SpectralBars({ spectral }: { spectral: SpectralBands }) {
  const items = [
    { label: "SUB", value: spectral.sub, color: "#a78bfa" },
    { label: "LOW", value: spectral.low, color: "#5eead4" },
    { label: "L-MID", value: spectral.lowMid, color: "#5eead4" },
    { label: "MID", value: spectral.mid, color: "#d8ff57" },
    { label: "H-MID", value: spectral.highMid, color: "#ffb45e" },
    { label: "AIR", value: spectral.air, color: "#fb7185" },
  ];
  const max = Math.max(...items.map((item) => item.value));
  return (
    <div className="flex h-12 items-end gap-1">
      {items.map((item) => {
        const relative = Math.max(0, Math.min(1, (item.value - (max - 36)) / 36));
        return (
          <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-[2px] transition-all duration-300"
                style={{
                  height: `${Math.max(6, relative * 100)}%`,
                  background: item.color,
                  opacity: 0.35 + relative * 0.55,
                }}
              />
            </div>
            <span className="text-[6px] tracking-wide text-ink-300">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function SourceAnalysis() {
  const track = useStudio((state) => state.track);

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.055] px-3 py-2.5">
        <span className="label">Análisis de entrada</span>
        {track && (
          <span className="rounded border border-cyan-glow/20 bg-cyan-glow/[0.06] px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wider text-cyan-glow/80">
            EBU R128
          </span>
        )}
      </div>
      {track ? (
        <div className="px-3 py-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <div>
              <div className="text-[8px] uppercase tracking-wide text-ink-300">Integrated</div>
              <div className="num mt-0.5 text-[15px] font-semibold text-white">
                {formatLufs(track.stats.lufsIntegrated)}
                <span className="ml-1 text-[8px] font-normal text-ink-300">LUFS</span>
              </div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-wide text-ink-300">True peak</div>
              <div className="num mt-0.5 text-[15px] font-semibold text-white">
                {track.stats.truePeakDb.toFixed(1)}
                <span className="ml-1 text-[8px] font-normal text-ink-300">dBTP</span>
              </div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-wide text-ink-300">LRA</div>
              <div className="num mt-0.5 text-[12px] font-medium text-ink-200">
                {track.stats.lra.toFixed(1)}
                <span className="ml-1 text-[8px] font-normal text-ink-300">LU</span>
              </div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-wide text-ink-300">Correlación</div>
              <div
                className={cn(
                  "num mt-0.5 text-[12px] font-medium",
                  track.stats.correlation < 0.1 ? "text-amber-glow" : "text-ink-200",
                )}
              >
                {track.stats.correlation >= 0 ? "+" : ""}
                {track.stats.correlation.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="mt-3 border-t border-white/[0.05] pt-2.5">
            <SpectralBars spectral={track.stats.spectral} />
          </div>

          <div className="mt-2 flex items-center justify-between text-[8px] text-ink-300">
            <span className="num">
              {formatTime(track.duration)} · {(track.sampleRate / 1000).toFixed(1)} kHz
            </span>
            <span>{track.bitDepth ? `${track.bitDepth}-bit` : track.extension.toUpperCase()}</span>
          </div>
        </div>
      ) : (
        <div className="px-3 py-6 text-center">
          <p className="text-[10px] text-ink-200">Carga una pista para ver el análisis</p>
        </div>
      )}
    </section>
  );
}

export function LibraryPanel() {
  const openHistory = useStudio((state) => state.openHistory);
  const genre = useStudio((state) => state.genre);
  const platform = useStudio((state) => state.platform);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1 lg:hidden">
        <h2 className="text-[13px] font-semibold text-white">Biblioteca & perfil</h2>
        <span className="text-[9px] text-ink-200">
          {getGenre(genre).name} · {PLATFORMS[platform].shortName}
        </span>
      </div>

      <UploadZone />
      <PresetSection />
      <SourceAnalysis />

      <button
        type="button"
        onClick={() => openHistory(true)}
        className="focus-ring group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left transition hover:border-white/12 hover:bg-white/[0.035]"
      >
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
          <History size={14} className="text-ink-300" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-medium text-ink-200">Historial local</span>
          <span className="block text-[8px] text-ink-300">Masterizaciones guardadas en este dispositivo</span>
        </span>
        <span className="text-[9px] text-ink-300 transition group-hover:text-ink-300">Abrir →</span>
      </button>
    </div>
  );
}
