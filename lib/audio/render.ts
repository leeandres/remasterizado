import type {
  AnalysisStats,
  MasteringResult,
  MasteringSettings,
  RenderProgress,
} from "../types";
import { clamp, safeFileName } from "../utils";
import { analyzeBuffer, measureLoudnessSummary } from "./analysis";
import { MasteringChain } from "./chain";
import { applyGainInPlace, limitTruePeak } from "./limiter";
import { encodeMp3 } from "./mp3";
import { encodeWav24 } from "./wav";

export const EXPORT_SAMPLE_RATE = 48000;
const MAX_FRAMES = 120_000_000; // ~41 min at 48 kHz — guards browser memory.

export interface SelectionRange {
  start: number;
  end: number;
}

export function normalizeRange(
  duration: number,
  range: { start: number; end: number } | null,
): SelectionRange | null {
  if (!range) return null;
  const start = clamp(range.start, 0, duration);
  const end = clamp(range.end, 0, duration);
  if (end - start < 0.1) return null;
  return { start, end };
}

export async function renderChain(
  source: AudioBuffer,
  settings: MasteringSettings,
  range: SelectionRange | null,
  sampleRate = EXPORT_SAMPLE_RATE,
): Promise<AudioBuffer> {
  const start = range?.start ?? 0;
  const end = range?.end ?? source.duration;
  const duration = Math.max(0.01, end - start);
  const frames = Math.max(1, Math.ceil(duration * sampleRate));
  if (frames > MAX_FRAMES) {
    throw new Error(
      "La selección es demasiado larga para renderizar en este dispositivo. Selecciona una región más corta o divide el tema.",
    );
  }

  const ctx = new OfflineAudioContext(2, frames, sampleRate);
  const node = ctx.createBufferSource();
  node.buffer = source;
  const chain = new MasteringChain(ctx, settings, { includeLimiter: false });
  node.connect(chain.input);
  chain.output.connect(ctx.destination);
  node.start(0, start, duration);

  try {
    const rendered = await ctx.startRendering();
    return rendered;
  } finally {
    chain.dispose();
    try {
      node.disconnect();
    } catch {
      // already disconnected
    }
  }
}

export interface MasterBufferOptions {
  normalize: boolean;
  targetLUFS: number;
  range: SelectionRange | null;
  signal?: AbortSignal;
  onProgress?: (update: RenderProgress) => void;
}

export interface MasterBufferResult {
  buffer: AudioBuffer;
  stats: AnalysisStats;
  gainDb: number;
  limiterReductionDb: number;
  renderSeconds: number;
}

export async function masterBuffer(
  source: AudioBuffer,
  settings: MasteringSettings,
  options: MasterBufferOptions,
): Promise<MasterBufferResult> {
  const started = performance.now();
  const report = (phase: RenderProgress["phase"], progress: number, detail: string) =>
    options.onProgress?.({ phase, progress, detail });

  report("preparing", 0.04, "Construyendo la cadena de masterización…");
  const rendered = await renderChain(source, settings, options.range);

  report("rendering", 0.42, "Render offline completado");
  report("measuring", 0.5, "Midiendo loudness integrada…");

  const initial = await measureLoudnessSummary(rendered, options.signal);
  let gainDb = 0;
  let limiterReductionDb = 0;

  if (options.normalize && initial.integrated > -69) {
    gainDb = clamp(options.targetLUFS - initial.integrated, -24, 24);
    if (Math.abs(gainDb) > 0.01) applyGainInPlace(rendered, gainDb);
  }

  report("normalizing", 0.6, "Aplicando normalización de sonoridad…");

  if (settings.limiter.enabled) {
    report("limiting", 0.68, "Limitando picos verdaderos a -1.0 dBTP…");
    const limited = await limitTruePeak(
      rendered,
      settings.limiter.ceiling,
      settings.limiter.releaseMs,
      { signal: options.signal },
    );
    limiterReductionDb = limited.gainReductionDb;
  }

  if (options.normalize) {
    for (let pass = 0; pass < 2; pass++) {
      const loud = await measureLoudnessSummary(rendered, options.signal);
      if (loud.integrated <= -69) break;
      const delta = options.targetLUFS - loud.integrated;
      if (Math.abs(delta) < 0.25) break;
      const step = clamp(delta, -4, 4);
      applyGainInPlace(rendered, step);
      gainDb += step;
      if (settings.limiter.enabled) {
        report("limiting", 0.74 + pass * 0.05, "Ajustando el limitador al objetivo…");
        const limited = await limitTruePeak(
          rendered,
          settings.limiter.ceiling,
          settings.limiter.releaseMs,
          { signal: options.signal },
        );
        limiterReductionDb = Math.max(limiterReductionDb, limited.gainReductionDb);
      }
    }
  }

  report("measuring", 0.86, "Calculando estadísticas finales…");
  const stats = await analyzeBuffer(rendered, {
    spectral: false,
    signal: options.signal,
    onProgress: (p) => report("measuring", 0.86 + p * 0.08, "Calculando estadísticas finales…"),
  });

  report("done", 0.94, "Render listo");
  return {
    buffer: rendered,
    stats,
    gainDb,
    limiterReductionDb,
    renderSeconds: (performance.now() - started) / 1000,
  };
}

export interface ExportMasterOptions extends MasterBufferOptions {
  format: "wav" | "mp3";
  baseName: string;
  platformName: string;
  targetLUFS: number;
  mp3BitRate?: number;
}

export async function exportMaster(
  source: AudioBuffer,
  settings: MasteringSettings,
  sourceStats: AnalysisStats,
  options: ExportMasterOptions,
): Promise<MasteringResult> {
  const started = performance.now();
  const result = await masterBuffer(source, settings, options);

  const extension = options.format === "wav" ? "wav" : "mp3";
  const fileName = safeFileName(
    options.baseName,
    ` — MasterAI · ${options.platformName} · ${options.targetLUFS} LUFS`,
    extension,
  );

  let blob: Blob;
  if (options.format === "wav") {
    options.onProgress?.({
      phase: "encoding",
      progress: 0.95,
      detail: "Codificando WAV 24-bit / 48 kHz…",
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    blob = encodeWav24(result.buffer);
  } else {
    options.onProgress?.({
      phase: "encoding",
      progress: 0.94,
      detail: "Codificando MP3 320 kbps…",
    });
    blob = await encodeMp3(
      result.buffer,
      options.mp3BitRate ?? 320,
      (p) =>
        options.onProgress?.({
          phase: "encoding",
          progress: 0.94 + p * 0.05,
          detail: "Codificando MP3 320 kbps…",
        }),
      options.signal,
    );
  }

  return {
    buffer: result.buffer,
    stats: result.stats,
    before: sourceStats,
    gainDb: result.gainDb,
    format: options.format,
    blob,
    fileName,
    bytes: blob.size,
    renderSeconds: (performance.now() - started) / 1000,
  };
}
