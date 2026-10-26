"use client";

import { Activity, ArrowRight, ArrowRightLeft, CheckCircle2, Gauge, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useStudio } from "@/lib/store";
import { cn, formatLufs } from "@/lib/utils";
import { Button } from "../ui/Button";

function MetricRow({
  label,
  before,
  after,
  unit,
  deltaDigits = 1,
  highlight,
}: {
  label: string;
  before: number;
  after: number;
  unit: string;
  deltaDigits?: number;
  highlight?: "good" | "warn" | "neutral";
}) {
  const delta = after - before;
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-t border-white/[0.04] px-1 py-1.5 first:border-t-0">
      <span className="text-[8.5px] text-ink-500">{label}</span>
      <span className="num text-right text-[9px] text-ink-400">
        {before <= -95 ? "—" : before.toFixed(1)}
        <span className="ml-0.5 text-[7px] text-ink-600">{unit}</span>
      </span>
      <span className="text-ink-700">→</span>
      <span
        className={cn(
          "num min-w-[62px] text-right text-[10px] font-semibold",
          highlight === "good"
            ? "text-lime-acid"
            : highlight === "warn"
              ? "text-amber-glow"
              : "text-ink-100",
        )}
      >
        {after <= -95 ? "—" : after.toFixed(1)}
        <span className="ml-0.5 text-[7px] font-normal text-ink-500">{unit}</span>
        <span
          className={cn(
            "ml-1.5 text-[7px] font-normal",
            Math.abs(delta) < 0.05 ? "text-ink-700" : "text-ink-500",
          )}
        >
          {Math.abs(delta) >= 0.05
            ? `${delta > 0 ? "+" : ""}${delta.toFixed(deltaDigits)}`
            : "="}
        </span>
      </span>
    </div>
  );
}

export function StatsPanel() {
  const track = useStudio((state) => state.track);
  const estimate = useStudio((state) => state.previewEstimate);
  const settings = useStudio((state) => state.settings);
  const busy = useStudio((state) => state.busy);
  const runAnalysis = useStudio((state) => state.runAnalysis);

  if (!track) return null;

  const before = estimate?.before ?? track.stats;
  const after = estimate?.after;
  const target = settings.targetLUFS;
  const onTarget = after ? Math.abs(after.lufsIntegrated - target) <= 0.6 : false;
  const peakOk = after ? after.truePeakDb <= -0.9 : false;

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.055] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-cyan-glow/20 bg-cyan-glow/[0.06]">
            <ArrowRightLeft size={12} className="text-cyan-glow/80" />
          </span>
          <div>
            <div className="text-[10.5px] font-semibold text-white">Original vs. master</div>
            <div className="mt-0.5 text-[8px] text-ink-500">
              Proyección del render final · objetivo {formatLufs(target)} LUFS
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {after && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[7.5px] font-semibold uppercase tracking-wider",
                onTarget && peakOk
                  ? "border-lime-acid/25 bg-lime-acid/[0.07] text-lime-acid/90"
                  : "border-amber-glow/25 bg-amber-glow/[0.07] text-amber-glow/90",
              )}
            >
              {onTarget && peakOk ? <CheckCircle2 size={8} /> : <TriangleAlert size={8} />}
              {onTarget && peakOk ? "En objetivo" : "Revisar"}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void runAnalysis()}
            disabled={!!busy}
            className="h-7 px-2.5 text-[9px]"
          >
            {busy ? <Loader2 size={10} className="animate-spin" /> : <Activity size={10} />}
            {after ? "Recalcular" : "Analizar"}
          </Button>
        </div>
      </div>

      {!after ? (
        <div className="grid gap-3 px-3 py-3 sm:grid-cols-[1fr_1.1fr]">
          <div className="rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="label !text-[8px]">Original</span>
              <span className="num text-[8px] text-ink-500">EBU R128</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[7.5px] uppercase tracking-wide text-ink-600">Integrated</div>
                <div className="num mt-0.5 text-[16px] font-semibold text-white">
                  {formatLufs(before.lufsIntegrated)}
                  <span className="ml-1 text-[7px] font-normal text-ink-600">LUFS</span>
                </div>
              </div>
              <div>
                <div className="text-[7.5px] uppercase tracking-wide text-ink-600">True peak</div>
                <div className="num mt-0.5 text-[16px] font-semibold text-white">
                  {before.truePeakDb <= -95 ? "—" : before.truePeakDb.toFixed(1)}
                  <span className="ml-1 text-[7px] font-normal text-ink-600">dBTP</span>
                </div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/[0.04] pt-2">
              <div>
                <div className="text-[7.5px] uppercase tracking-wide text-ink-600">LRA</div>
                <div className="num mt-0.5 text-[10px] text-ink-200">
                  {before.lra.toFixed(1)} <span className="text-[7px] text-ink-600">LU</span>
                </div>
              </div>
              <div>
                <div className="text-[7.5px] uppercase tracking-wide text-ink-600">Crest</div>
                <div className="num mt-0.5 text-[10px] text-ink-200">
                  {before.crestDb.toFixed(1)} <span className="text-[7px] text-ink-600">dB</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start justify-center rounded-lg border border-dashed border-white/[0.1] bg-white/[0.012] px-3 py-3">
            <div className="flex items-center gap-1.5 text-[9px] font-medium text-ink-200">
              <Gauge size={12} className="text-lime-acid/70" />
              Proyección disponible
            </div>
            <p className="mt-1 text-[8px] leading-relaxed text-ink-500">
              Analiza la cadena para renderizar offline, medir la sonoridad final y comprobar el
              cumplimiento de true peak antes de exportar.
            </p>
            <button
              type="button"
              onClick={() => void runAnalysis()}
              disabled={!!busy}
              className="focus-ring mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-lime-acid px-2.5 py-1.5 text-[9px] font-semibold text-[#0a0c04] transition hover:bg-[#e4ff82] disabled:opacity-40"
            >
              {busy ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              {busy ? "Renderizando…" : "Renderizar comparativa"}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 py-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-white/[0.055] bg-black/25 px-3 py-2.5">
            <div>
              <div className="text-[7.5px] font-semibold uppercase tracking-[0.14em] text-ink-600">
                Original
              </div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="num text-[24px] font-semibold leading-none text-ink-300">
                  {formatLufs(estimate.before.lufsIntegrated)}
                </span>
                <span className="text-[8px] text-ink-600">LUFS</span>
              </div>
              <div className="num mt-1 text-[8px] text-ink-500">
                TP {estimate.before.truePeakDb <= -95 ? "—" : estimate.before.truePeakDb.toFixed(1)} dBTP
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 px-1">
              <ArrowRight size={14} className="text-ink-600" />
              <span className="num text-[7px] text-lime-acid/70">
                {estimate.gainDb > 0 ? "+" : ""}
                {estimate.gainDb.toFixed(1)} dB
              </span>
            </div>
            <div className="text-right">
              <div className="text-[7.5px] font-semibold uppercase tracking-[0.14em] text-lime-acid/70">
                Master
              </div>
              <div className="mt-0.5 flex items-baseline justify-end gap-1">
                <span className="num text-[24px] font-semibold leading-none text-white">
                  {formatLufs(estimate.after.lufsIntegrated)}
                </span>
                <span className="text-[8px] text-ink-500">LUFS</span>
              </div>
              <div
                className={cn(
                  "num mt-1 text-[8px]",
                  peakOk ? "text-lime-acid/80" : "text-amber-glow",
                )}
              >
                TP {estimate.after.truePeakDb <= -95 ? "—" : estimate.after.truePeakDb.toFixed(1)} dBTP
              </div>
            </div>
          </div>

          <div className="mt-2">
            <MetricRow
              label="Integrated loudness"
              before={estimate.before.lufsIntegrated}
              after={estimate.after.lufsIntegrated}
              unit="LUFS"
              highlight={onTarget ? "good" : "warn"}
            />
            <MetricRow
              label="True peak"
              before={estimate.before.truePeakDb}
              after={estimate.after.truePeakDb}
              unit="dBTP"
              highlight={peakOk ? "good" : "warn"}
            />
            <MetricRow
              label="Loudness range"
              before={estimate.before.lra}
              after={estimate.after.lra}
              unit="LU"
              highlight="neutral"
            />
            <MetricRow
              label="Crest factor"
              before={estimate.before.crestDb}
              after={estimate.after.crestDb}
              unit="dB"
              highlight="neutral"
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.04] pt-2 text-[7.5px] text-ink-600">
            <span>
              Limitador:{" "}
              <span className="num text-ink-400">
                −{estimate.limiterReductionDb.toFixed(1)} dB
              </span>
            </span>
            <span className="text-ink-700">·</span>
            <span>
              Render: <span className="num text-ink-400">{estimate.renderSeconds.toFixed(1)} s</span>
            </span>
            <span className="text-ink-700">·</span>
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  onTarget && peakOk ? "bg-lime-acid" : "bg-amber-glow",
                )}
              />
              {onTarget && peakOk
                ? "Cumple objetivo de plataforma"
                : `Objetivo ${formatLufs(target)} LUFS / −1.0 dBTP`}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
