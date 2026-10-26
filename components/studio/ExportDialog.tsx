"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileAudio,
  FileMusic,
  Loader2,
  Lock,
  Music2,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { PLATFORMS, cloneSettings } from "@/lib/presets";
import { useStudio } from "@/lib/store";
import type { HistoryEntry, MasteringResult, RenderProgress } from "@/lib/types";
import { saveHistoryEntry } from "@/lib/history";
import { exportMaster } from "@/lib/audio/render";
import { cn, formatBytes, formatLufs, formatTime } from "@/lib/utils";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";

type Format = "wav" | "mp3";

const PHASE_STEPS = [
  { label: "Render offline", threshold: 0 },
  { label: "Medición de loudness", threshold: 0.42 },
  { label: "Limitación true-peak", threshold: 0.66 },
  { label: "Codificación final", threshold: 0.93 },
];

export function ExportDialog() {
  const open = useStudio((state) => state.exportOpen);
  const openExport = useStudio((state) => state.openExport);
  const track = useStudio((state) => state.track);
  const settings = useStudio((state) => state.settings);
  const genre = useStudio((state) => state.genre);
  const platform = useStudio((state) => state.platform);
  const region = useStudio((state) => state.region);
  const setPreviewEstimate = useStudio((state) => state.setPreviewEstimate);
  const notify = useStudio((state) => state.notify);

  const [format, setFormat] = useState<Format>("wav");
  const [normalize, setNormalize] = useState(true);
  const [useSelection, setUseSelection] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [result, setResult] = useState<MasteringResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);

  const platformInfo = PLATFORMS[platform];

  useEffect(() => {
    if (!open) return;
    setFormat("wav");
    setNormalize(settings.normalize);
    setUseSelection(Boolean(region));
    setWorking(false);
    setProgress(null);
    setResult(null);
    setError(null);
    setDownloadUrl(null);
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const duration = useMemo(() => {
    if (useSelection && region) return region.end - region.start;
    return track?.duration ?? 0;
  }, [useSelection, region, track?.duration]);

  const estimatedBytes =
    format === "wav"
      ? Math.ceil(duration * 48000 * 2 * 3 + 44)
      : Math.ceil((duration * 320000) / 8);

  const close = () => {
    if (working) {
      abortRef.current?.abort();
      setWorking(false);
      setProgress(null);
      notify("info", "Exportación cancelada", "No se generó ningún archivo.");
    }
    openExport(false);
  };

  const start = async () => {
    if (!track || working) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setWorking(true);
    setError(null);
    setResult(null);
    setDownloadUrl(null);
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }

    try {
      const range = useSelection && region ? region : null;
      const output = await exportMaster(track.buffer, settings, track.stats, {
        format,
        baseName: track.name,
        platformName: platformInfo.name,
        targetLUFS: settings.targetLUFS,
        normalize,
        range,
        signal: controller.signal,
        mp3BitRate: 320,
        onProgress: (update) => {
          if (!controller.signal.aborted) setProgress(update);
        },
      });

      if (controller.signal.aborted) return;

      setResult(output);
      setWorking(false);
      setProgress(null);

      const url = URL.createObjectURL(output.blob);
      urlRef.current = url;
      setDownloadUrl(url);

      setPreviewEstimate({
        before: track.stats,
        after: output.stats,
        gainDb: output.gainDb,
        limiterReductionDb: 0,
        renderSeconds: output.renderSeconds,
        renderedAt: Date.now(),
      });

      notify(
        "success",
        "Master exportado",
        `${output.fileName} · ${formatLufs(output.stats.lufsIntegrated)} LUFS · ${output.stats.truePeakDb.toFixed(1)} dBTP`,
      );

      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        name: track.name,
        fileName: output.fileName,
        createdAt: Date.now(),
        genre,
        platform,
        format,
        bytes: output.bytes,
        duration,
        settings: cloneSettings(settings),
        sourceStats: track.stats,
        outputStats: output.stats,
        blob: output.blob,
        range,
      };

      void saveHistoryEntry(entry).catch((historyError: unknown) => {
        notify(
          "error",
          "No se guardó en el historial",
          historyError instanceof Error
            ? historyError.message
            : "El navegador no tiene espacio local. Descarga tu archivo igualmente.",
        );
      });
    } catch (exportError) {
      setWorking(false);
      setProgress(null);
      if (
        exportError instanceof DOMException &&
        exportError.name === "AbortError"
      ) {
        notify("info", "Exportación cancelada", "No se generó ningún archivo.");
        return;
      }
      const message =
        exportError instanceof Error ? exportError.message : "Error desconocido al exportar.";
      setError(message);
      notify("error", "La exportación falló", message);
    } finally {
      abortRef.current = null;
    }
  };

  const download = () => {
    if (!result || !downloadUrl) return;
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = result.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const retry = () => {
    setResult(null);
    setError(null);
    setDownloadUrl(null);
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  const percent = Math.round((progress?.progress ?? 0) * 100);
  const activePhase = Math.max(
    0,
    PHASE_STEPS.findLastIndex((step) => (progress?.progress ?? 0) >= step.threshold),
  );

  const footer = working ? (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 text-[9px] text-ink-500">
        <Loader2 size={12} className="shrink-0 animate-spin text-lime-acid" />
        <span className="truncate">{progress?.detail ?? "Preparando exportación…"}</span>
      </div>
      <Button variant="secondary" size="sm" onClick={close}>
        Cancelar
      </Button>
    </div>
  ) : result ? (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" size="sm" onClick={retry}>
        <RotateCcw size={12} />
        Otra versión
      </Button>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={close}>
          Cerrar
        </Button>
        <Button variant="primary" size="sm" onClick={download}>
          <Download size={13} />
          Descargar {format.toUpperCase()}
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-3">
      <span className="hidden text-[8px] text-ink-600 sm:block">
        WAV 24-bit / 48 kHz · MP3 320 kbps · medición EBU R128
      </span>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <Button variant="ghost" size="sm" onClick={close}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void start()}
          disabled={!track || duration <= 0}
          className="flex-1 sm:flex-none"
        >
          <Sparkles size={13} />
          Masterizar y exportar
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={close}
      title="Exportar master"
      subtitle={
        track
          ? `${track.name} · ${platformInfo.name} · ${formatLufs(settings.targetLUFS)} LUFS`
          : undefined
      }
      width="lg"
      closeOnBackdrop={!working}
      footer={footer}
    >
      {working ? (
        <div className="py-2">
          <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-black/25 p-4">
            <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full border border-white/[0.07]">
              <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth="3"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="#d8ff57"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(percent / 100) * 175.9} 175.9`}
                  className="transition-all duration-300"
                />
              </svg>
              <span className="num absolute text-[15px] font-semibold text-white">{percent}%</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-white">
                {progress?.detail ?? "Preparando exportación…"}
              </div>
              <div className="mt-1 text-[9px] leading-relaxed text-ink-500">
                Renderizando a 48 kHz, midiendo loudness integrada e iterando la normalización.
                No cierres esta pestaña.
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-glow via-lime-acid to-lime-acid transition-[width] duration-300"
                  style={{ width: `${Math.max(3, percent)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {PHASE_STEPS.map((step, index) => {
              const done = index < activePhase;
              const active = index === activePhase;
              return (
                <div
                  key={step.label}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[9px]",
                    active
                      ? "border-lime-acid/25 bg-lime-acid/[0.05] text-ink-100"
                      : done
                        ? "border-white/[0.05] bg-white/[0.02] text-ink-400"
                        : "border-white/[0.04] text-ink-600",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 place-items-center rounded-full border",
                      done
                        ? "border-lime-acid/40 bg-lime-acid/15 text-lime-acid"
                        : active
                          ? "border-lime-acid/40 text-lime-acid"
                          : "border-white/10 text-transparent",
                    )}
                  >
                    {done ? (
                      <Check size={9} strokeWidth={3} />
                    ) : active ? (
                      <Loader2 size={8} className="animate-spin" />
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-white/10" />
                    )}
                  </span>
                  {step.label}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2 text-[8px] leading-relaxed text-ink-600">
            <Lock size={10} className="mt-px shrink-0 text-ink-500" />
            El render se ejecuta en tu dispositivo. El limitador true-peak y la normalización se
            aplican al archivo final, no solo a la vista previa.
          </div>
        </div>
      ) : result ? (
        <div>
          <div className="flex flex-col items-center py-3 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full border border-lime-acid/30 bg-lime-acid/[0.1] shadow-[0_0_36px_-8px_rgba(216,255,87,0.55)]">
              <CheckCircle2 size={26} className="text-lime-acid" />
            </div>
            <h3 className="mt-3 text-[15px] font-semibold text-white">Tu master está listo</h3>
            <p className="mt-1 max-w-md text-[10px] leading-relaxed text-ink-500">
              {result.fileName}
            </p>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                label: "Loudness",
                value: formatLufs(result.stats.lufsIntegrated),
                unit: "LUFS",
                good: Math.abs(result.stats.lufsIntegrated - settings.targetLUFS) <= 0.6,
              },
              {
                label: "True peak",
                value: result.stats.truePeakDb <= -95 ? "—" : result.stats.truePeakDb.toFixed(1),
                unit: "dBTP",
                good: result.stats.truePeakDb <= -0.9,
              },
              {
                label: "LRA",
                value: result.stats.lra.toFixed(1),
                unit: "LU",
                good: true,
              },
              {
                label: "Archivo",
                value: formatBytes(result.bytes),
                unit: format.toUpperCase(),
                good: true,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/[0.055] bg-black/20 px-3 py-2.5"
              >
                <div className="text-[7.5px] uppercase tracking-[0.12em] text-ink-600">
                  {item.label}
                </div>
                <div
                  className={cn(
                    "num mt-1 text-[20px] font-semibold leading-none",
                    item.good ? "text-white" : "text-amber-glow",
                  )}
                >
                  {item.value}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[7.5px] text-ink-600">
                  <span>{item.unit}</span>
                  <span className="text-ink-700">·</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.055] bg-white/[0.018] px-3 py-2.5">
            <div className="flex items-center gap-2 text-[9px] text-ink-400">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: platformInfo.color, boxShadow: `0 0 7px ${platformInfo.color}` }}
              />
              {platformInfo.name} · objetivo {formatLufs(settings.targetLUFS)} LUFS
            </div>
            <div className="flex items-center gap-2 text-[8px] text-ink-500">
              {normalize ? (
                <>
                  <Check size={9} className="text-lime-acid" /> Normalizado
                </>
              ) : (
                <>
                  <TriangleAlert size={9} className="text-amber-glow" /> Sin normalizar
                </>
              )}
              <span className="text-ink-700">·</span>
              <span>{format === "wav" ? "24-bit / 48 kHz" : "320 kbps CBR"}</span>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/[0.045] bg-black/15 px-3 py-2 text-[8px] leading-relaxed text-ink-600">
            <Music2 size={10} className="mt-px shrink-0 text-ink-500" />
            Guardado en el historial local de este dispositivo. Puedes recuperar los ajustes o
            descargar el archivo más tarde desde el historial.
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-danger/20 bg-danger/[0.06] px-3 py-2 text-[9px] text-danger">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                {
                  id: "wav" as const,
                  title: "WAV",
                  detail: "24-bit PCM · 48 kHz",
                  note: "Sin pérdida · ideal para distribución y archivo",
                  icon: FileAudio,
                },
                {
                  id: "mp3" as const,
                  title: "MP3",
                  detail: "320 kbps CBR · 48 kHz",
                  note: "Compatible · ideal para compartir y demos",
                  icon: FileMusic,
                },
              ] satisfies Array<{
                id: Format;
                title: string;
                detail: string;
                note: string;
                icon: typeof FileAudio;
              }>
            ).map((item) => {
              const Icon = item.icon;
              const active = format === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFormat(item.id)}
                  className={cn(
                    "focus-ring relative overflow-hidden rounded-xl border p-3 text-left transition",
                    active
                      ? "border-lime-acid/40 bg-lime-acid/[0.06]"
                      : "border-white/[0.07] bg-white/[0.018] hover:border-white/15",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-lg border",
                        active
                          ? "border-lime-acid/30 bg-lime-acid/10 text-lime-acid"
                          : "border-white/[0.07] bg-white/[0.03] text-ink-400",
                      )}
                    >
                      <Icon size={15} />
                    </span>
                    <span
                      className={cn(
                        "grid h-4 w-4 place-items-center rounded-full border",
                        active
                          ? "border-lime-acid bg-lime-acid text-[#0a0c04]"
                          : "border-white/15 text-transparent",
                      )}
                    >
                      <Check size={9} strokeWidth={3} />
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] font-semibold text-white">{item.title}</div>
                  <div className="num mt-0.5 text-[8px] text-ink-400">{item.detail}</div>
                  <div className="mt-1 text-[7.5px] leading-relaxed text-ink-600">{item.note}</div>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-medium text-ink-100">Normalizar loudness</div>
                <div className="mt-0.5 text-[8px] text-ink-500">
                  Ajusta la ganancia y limita picos hasta alcanzar {formatLufs(settings.targetLUFS)} LUFS
                  con techo {settings.limiter.ceiling.toFixed(1)} dBTP
                </div>
              </div>
              <Toggle checked={normalize} onChange={setNormalize} label="Normalizar loudness" />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.05] pt-2.5">
              <div>
                <div className="text-[7px] uppercase tracking-wide text-ink-600">Objetivo</div>
                <div className="num mt-0.5 text-[10px] text-ink-200">
                  {formatLufs(settings.targetLUFS)} LUFS
                </div>
              </div>
              <div>
                <div className="text-[7px] uppercase tracking-wide text-ink-600">Techo</div>
                <div className="num mt-0.5 text-[10px] text-ink-200">
                  {settings.limiter.ceiling.toFixed(1)} dBTP
                </div>
              </div>
              <div>
                <div className="text-[7px] uppercase tracking-wide text-ink-600">Duración</div>
                <div className="num mt-0.5 text-[10px] text-ink-200">{formatTime(duration)}</div>
              </div>
            </div>
          </div>

          {region && (
            <button
              type="button"
              onClick={() => setUseSelection((value) => !value)}
              className="focus-ring flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-2.5 text-left transition hover:border-white/12"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid h-4 w-4 place-items-center rounded border transition",
                    useSelection
                      ? "border-lime-acid bg-lime-acid text-[#0a0c04]"
                      : "border-white/15 text-transparent",
                  )}
                >
                  <Check size={9} strokeWidth={3} />
                </span>
                <div>
                  <div className="text-[9.5px] font-medium text-ink-200">Exportar solo la selección</div>
                  <div className="num mt-0.5 text-[8px] text-ink-500">
                    {formatTime(region.start)} → {formatTime(region.end)} · {formatTime(duration)}
                  </div>
                </div>
              </div>
              <span className="rounded border border-white/[0.07] px-1.5 py-0.5 text-[7px] uppercase tracking-wider text-ink-500">
                {useSelection ? "región" : "pista completa"}
              </span>
            </button>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.055] bg-white/[0.015] px-3 py-2.5">
            <div className="flex items-center gap-2 text-[8px] text-ink-500">
              <ArrowRight size={10} className="text-lime-acid/60" />
              Salida estimada
            </div>
            <div className="num text-[10px] font-medium text-ink-200">
              {formatTime(duration)} · {formatBytes(estimatedBytes)} · {format.toUpperCase()}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/[0.06] px-3 py-2.5 text-[9px] leading-relaxed text-danger">
              <TriangleAlert size={12} className="mt-px shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">No se pudo exportar</div>
                <div className="mt-0.5 text-danger/80">{error}</div>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-danger/70 hover:text-danger"
                aria-label="Descartar error"
              >
                <X size={11} />
              </button>
            </div>
          )}

          <p className="flex items-start gap-1.5 text-[8px] leading-relaxed text-ink-600">
            <Lock size={9} className="mt-px shrink-0" />
            Todo el procesado y la codificación ocurren en tu navegador. Tus archivos nunca salen
            de este dispositivo.
          </p>
        </div>
      )}
    </Modal>
  );
}
