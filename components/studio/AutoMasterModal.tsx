"use client";

import { Check, Download, SlidersHorizontal, Sparkles, Wand2 } from "lucide-react";
import { PLATFORMS, getGenre } from "@/lib/presets";
import { useStudio } from "@/lib/store";
import { cn, formatLufs } from "@/lib/utils";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

export function AutoMasterModal() {
  const notes = useStudio((state) => state.autoNotes);
  const track = useStudio((state) => state.track);
  const genre = useStudio((state) => state.genre);
  const platform = useStudio((state) => state.platform);
  const settings = useStudio((state) => state.settings);
  const clearNotes = useStudio((state) => state.clearAutoNotes);
  const openExport = useStudio((state) => state.openExport);
  const setMobileView = useStudio((state) => state.setMobileView);

  const open = notes !== null;
  const profile = getGenre(genre);
  const platformInfo = PLATFORMS[platform];
  const openRack = () => {
    clearNotes();
    setMobileView("rack");
  };
  const goExport = () => {
    clearNotes();
    openExport(true);
  };

  return (
    <Modal
      open={open}
      onClose={clearNotes}
      title="Informe Auto-Master IA"
      subtitle={`${profile.name} · ${platformInfo.name} · ${formatLufs(settings.targetLUFS)} LUFS`}
      width="md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={openRack}>
            <SlidersHorizontal size={12} />
            Revisar cadena
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={clearNotes}>
              Ajustar manualmente
            </Button>
            <Button variant="primary" size="sm" onClick={goExport}>
              <Download size={12} />
              Exportar
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex items-center gap-3 rounded-xl border border-lime-acid/15 bg-gradient-to-r from-lime-acid/[0.08] to-transparent p-3.5">
        <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-lime-acid text-[#0a0c04] shadow-[0_0_30px_-6px_rgba(216,255,87,0.7)]">
          <Wand2 size={19} />
          <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-lime-acid/40 bg-[#0b0d12]">
            <Sparkles size={8} className="text-lime-acid" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[12px] font-semibold text-white">Cadena aplicada</h3>
          <p className="mt-0.5 text-[9px] leading-relaxed text-ink-300">
            El motor ha analizado el balance espectral, la dinámica y la sonoridad de tu mezcla y
            ha ajustado los seis módulos DSP.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: "Entrada", value: track ? formatLufs(track.stats.lufsIntegrated) : "—", unit: "LUFS" },
          { label: "Objetivo", value: formatLufs(settings.targetLUFS), unit: "LUFS" },
          { label: "Techo", value: settings.limiter.ceiling.toFixed(1), unit: "dBTP" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-white/[0.055] bg-black/20 px-2.5 py-2">
            <div className="text-[7.5px] uppercase tracking-wide text-ink-300">{item.label}</div>
            <div className="num mt-0.5 text-[16px] font-semibold text-white">
              {item.value}
              <span className="ml-1 text-[7px] font-normal text-ink-200">{item.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles size={10} className="text-lime-acid/70" />
          <span className="label">Decisiones del motor</span>
        </div>
        <div className="space-y-1.5">
          {(notes ?? []).map((note, index) => (
            <div
              key={`${index}-${note.slice(0, 12)}`}
              className="flex items-start gap-2 rounded-lg border border-white/[0.045] bg-white/[0.015] px-2.5 py-2"
            >
              <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full border border-lime-acid/25 bg-lime-acid/[0.07] text-lime-acid">
                <Check size={8} strokeWidth={3} />
              </span>
              <p className="text-[9px] leading-relaxed text-ink-300">{note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {settings.eq.bands.map((band, index) => (
          <div
            key={band.id}
            className="flex items-center justify-between rounded-md border border-white/[0.045] bg-black/15 px-2 py-1.5"
          >
            <span className="flex items-center gap-1.5 text-[8px] text-ink-200">
              <span
                className="h-1 w-1 rounded-full"
                style={{ background: ["#d8ff57", "#ffb45e", "#5eead4", "#a78bfa", "#fb7185"][index] }}
              />
              {band.label}
            </span>
            <span
              className={cn(
                "num text-[8.5px] font-medium",
                Math.abs(band.gain) < 0.05 ? "text-ink-300" : "text-ink-200",
              )}
            >
              {band.gain > 0 ? "+" : ""}
              {band.gain.toFixed(1)} dB
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-md border border-white/[0.045] bg-black/15 px-2 py-1.5">
          <span className="text-[8px] text-ink-200">Compresor</span>
          <span className="num text-[8.5px] font-medium text-ink-200">
            {settings.compressor.ratio.toFixed(1)}:1
          </span>
        </div>
      </div>

      <p className="mt-3 text-[7.5px] leading-relaxed text-ink-300">
        Motor heurístico local: no se envía audio a ningún servidor. Puedes afinar cualquier
        parámetro manualmente; la exportación volverá a medir y normalizar el resultado final.
      </p>
    </Modal>
  );
}
