"use client";

import { Activity, Download, HelpCircle, History, Sparkles } from "lucide-react";
import { PLATFORMS } from "@/lib/presets";
import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "../ui/Button";

function LogoMark() {
  return (
    <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-[11px] border border-lime-acid/30 bg-gradient-to-br from-lime-acid/20 via-[#121609] to-[#0a0c10] shadow-[0_0_26px_-8px_rgba(216,255,87,0.5)]">
      <div className="flex items-end gap-[2.5px]">
        {[8, 15, 11, 19, 7].map((height, index) => (
          <span
            key={index}
            className="w-[2.5px] rounded-full bg-lime-acid"
            style={{
              height,
              opacity: 0.55 + index * 0.1,
            }}
          />
        ))}
      </div>
      <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-lime-acid/70 to-transparent" />
    </div>
  );
}

export function Header() {
  const track = useStudio((state) => state.track);
  const platform = useStudio((state) => state.platform);
  const target = useStudio((state) => state.settings.targetLUFS);
  const bypass = useStudio((state) => state.bypass);
  const setBypass = useStudio((state) => state.setBypass);
  const openExport = useStudio((state) => state.openExport);
  const openHistory = useStudio((state) => state.openHistory);
  const openHelp = useStudio((state) => state.openHelp);
  const runAnalysis = useStudio((state) => state.runAnalysis);
  const busy = useStudio((state) => state.busy);
  const platformInfo = PLATFORMS[platform];

  return (
    <header className="glass sticky top-0 z-50 border-b border-white/[0.06]">
      <div className="mx-auto flex h-[60px] max-w-[1680px] items-center gap-2.5 px-3 sm:gap-4 lg:px-5">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <div className="leading-none">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-semibold tracking-tight text-white">MasterAI</span>
              <span className="rounded-[4px] border border-lime-acid/30 bg-lime-acid/10 px-1 py-0.5 text-[7px] font-bold uppercase tracking-[0.14em] text-lime-acid">
                Pro
              </span>
            </div>
            <div className="mt-1 hidden text-[8px] font-medium uppercase tracking-[0.22em] text-ink-500 sm:block">
              AI Mastering Suite
            </div>
          </div>
        </div>

        <div className="mx-1 hidden h-7 w-px bg-white/[0.07] lg:block" />

        <div className="hidden min-w-0 items-center gap-2 lg:flex">
          <span className="label !text-[8px]">Destino</span>
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: platformInfo.color, boxShadow: `0 0 7px ${platformInfo.color}` }}
            />
            <span className="text-[10px] font-medium text-ink-200">{platformInfo.name}</span>
            <span className="num text-[9px] text-ink-500">{target.toFixed(1)} LUFS</span>
          </div>
        </div>

        <div className="flex-1" />

        {track && (
          <div className="mr-1 hidden items-center gap-0.5 rounded-lg border border-white/[0.07] bg-black/20 p-0.5 md:flex">
            <button
              type="button"
              onClick={() => setBypass(true)}
              className={cn(
                "focus-ring rounded-md px-2.5 py-1 text-[10px] font-semibold transition",
                bypass ? "bg-amber-glow/90 text-[#1a1205]" : "text-ink-400 hover:text-white",
              )}
              title="Original (atajo: B)"
            >
              Original
            </button>
            <button
              type="button"
              onClick={() => setBypass(false)}
              className={cn(
                "focus-ring rounded-md px-2.5 py-1 text-[10px] font-semibold transition",
                !bypass ? "bg-lime-acid text-[#0a0c04]" : "text-ink-400 hover:text-white",
              )}
              title="Masterizado (atajo: B)"
            >
              Master
            </button>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void runAnalysis()}
          disabled={!track || !!busy}
          className="hidden sm:inline-flex"
          title="Render de prueba y estadísticas"
        >
          <Activity size={14} />
          <span className="hidden xl:inline">Analizar</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => openHelp(true)}
          aria-label="Ayuda y guía de uso"
          title="Ayuda"
        >
          <HelpCircle size={16} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => openHistory(true)}
          className="relative"
          aria-label="Historial de masterizaciones"
          title="Historial"
        >
          <History size={16} />
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={() => openExport(true)}
          disabled={!track}
          className="pl-3 pr-3.5"
          title="Exportar master"
        >
          {track ? <Download size={14} strokeWidth={2.5} /> : <Sparkles size={14} />}
          <span className="hidden sm:inline">Exportar</span>
          <span className="sm:hidden">Export</span>
        </Button>
      </div>
    </header>
  );
}
