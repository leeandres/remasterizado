"use client";

import { Activity, Download, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { PLATFORM_LIST } from "@/lib/presets";
import { UploadZone } from "./UploadZone";

const FEATURES = [
  {
    icon: Activity,
    title: "Analiza con precisión",
    text: "LUFS integrada EBU R128, true peak 4×, LRA, crest factor y balance espectral en tiempo real.",
    accent: "#5eead4",
  },
  {
    icon: SlidersHorizontal,
    title: "Procesa como un estudio",
    text: "Filtro, EQ paramétrico de 5 bandas, compresor multibanda, saturación armónica y limitador.",
    accent: "#ffb45e",
  },
  {
    icon: Download,
    title: "Entrega lista para streaming",
    text: "WAV 24-bit / 48 kHz o MP3 320 kbps, normalizado al objetivo exacto de cada plataforma.",
    accent: "#d8ff57",
  },
];

export function EmptyStudio() {
  return (
    <div className="space-y-3">
      <UploadZone variant="hero" />

      <div className="grid gap-2.5 sm:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="panel group relative overflow-hidden p-3.5 transition-colors hover:border-white/[0.12]"
            >
              <span
                className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.08] blur-2xl transition-opacity group-hover:opacity-[0.16]"
                style={{ background: feature.accent }}
              />
              <div
                className="grid h-8 w-8 place-items-center rounded-lg border"
                style={{
                  color: feature.accent,
                  borderColor: `${feature.accent}2e`,
                  background: `${feature.accent}10`,
                }}
              >
                <Icon size={15} strokeWidth={1.8} />
              </div>
              <h3 className="mt-2.5 text-[11px] font-semibold text-ink-100">{feature.title}</h3>
              <p className="mt-1 text-[9px] leading-relaxed text-ink-200">{feature.text}</p>
            </div>
          );
        })}
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.055] px-3.5 py-2.5">
          <div className="flex items-center gap-1.5">
            <Sparkles size={11} className="text-lime-acid/70" />
            <span className="label">Objetivos de entrega incluidos</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[8px] text-ink-200">
            <ShieldCheck size={10} className="text-lime-acid/60" />
            Techo −1.0 dBTP
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-white/[0.05] sm:grid-cols-4">
          {PLATFORM_LIST.map((platform) => (
            <div key={platform.id} className="px-3 py-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: platform.color,
                    boxShadow: `0 0 7px ${platform.color}66`,
                  }}
                />
                <span className="text-[9px] font-medium text-ink-300">{platform.name}</span>
              </div>
              <div className="num mt-1 text-[18px] font-semibold leading-none text-white">
                {platform.targetLUFS}
                <span className="ml-1 text-[8px] font-normal text-ink-200">LUFS</span>
              </div>
              <p className="mt-1 text-[7.5px] text-ink-300">{platform.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-2 py-1 text-[8.5px] text-ink-300">
        <span>Procesado local en tu navegador</span>
        <span className="text-ink-300">·</span>
        <span>Sin subir tu música a ningún servidor</span>
        <span className="text-ink-300">·</span>
        <span>MP3 · WAV · FLAC</span>
      </div>
    </div>
  );
}
