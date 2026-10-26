import type { LoadedTrack } from "../types";
import { yieldToMain } from "../utils";
import { analyzeBuffer } from "./analysis";

export interface AudioMetadata {
  sampleRate: number | null;
  channels: number | null;
  bitDepth: number | null;
  duration: number | null;
}

const WAV_EXT = ["wav", "wave"];
const FLAC_EXT = ["flac"];
const MP3_EXT = ["mp3"];

export function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function parseAudioMetadata(buffer: ArrayBuffer, extension: string): AudioMetadata {
  const view = new DataView(buffer);
  try {
    if (WAV_EXT.includes(extension)) return parseWav(view);
    if (FLAC_EXT.includes(extension)) return parseFlac(view);
    if (MP3_EXT.includes(extension)) return parseMp3(view);
  } catch {
    // Metadata is best-effort.
  }
  return { sampleRate: null, channels: null, bitDepth: null, duration: null };
}

function parseWav(view: DataView): AudioMetadata {
  let offset = 12;
  let sampleRate: number | null = null;
  let channels: number | null = null;
  let bitDepth: number | null = null;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= view.byteLength) {
    const id = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt " && offset + 16 <= view.byteLength) {
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      byteRate = view.getUint32(offset + 16, true);
      bitDepth = view.getUint16(offset + 22, true);
    }
    if (id === "data") {
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  return {
    sampleRate,
    channels,
    bitDepth,
    duration: byteRate > 0 && dataSize > 0 ? dataSize / byteRate : null,
  };
}

function parseFlac(view: DataView): AudioMetadata {
  if (view.byteLength < 42) return { sampleRate: null, channels: null, bitDepth: null, duration: null };
  const marker = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  );
  if (marker !== "fLaC") return { sampleRate: null, channels: null, bitDepth: null, duration: null };
  let offset = 4;
  while (offset + 4 <= view.byteLength) {
    const header = view.getUint8(offset);
    const type = header & 0x7f;
    const last = (header & 0x80) !== 0;
    const length =
      (view.getUint8(offset + 1) << 16) |
      (view.getUint8(offset + 2) << 8) |
      view.getUint8(offset + 3);
    if (type === 0 && length >= 34) {
      const p = offset + 4 + 10;
      const b0 = view.getUint8(p);
      const b1 = view.getUint8(p + 1);
      const b2 = view.getUint8(p + 2);
      const b3 = view.getUint8(p + 3);
      const sampleRate = (b0 << 12) | (b1 << 4) | (b2 >> 4);
      const channels = ((b2 >> 1) & 0x07) + 1;
      const bitDepth = (((b2 & 0x01) << 4) | (b3 >> 4)) + 1;
      const totalSamples =
        (b3 & 0x0f) * 2 ** 32 + view.getUint32(p + 4);
      return {
        sampleRate,
        channels,
        bitDepth,
        duration: sampleRate > 0 ? totalSamples / sampleRate : null,
      };
    }
    offset += 4 + length;
    if (last) break;
  }
  return { sampleRate: null, channels: null, bitDepth: null, duration: null };
}

function parseMp3(view: DataView): AudioMetadata {
  let offset = 0;
  if (
    view.byteLength > 10 &&
    view.getUint8(0) === 0x49 &&
    view.getUint8(1) === 0x44 &&
    view.getUint8(2) === 0x33
  ) {
    const size =
      ((view.getUint8(6) & 0x7f) << 21) |
      ((view.getUint8(7) & 0x7f) << 14) |
      ((view.getUint8(8) & 0x7f) << 7) |
      (view.getUint8(9) & 0x7f);
    offset = 10 + size;
  }
  const rates = [
    [44100, 48000, 32000],
    [22050, 24000, 16000],
    [11025, 12000, 8000],
  ];
  for (let i = offset; i < Math.min(view.byteLength - 4, offset + 200000); i++) {
    if (view.getUint8(i) !== 0xff) continue;
    const b1 = view.getUint8(i + 1);
    if ((b1 & 0xe0) !== 0xe0) continue;
    const versionBits = (b1 >> 3) & 0x03;
    if (versionBits === 1) continue;
    const version = versionBits === 3 ? 0 : versionBits === 2 ? 1 : 2;
    const b2 = view.getUint8(i + 2);
    const rateIndex = (b2 >> 2) & 0x03;
    if (rateIndex === 3) continue;
    const b3 = view.getUint8(i + 3);
    return {
      sampleRate: rates[version][rateIndex],
      channels: ((b3 >> 6) & 0x03) === 3 ? 1 : 2,
      bitDepth: null,
      duration: null,
    };
  }
  return { sampleRate: null, channels: null, bitDepth: null, duration: null };
}

async function toStereo(source: AudioBuffer): Promise<AudioBuffer> {
  if (source.numberOfChannels === 2) return source;
  const target = new AudioBuffer({
    length: source.length,
    numberOfChannels: 2,
    sampleRate: source.sampleRate,
  });
  const left = target.getChannelData(0);
  const right = target.getChannelData(1);
  if (source.numberOfChannels === 1) {
    const mono = source.getChannelData(0);
    left.set(mono);
    right.set(mono);
  } else {
    // Let Web Audio perform the standard 5.1 / multichannel downmix.
    const ctx = new OfflineAudioContext(2, source.length, source.sampleRate);
    const node = ctx.createBufferSource();
    node.buffer = source;
    node.connect(ctx.destination);
    node.start();
    return ctx.startRendering();
  }
  return target;
}

async function decodeWithContext(data: ArrayBuffer, sampleRate: number): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, 1, sampleRate);
  return ctx.decodeAudioData(data);
}

export interface DecodeResult {
  buffer: AudioBuffer;
  metadata: AudioMetadata;
  extension: string;
}

export async function decodeAudioFile(file: File): Promise<DecodeResult> {
  const extension = fileExtension(file.name);
  const firstBytes = await file.slice(0, Math.min(file.size, 8 * 1024 * 1024)).arrayBuffer();
  const metadata = parseAudioMetadata(firstBytes, extension);
  let decoded: AudioBuffer;
  const sr = metadata.sampleRate;
  const targetRate = sr && sr >= 8000 && sr <= 96000 ? sr : 48000;

  try {
    decoded = await decodeWithContext(await file.arrayBuffer(), targetRate);
  } catch {
    // Retry at 48 kHz in case the browser cannot open a context at the
    // source rate reported by the header.
    try {
      decoded = await decodeWithContext(await file.arrayBuffer(), 48000);
    } catch {
      if (FLAC_EXT.includes(extension)) {
        throw new Error(
          "Este navegador no ha podido decodificar el FLAC. Actualiza el navegador o convierte el archivo a WAV de 24 bits.",
        );
      }
      throw new Error(
        "Formato no soportado por el navegador. Usa WAV, MP3 o FLAC. " +
          "Si el archivo está dañado, vuelve a exportarlo desde tu DAW.",
      );
    }
  }

  const stereo = await toStereo(decoded);
  return {
    buffer: stereo,
    metadata,
    extension,
  };
}

export function extractPeaks(buffer: AudioBuffer, maxPoints = 3600): Array<Float32Array> {
  const channels = Math.min(2, buffer.numberOfChannels);
  const result: Array<Float32Array> = [];
  const length = buffer.length;
  const points = Math.max(1, Math.min(maxPoints, length));
  const bucket = length / points;

  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    const peaks = new Float32Array(points);
    for (let p = 0; p < points; p++) {
      const start = Math.floor(p * bucket);
      const end = Math.min(length, Math.floor((p + 1) * bucket));
      let best = 0;
      let bestAbs = 0;
      for (let i = start; i < end; i++) {
        const abs = Math.abs(data[i]);
        if (abs > bestAbs) {
          bestAbs = abs;
          best = data[i];
        }
      }
      peaks[p] = best;
    }
    result.push(peaks);
  }
  return result;
}

export interface PrepareProgress {
  phase: "decoding" | "analyzing" | "peaks" | "done";
  progress: number;
  detail: string;
}

export async function prepareTrack(
  file: File,
  onProgress?: (update: PrepareProgress) => void,
): Promise<LoadedTrack> {
  onProgress?.({ phase: "decoding", progress: 0.05, detail: "Decodificando audio…" });
  const { buffer, metadata, extension } = await decodeAudioFile(file);
  onProgress?.({ phase: "analyzing", progress: 0.25, detail: "Midiendo loudness EBU R128…" });
  await yieldToMain();

  const stats = await analyzeBuffer(buffer, {
    spectral: true,
    onProgress: (p) =>
      onProgress?.({
        phase: "analyzing",
        progress: 0.25 + p * 0.65,
        detail: p < 0.75 ? "Analizando espectro y picos…" : "Calculando perfil espectral…",
      }),
  });

  onProgress?.({ phase: "peaks", progress: 0.93, detail: "Generando forma de onda…" });
  await yieldToMain();
  const peaks = extractPeaks(buffer);

  onProgress?.({ phase: "done", progress: 1, detail: "Listo" });
  return {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    mime: file.type || "audio/unknown",
    extension,
    duration: buffer.duration,
    sampleRate: metadata.sampleRate ?? buffer.sampleRate,
    channels: metadata.channels ?? buffer.numberOfChannels,
    bitDepth: metadata.bitDepth,
    buffer,
    peaks,
    stats,
  };
}
