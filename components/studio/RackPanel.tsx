"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Activity,
  ChevronDown,
  Download,
  Filter,
  Gauge,
  Lock,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Waves,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PLATFORMS, getGenre } from "@/lib/presets";
import { previewEngine, useStudio } from "@/lib/store";
import type { MasteringSettings } from "@/lib/types";
import { clamp, cn, formatLufs } from "@/lib/utils";
import { formatFreq } from "@/lib/canvas";
import { Knob } from "../ui/Knob";
import { Slider } from "../ui/Slider";
import { Toggle } from "../ui/Toggle";
import { Button } from "../ui/Button";

function formatHz(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} kHz`;
  }
  return `${Math.round(value)} Hz`;
}

function signed(value: number, digits = 1): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

interface ModuleProps {
  index: string;
  title: string;
  icon: LucideIcon;
  accent: string;
  summary: string;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  defaultOpen?: boolean;
  children: ReactNode;
}

function RackModule({
  index,
  title,
  icon: Icon,
  accent,
  summary,
  enabled,
  onToggle,
  defaultOpen = false,
  children,
}: ModuleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const disabled = enabled === false;

  return (
    <section
      className={cn(
        "group relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0d0f14]/85 transition-colors",
        open && "border-white/[0.09] bg-[#0e1117]",
      )}
    >
      <span
        className="pointer-events-none absolute inset-y-0 left-0 w-[2px] opacity-60"
        style={{ background: `linear-gradient(180deg, ${accent}aa, ${accent}12)` }}
      />
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-md text-left"
          aria-expanded={open}
          aria-label={`${open ? "Contraer" : "Expandir"} módulo ${title}`}
        >
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md border"
            style={{
              color: accent,
              borderColor: `${accent}2e`,
              background: `${accent}12`,
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <Icon size={13} strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="num text-[7px] font-medium tracking-wider text-ink-600">{index}</span>
              <span
                className={cn(
                  "truncate text-[10.5px] font-medium",
                  disabled ? "text-ink-500" : "text-ink-100",
                )}
              >
                {title}
              </span>
            </span>
            <span className="mt-0.5 block truncate text-[8px] text-ink-500">{summary}</span>
          </span>
          <ChevronDown
            size={12}
            className={cn(
              "shrink-0 text-ink-600 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
        {onToggle && (
          <Toggle
            checked={enabled ?? true}
            onChange={onToggle}
            size="sm"
            label={`Activar ${title}`}
          />
        )}
      </div>

      {open && (
        <div className="animate-fade-in border-t border-white/[0.045] px-3 pb-3 pt-2.5">
          <div className={cn(disabled && "pointer-events-none opacity-35")}>{children}</div>
        </div>
      )}
    </section>
  );
}

function GainReductionMeter() {
  const [reduction, setReduction] = useState(0);

  useEffect(() => {
    const update = () => setReduction(previewEngine.getGainReduction());
    update();
    const interval = window.setInterval(update, 110);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-[8px] uppercase tracking-wide text-ink-600">GR</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-glow to-danger transition-[width] duration-150"
          style={{ width: `${clamp((reduction / 12) * 100, 0, 100)}%` }}
        />
      </div>
      <span className="num w-12 text-right text-[8px] text-ink-300">
        {reduction > 0.05 ? `−${reduction.toFixed(1)} dB` : "0.0 dB"}
      </span>
    </div>
  );
}

function LimiterStatus() {
  const [peak, setPeak] = useState(-96);
  useEffect(() => {
    const update = () => setPeak(previewEngine.getPeakDb());
    update();
    const interval = window.setInterval(update, 140);
    return () => window.clearInterval(interval);
  }, []);
  const hot = peak > -1;
  const pct = clamp(((peak + 16) / 16) * 100, 0, 100);

  return (
    <div className="mt-3 rounded-lg border border-white/[0.05] bg-black/25 px-2.5 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[8px] uppercase tracking-wide text-ink-600">Pico de salida</span>
        <span className={cn("num text-[9px] font-medium", hot ? "text-danger" : "text-lime-acid")}>
          {peak > -95 ? `${peak.toFixed(1)} dBTP` : "—"}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-150",
            hot ? "bg-danger" : "bg-gradient-to-r from-lime-acid/60 to-lime-acid",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SaturationCurve({ drive }: { drive: number }) {
  const amount = 1 + drive / 12;
  const points: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = -1 + (i / 40) * 2;
    const y = Math.tanh(x * amount) / Math.tanh(amount);
    points.push(`${(i / 40) * 100},${50 - y * 36}`);
  }
  return (
    <svg viewBox="0 0 100 100" className="h-[70px] w-full" preserveAspectRatio="none" aria-hidden>
      <line x1="50" y1="4" x2="50" y2="96" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      <line x1="4" y1="50" x2="96" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      <polyline
        points="4,50 96,50"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
        fill="none"
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="rgba(167,139,250,0.8)"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function RackPanel() {
  const settings = useStudio((state) => state.settings);
  const genre = useStudio((state) => state.genre);
  const platform = useStudio((state) => state.platform);
  const track = useStudio((state) => state.track);
  const bypass = useStudio((state) => state.bypass);
  const busy = useStudio((state) => state.busy);
  const patchSettings = useStudio((state) => state.patchSettings);
  const resetSettings = useStudio((state) => state.resetSettings);
  const runAnalysis = useStudio((state) => state.runAnalysis);
  const openExport = useStudio((state) => state.openExport);
  const setAnalyzerTab = useStudio((state) => state.setAnalyzerTab);
  const setMobileView = useStudio((state) => state.setMobileView);

  const profile = getGenre(genre);
  const platformInfo = PLATFORMS[platform];

  const set = (updater: (next: MasteringSettings) => void) => patchSettings(updater);

  const openEq = () => {
    setAnalyzerTab("eq");
    setMobileView("studio");
  };

  return (
    <div className="space-y-2.5">
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.055] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md border border-lime-acid/20 bg-lime-acid/[0.08]">
              <SlidersHorizontal size={13} className="text-lime-acid/90" />
            </span>
            <div>
              <div className="text-[10.5px] font-semibold text-white">Cadena de masterización</div>
              <div className="mt-0.5 flex items-center gap-1 text-[8px] text-ink-500">
                <span>{profile.name}</span>
                <span className="text-ink-700">·</span>
                <span className="num">{formatLufs(settings.targetLUFS)} LUFS</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={resetSettings}
            className="focus-ring inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[8px] text-ink-500 transition hover:bg-white/[0.05] hover:text-ink-200"
            title="Restablecer la cadena al preset"
          >
            <RotateCcw size={10} />
            Reset
          </button>
        </div>
        <div className="flex items-center gap-1 overflow-hidden px-3 py-2 text-[7px] uppercase tracking-[0.1em] text-ink-600">
          {["IN", "FILTRO", "EQ", "COMP", "SAT", "LIM"].map((step, index) => (
            <span key={step} className="flex items-center gap-1">
              <span
                className={cn(
                  "whitespace-nowrap",
                  step === "IN" ? "text-ink-400" : "text-ink-500",
                )}
              >
                {step}
              </span>
              {index < 5 && <span className="text-ink-700">›</span>}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1 whitespace-nowrap">
            <span
              className={cn(
                "h-1 w-1 rounded-full",
                bypass ? "bg-amber-glow" : track ? "bg-lime-acid" : "bg-ink-600",
              )}
            />
            <span className="text-ink-500">{bypass ? "bypass" : track ? "activa" : "sin audio"}</span>
          </span>
        </div>
      </div>

      <RackModule
        index="01"
        title="Ganancia de entrada"
        icon={Waves}
        accent="#d8ff57"
        summary={`Entrada ${signed(settings.inputGain)} dB · Salida ${signed(settings.outputGain)} dB`}
      >
        <div className="grid grid-cols-2 gap-3">
          <Slider
            label="Input gain"
            value={settings.inputGain}
            min={-12}
            max={12}
            step={0.1}
            compact
            format={(value) => `${signed(value)} dB`}
            onChange={(value) => set((next) => (next.inputGain = value))}
          />
          <Slider
            label="Output trim"
            value={settings.outputGain}
            min={-12}
            max={12}
            step={0.1}
            compact
            accent="#5eead4"
            format={(value) => `${signed(value)} dB`}
            onChange={(value) => set((next) => (next.outputGain = value))}
          />
        </div>
        <p className="mt-2 text-[8px] leading-relaxed text-ink-600">
          El trim de salida se aplica antes del limitador de vista previa. El export normaliza al
          objetivo de la plataforma.
        </p>
      </RackModule>

      <RackModule
        index="02"
        title="Filtro"
        icon={Filter}
        accent="#5eead4"
        enabled={settings.filter.enabled}
        onToggle={(value) => set((next) => (next.filter.enabled = value))}
        summary={`HP ${Math.round(settings.filter.highpass)} Hz · LP ${formatHz(settings.filter.lowpass)}`}
      >
        <div className="space-y-2.5">
          <Slider
            label="High-pass"
            value={settings.filter.highpass}
            min={10}
            max={120}
            step={1}
            compact
            accent="#5eead4"
            format={(value) => `${Math.round(value)} Hz`}
            onChange={(value) => set((next) => (next.filter.highpass = value))}
          />
          <Slider
            label="Low-pass"
            value={settings.filter.lowpass}
            min={6000}
            max={20000}
            step={100}
            compact
            accent="#5eead4"
            format={(value) => formatHz(value)}
            onChange={(value) => set((next) => (next.filter.lowpass = value))}
          />
        </div>
        <p className="mt-2 text-[8px] text-ink-600">Biquad 12 dB/oct · limpieza de sub y aire.</p>
      </RackModule>

      <RackModule
        index="03"
        title="Ecualizador"
        icon={Activity}
        accent={profile.accent}
        enabled={settings.eq.enabled}
        onToggle={(value) => set((next) => (next.eq.enabled = value))}
        summary={`5 bandas · ${settings.eq.bands.filter((band) => Math.abs(band.gain) > 0.05).length} activas`}
      >
        <div className="space-y-1.5">
          {settings.eq.bands.map((band, index) => (
            <div key={band.id} className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: ["#d8ff57", "#ffb45e", "#5eead4", "#a78bfa", "#fb7185"][index] }}
              />
              <button
                type="button"
                onClick={openEq}
                className="focus-ring w-[58px] shrink-0 truncate text-left text-[8.5px] text-ink-300 transition hover:text-white"
                title="Abrir editor gráfico"
              >
                {band.label}
              </button>
              <span className="num w-11 shrink-0 text-[8px] text-ink-600">
                {formatFreq(band.freq)}Hz
              </span>
              <input
                type="range"
                min={-18}
                max={18}
                step={0.1}
                value={band.gain}
                aria-label={`Ganancia ${band.label}`}
                onChange={(event) =>
                  set((next) => {
                    next.eq.bands[index].gain = Number(event.target.value);
                  })
                }
                className="range min-w-0 flex-1"
                style={
                  {
                    "--range-pct": `${((band.gain + 18) / 36) * 100}%`,
                    "--range-accent": ["#d8ff57", "#ffb45e", "#5eead4", "#a78bfa", "#fb7185"][index],
                  } as CSSProperties
                }
              />
              <span className="num w-9 shrink-0 text-right text-[8px] text-ink-200">
                {signed(band.gain)}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={openEq}
          className="focus-ring mt-2.5 flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[8.5px] text-ink-400 transition hover:border-white/12 hover:text-white"
        >
          <span>Editor gráfico · frecuencia y Q</span>
          <span className="text-[9px] text-lime-acid/80">Abrir →</span>
        </button>
      </RackModule>

      <RackModule
        index="04"
        title="Compresor"
        icon={Gauge}
        accent="#ffb45e"
        enabled={settings.compressor.enabled}
        onToggle={(value) => set((next) => (next.compressor.enabled = value))}
        summary={`${settings.compressor.ratio.toFixed(1)}:1 · ${Math.round(settings.compressor.threshold)} dB · ${settings.compressor.multiband ? "multibanda" : "broadband"}`}
        defaultOpen
      >
        <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-1.5">
          <div>
            <div className="text-[8.5px] text-ink-300">Compresión multibanda</div>
            <div className="text-[7.5px] text-ink-600">220 Hz / 3.5 kHz · 3 bandas</div>
          </div>
          <Toggle
            checked={settings.compressor.multiband}
            onChange={(value) => set((next) => (next.compressor.multiband = value))}
            size="sm"
            label="Compresión multibanda"
          />
        </div>

        <div className="mt-3 grid grid-cols-5 justify-items-center gap-1">
          <Knob
            label="Umbral"
            value={settings.compressor.threshold}
            min={-45}
            max={-6}
            step={0.5}
            defaultValue={-22}
            size={46}
            accent="#ffb45e"
            format={(value) => `${Math.round(value)}`}
            onChange={(value) => set((next) => (next.compressor.threshold = value))}
          />
          <Knob
            label="Ratio"
            value={settings.compressor.ratio}
            min={1.2}
            max={6}
            step={0.1}
            defaultValue={2.5}
            size={46}
            accent="#ffb45e"
            format={(value) => `${value.toFixed(1)}`}
            onChange={(value) => set((next) => (next.compressor.ratio = value))}
          />
          <Knob
            label="Attack"
            value={settings.compressor.attackMs}
            min={1}
            max={200}
            step={1}
            defaultValue={20}
            size={46}
            accent="#ffb45e"
            format={(value) => `${Math.round(value)}`}
            onChange={(value) => set((next) => (next.compressor.attackMs = value))}
          />
          <Knob
            label="Release"
            value={settings.compressor.releaseMs}
            min={20}
            max={600}
            step={5}
            defaultValue={180}
            size={46}
            accent="#ffb45e"
            format={(value) => `${Math.round(value)}`}
            onChange={(value) => set((next) => (next.compressor.releaseMs = value))}
          />
          <Knob
            label="Makeup"
            value={settings.compressor.makeup}
            min={0}
            max={9}
            step={0.1}
            defaultValue={2}
            size={46}
            accent="#ffb45e"
            format={(value) => `${value.toFixed(1)}`}
            onChange={(value) => set((next) => (next.compressor.makeup = value))}
          />
        </div>

        <div className="mt-2.5">
          <Slider
            label="Knee"
            value={settings.compressor.knee}
            min={0}
            max={18}
            step={0.5}
            compact
            accent="#ffb45e"
            format={(value) => `${value.toFixed(1)} dB`}
            onChange={(value) => set((next) => (next.compressor.knee = value))}
          />
        </div>
        <GainReductionMeter />
      </RackModule>

      <RackModule
        index="05"
        title="Saturación"
        icon={Zap}
        accent="#a78bfa"
        enabled={settings.saturation.enabled}
        onToggle={(value) => set((next) => (next.saturation.enabled = value))}
        summary={`Drive ${Math.round(settings.saturation.drive)} · Mix ${Math.round(settings.saturation.mix)}%`}
      >
        <div className="grid grid-cols-[1fr_1fr_1fr_70px] items-center gap-2">
          <Knob
            label="Drive"
            value={settings.saturation.drive}
            min={0}
            max={100}
            step={1}
            defaultValue={16}
            size={44}
            accent="#a78bfa"
            format={(value) => `${Math.round(value)}`}
            onChange={(value) => set((next) => (next.saturation.drive = value))}
          />
          <Knob
            label="Mix"
            value={settings.saturation.mix}
            min={0}
            max={50}
            step={1}
            defaultValue={14}
            size={44}
            accent="#a78bfa"
            format={(value) => `${Math.round(value)}`}
            onChange={(value) => set((next) => (next.saturation.mix = value))}
          />
          <Knob
            label="Tone"
            value={settings.saturation.tone}
            min={4000}
            max={20000}
            step={100}
            defaultValue={17000}
            size={44}
            accent="#a78bfa"
            format={(value) => formatFreq(value)}
            onChange={(value) => set((next) => (next.saturation.tone = value))}
          />
          <div className="relative overflow-hidden rounded-lg border border-white/[0.05] bg-black/20">
            <SaturationCurve drive={settings.saturation.drive} />
            <span className="absolute bottom-1 left-0 right-0 text-center text-[6.5px] uppercase tracking-wider text-ink-600">
              tanh
            </span>
          </div>
        </div>
        <p className="mt-2 text-[8px] text-ink-600">
          Armónicos suaves y densidad analógica antes del limitador.
        </p>
      </RackModule>

      <RackModule
        index="06"
        title="Limitador"
        icon={Lock}
        accent="#fb7185"
        enabled={settings.limiter.enabled}
        onToggle={(value) => set((next) => (next.limiter.enabled = value))}
        summary={`Brickwall · techo ${settings.limiter.ceiling.toFixed(1)} dBTP`}
      >
        <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-2">
          <div>
            <div className="text-[8.5px] text-ink-300">True-peak ceiling</div>
            <div className="num text-[15px] font-semibold text-white">
              {settings.limiter.ceiling.toFixed(1)}
              <span className="ml-1 text-[8px] font-normal text-ink-500">dBTP</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1 rounded border border-lime-acid/20 bg-lime-acid/[0.06] px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wide text-lime-acid/80">
              <Lock size={7} /> Fijado
            </span>
            <span className="text-[7px] text-ink-600">Estándar streaming</span>
          </div>
        </div>
        <div className="mt-2.5 flex items-end justify-between gap-4">
          <div className="flex-1">
            <Slider
              label="Release"
              value={settings.limiter.releaseMs}
              min={20}
              max={300}
              step={5}
              compact
              accent="#fb7185"
              format={(value) => `${Math.round(value)} ms`}
              onChange={(value) => set((next) => (next.limiter.releaseMs = value))}
            />
            <p className="mt-2 text-[7.5px] leading-relaxed text-ink-600">
              La vista previa usa un compresor rápido. El export aplica un limitador true-peak
              4× con lookahead.
            </p>
          </div>
          <Knob
            label="Release"
            value={settings.limiter.releaseMs}
            min={20}
            max={300}
            step={5}
            defaultValue={80}
            size={48}
            accent="#fb7185"
            format={(value) => `${Math.round(value)}`}
            onChange={(value) => set((next) => (next.limiter.releaseMs = value))}
          />
        </div>
        <LimiterStatus />
      </RackModule>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.055] px-3 py-2.5">
          <span className="label">Salida & entrega</span>
          <span className="inline-flex items-center gap-1 text-[7.5px] uppercase tracking-wider text-ink-500">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: platformInfo.color }}
            />
            {platformInfo.shortName}
          </span>
        </div>
        <div className="space-y-3 px-3 py-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-2">
            <div>
              <div className="text-[9px] font-medium text-ink-200">Normalizar al destino</div>
              <div className="mt-0.5 text-[8px] text-ink-600">
                {formatLufs(settings.targetLUFS)} LUFS · techo {settings.limiter.ceiling.toFixed(1)} dBTP
              </div>
            </div>
            <Toggle
              checked={settings.normalize}
              onChange={(value) => set((next) => (next.normalize = value))}
              label="Normalizar loudness"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.018] px-2 py-1.5">
              <div className="text-[7px] uppercase tracking-wide text-ink-600">WAV</div>
              <div className="num mt-0.5 text-[8.5px] text-ink-300">24-bit · 48 kHz</div>
            </div>
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.018] px-2 py-1.5">
              <div className="text-[7px] uppercase tracking-wide text-ink-600">MP3</div>
              <div className="num mt-0.5 text-[8.5px] text-ink-300">320 kbps CBR</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void runAnalysis()}
              disabled={!track || !!busy}
              className="w-full"
              title="Render de prueba y medición"
            >
              <Activity size={12} />
              Analizar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => openExport(true)}
              disabled={!track}
              className="w-full"
            >
              <Download size={12} />
              Exportar
            </Button>
          </div>

          <p className="flex items-start gap-1.5 text-[7.5px] leading-relaxed text-ink-600">
            <Sparkles size={9} className="mt-px shrink-0 text-lime-acid/60" />
            El render final mide LUFS integrada, limita picos verdaderos e itera hasta alcanzar
            el objetivo de {platformInfo.name}.
          </p>
        </div>
      </section>
    </div>
  );
}
