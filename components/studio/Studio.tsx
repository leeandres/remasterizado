"use client";

import { useEffect } from "react";
import { Keyboard, Sparkles } from "lucide-react";
import { previewEngine, useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { LibraryPanel } from "./LibraryPanel";
import { RackPanel } from "./RackPanel";
import { EmptyStudio } from "./EmptyStudio";
import { TrackPanel } from "./TrackPanel";
import { LiveMeters } from "./LiveMeters";
import { AnalyzerCard } from "./AnalyzerCard";
import { StatsPanel } from "./StatsPanel";
import { MobileNav } from "./MobileNav";
import { ExportDialog } from "./ExportDialog";
import { HistoryDrawer } from "./HistoryDrawer";
import { HelpModal } from "./HelpModal";
import { AutoMasterModal } from "./AutoMasterModal";
import { BusyOverlay } from "./BusyOverlay";
import { ToastHost } from "../ui/Toast";

export default function Studio() {
  const track = useStudio((state) => state.track);
  const mobileView = useStudio((state) => state.mobileView);

  useEffect(() => {
    previewEngine.onEnded = () => {
      useStudio.setState({ isPlaying: false });
    };
    return () => {
      previewEngine.onEnded = null;
    };
  }, []);

  useEffect(() => {
    const dispose = () => {
      previewEngine.pause();
    };
    window.addEventListener("pagehide", dispose);
    return () => window.removeEventListener("pagehide", dispose);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, button, a, [contenteditable="true"], [role="slider"]',
        )
      ) {
        return;
      }
      const state = useStudio.getState();
      if (state.busy || state.exportOpen || state.historyOpen || state.autoNotes) return;

      if (event.code === "Space") {
        event.preventDefault();
        state.togglePlay();
      } else if (event.key === "b" || event.key === "B") {
        event.preventDefault();
        state.setBypass(!state.bypass);
      } else if (event.key === "l" || event.key === "L") {
        event.preventDefault();
        state.toggleLoop();
      } else if ((event.key === "e" || event.key === "E") && state.track) {
        event.preventDefault();
        state.openExport(true);
      } else if (event.key === "h" || event.key === "H") {
        event.preventDefault();
        state.openHistory(true);
      } else if (event.key === "?") {
        event.preventDefault();
        state.openHelp(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative z-10 flex min-h-dvh flex-col">
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-70"
        aria-hidden
        style={{
          background:
            "radial-gradient(900px 500px at 50% -20%, rgba(216,255,87,0.035), transparent 70%)",
        }}
      />

      <Header />

      <main className="mx-auto w-full max-w-[1680px] flex-1 px-2.5 pb-24 pt-2.5 sm:px-3 lg:px-4 lg:pb-6">
        <div className="grid gap-2.5 lg:grid-cols-[228px_minmax(0,1fr)_296px] xl:grid-cols-[278px_minmax(0,1fr)_336px] 2xl:grid-cols-[296px_minmax(0,1fr)_354px]">
          <aside
            className={cn(
              "min-w-0 lg:sticky lg:top-[72px] lg:max-h-[calc(100dvh-84px)] lg:overflow-y-auto lg:overscroll-contain lg:pb-4 lg:pr-0.5",
              mobileView === "library" ? "block" : "hidden lg:block",
            )}
            aria-label="Biblioteca y perfil"
          >
            <LibraryPanel />
          </aside>

          <section
            className={cn(
              "min-w-0 space-y-2.5",
              mobileView === "studio" ? "block" : "hidden lg:block",
            )}
            aria-label="Estudio de masterización"
          >
            {track ? (
              <>
                <TrackPanel />
                <LiveMeters />
                <AnalyzerCard />
                <StatsPanel />
              </>
            ) : (
              <EmptyStudio />
            )}

            <div className="hidden items-center justify-center gap-4 px-2 py-1 text-[8px] text-ink-700 lg:flex">
              <span className="inline-flex items-center gap-1.5">
                <Keyboard size={10} />
                Atajos
              </span>
              <span>
                <kbd className="rounded border border-white/[0.07] bg-white/[0.03] px-1 py-px text-ink-500">
                  Espacio
                </kbd>{" "}
                play/pausa
              </span>
              <span>
                <kbd className="rounded border border-white/[0.07] bg-white/[0.03] px-1 py-px text-ink-500">
                  B
                </kbd>{" "}
                A/B
              </span>
              <span>
                <kbd className="rounded border border-white/[0.07] bg-white/[0.03] px-1 py-px text-ink-500">
                  L
                </kbd>{" "}
                loop
              </span>
              <span>
                <kbd className="rounded border border-white/[0.07] bg-white/[0.03] px-1 py-px text-ink-500">
                  E
                </kbd>{" "}
                exportar
              </span>
            </div>

            <div className="flex items-center justify-center gap-1.5 pb-2 pt-1 text-[8px] text-ink-700 lg:hidden">
              <Sparkles size={9} className="text-lime-acid/40" />
              MasterAI Pro · procesado local
            </div>
          </section>

          <aside
            className={cn(
              "min-w-0 lg:sticky lg:top-[72px] lg:max-h-[calc(100dvh-84px)] lg:overflow-y-auto lg:overscroll-contain lg:pb-4 lg:pl-0.5",
              mobileView === "rack" ? "block" : "hidden lg:block",
            )}
            aria-label="Cadena de efectos"
          >
            <RackPanel />
          </aside>
        </div>
      </main>

      <MobileNav />
      <ExportDialog />
      <HistoryDrawer />
      <HelpModal />
      <AutoMasterModal />
      <BusyOverlay />
      <ToastHost />
    </div>
  );
}
