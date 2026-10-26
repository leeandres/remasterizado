"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  HardDrive,
  History,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { getGenre, PLATFORMS } from "@/lib/presets";
import { useStudio } from "@/lib/store";
import type { HistoryEntry } from "@/lib/types";
import {
  clearHistory,
  deleteHistoryEntry,
  listHistoryEntries,
  storageEstimate,
} from "@/lib/history";
import { cn, formatBytes, formatDate, formatLufs, formatTime } from "@/lib/utils";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

export function HistoryDrawer() {
  const open = useStudio((state) => state.historyOpen);
  const openHistory = useStudio((state) => state.openHistory);
  const applyHistorySettings = useStudio((state) => state.applyHistorySettings);
  const notify = useStudio((state) => state.notify);

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, estimate] = await Promise.all([listHistoryEntries(), storageEstimate()]);
      setEntries(list);
      setStorage(estimate);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  const close = () => openHistory(false);

  const download = (entry: HistoryEntry) => {
    const url = URL.createObjectURL(entry.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = entry.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const restore = (entry: HistoryEntry) => {
    applyHistorySettings(entry.settings, entry.genre, entry.platform);
    notify(
      "success",
      "Ajustes recuperados",
      `${getGenre(entry.genre).name} · ${PLATFORMS[entry.platform].name} · ${formatLufs(entry.outputStats.lufsIntegrated)} LUFS`,
    );
    close();
  };

  const remove = async (entry: HistoryEntry) => {
    setBusyId(entry.id);
    try {
      await deleteHistoryEntry(entry.id);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      notify("info", "Masterización eliminada", entry.fileName);
      void storageEstimate().then(setStorage);
    } catch {
      notify("error", "No se pudo eliminar", "Vuelve a intentarlo desde el historial.");
    } finally {
      setBusyId(null);
    }
  };

  const clearAll = async () => {
    if (!entries.length) return;
    const confirmed = window.confirm(
      "¿Borrar todas las masterizaciones guardadas? Esta acción no se puede deshacer.",
    );
    if (!confirmed) return;
    setClearing(true);
    try {
      await clearHistory();
      setEntries([]);
      setStorage(await storageEstimate());
      notify("info", "Historial borrado", "Se han eliminado los archivos locales.");
    } catch {
      notify("error", "No se pudo borrar el historial", "Inténtalo de nuevo.");
    } finally {
      setClearing(false);
    }
  };

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-[8px] text-ink-500">
        <HardDrive size={10} className="text-ink-500" />
        {storage ? (
          <span className="num">
            {formatBytes(storage.usage)} usados
            {storage.quota ? ` de ${formatBytes(storage.quota)}` : ""}
          </span>
        ) : (
          <span>Almacenamiento local del navegador</span>
        )}
        <span className="text-ink-700">·</span>
        <span>máx. 8 masters</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void clearAll()}
          disabled={!entries.length || clearing}
          className="text-danger/80 hover:bg-danger/10 hover:text-danger"
        >
          {clearing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          Borrar todo
        </Button>
        <Button variant="secondary" size="sm" onClick={close}>
          Cerrar
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={close}
      title="Historial local"
      subtitle="Masterizaciones guardadas en este dispositivo"
      width="lg"
      footer={footer}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-14">
          <Loader2 size={20} className="animate-spin text-lime-acid" />
          <p className="mt-3 text-[10px] text-ink-500">Leyendo el historial…</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.025]">
            <History size={24} className="text-ink-500" strokeWidth={1.5} />
          </div>
          <h3 className="mt-3 text-[12px] font-semibold text-ink-200">Todavía no hay masters</h3>
          <p className="mt-1 max-w-xs text-[9px] leading-relaxed text-ink-500">
            Cada exportación se guarda aquí con sus ajustes y el archivo final, listo para
            descargar de nuevo.
          </p>
          <Button variant="secondary" size="sm" onClick={close} className="mt-4">
            Volver al estudio
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const platform = PLATFORMS[entry.platform];
            const genre = getGenre(entry.genre);
            const onTarget =
              Math.abs(entry.outputStats.lufsIntegrated - entry.settings.targetLUFS) <= 0.6;
            const peakOk = entry.outputStats.truePeakDb <= -0.9;
            return (
              <article
                key={entry.id}
                className="group overflow-hidden rounded-xl border border-white/[0.06] bg-black/20 transition hover:border-white/[0.11]"
              >
                <div className="flex items-start gap-2.5 px-3 py-2.5">
                  <div className="relative mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-lime-acid/15 bg-lime-acid/[0.06]">
                    <span className="num text-[7px] font-bold uppercase tracking-wider text-lime-acid/80">
                      {entry.format}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className="truncate text-[10.5px] font-medium text-ink-100"
                        title={entry.name}
                      >
                        {entry.name.replace(/\.[^.]+$/, "")}
                      </h3>
                      <span className="num shrink-0 text-[7.5px] text-ink-600">
                        {formatDate(entry.createdAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] text-ink-500">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="h-1 w-1 rounded-full"
                          style={{ background: platform.color }}
                        />
                        {platform.name}
                      </span>
                      <span className="text-ink-700">·</span>
                      <span>{genre.name}</span>
                      <span className="text-ink-700">·</span>
                      <span className="num">{formatTime(entry.duration)}</span>
                      <span className="text-ink-700">·</span>
                      <span className="num">{formatBytes(entry.bytes)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="num text-[10px] font-semibold text-white">
                        {formatLufs(entry.outputStats.lufsIntegrated)}
                        <span className="ml-1 text-[7px] font-normal text-ink-500">LUFS</span>
                      </span>
                      <span className="num text-[8px] text-ink-400">
                        TP {entry.outputStats.truePeakDb <= -95 ? "—" : `${entry.outputStats.truePeakDb.toFixed(1)} dBTP`}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[6.5px] font-semibold uppercase tracking-wider",
                          onTarget && peakOk
                            ? "bg-lime-acid/[0.07] text-lime-acid/80"
                            : "bg-amber-glow/[0.07] text-amber-glow/80",
                        )}
                      >
                        {onTarget && peakOk ? <CheckCircle2 size={7} /> : <Clock3 size={7} />}
                        {onTarget && peakOk ? "en objetivo" : "revisar"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex border-t border-white/[0.045]">
                  <button
                    type="button"
                    onClick={() => download(entry)}
                    className="focus-ring flex flex-1 items-center justify-center gap-1.5 py-2 text-[8.5px] font-medium text-lime-acid/80 transition hover:bg-lime-acid/[0.05] hover:text-lime-acid"
                  >
                    <Download size={10} />
                    Descargar
                  </button>
                  <div className="w-px bg-white/[0.045]" />
                  <button
                    type="button"
                    onClick={() => restore(entry)}
                    className="focus-ring flex flex-1 items-center justify-center gap-1.5 py-2 text-[8.5px] text-ink-400 transition hover:bg-white/[0.035] hover:text-white"
                  >
                    <RotateCcw size={10} />
                    Cargar ajustes
                  </button>
                  <div className="w-px bg-white/[0.045]" />
                  <button
                    type="button"
                    onClick={() => void remove(entry)}
                    disabled={busyId === entry.id}
                    className="focus-ring flex w-10 items-center justify-center text-ink-600 transition hover:bg-danger/[0.06] hover:text-danger disabled:opacity-40"
                    aria-label={`Eliminar ${entry.fileName}`}
                  >
                    {busyId === entry.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Trash2 size={11} />
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
