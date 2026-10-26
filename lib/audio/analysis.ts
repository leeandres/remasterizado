import type { AnalysisStats, SpectralBands } from "../types";
import { BiquadState, kWeightingCoeffs } from "./biquad";
import { yieldToMain } from "../utils";

const SILENCE_LUFS = -70;
const SILENCE_PEAK = -96;

export interface AnalysisOptions {
  spectral?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

interface ChannelPair {
  left: Float32Array;
  right: Float32Array;
  channels: number;
  mono: boolean;
}

function getChannels(buffer: AudioBuffer): ChannelPair {
  const channels = buffer.numberOfChannels;
  const left = buffer.getChannelData(0);
  const right = channels > 1 ? buffer.getChannelData(1) : left;
  return { left, right, channels: channels > 1 ? 2 : 1, mono: channels === 1 };
}

function cubicAt(x0: number, x1: number, x2: number, x3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * x1 +
      (-x0 + x2) * t +
      (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 +
      (-x0 + 3 * x1 - 3 * x2 + x3) * t3)
  );
}

/** Peak of a 4x cubic interpolation around sample i (i-1..i+2). */
export function interpolatedPeakAt(data: Float32Array, i: number): number {
  const n = data.length;
  const i0 = Math.max(0, i - 1);
  const i1 = i;
  const i2 = Math.min(n - 1, i + 1);
  const i3 = Math.min(n - 1, i + 2);
  const x0 = data[i0];
  const x1 = data[i1];
  const x2 = data[i2];
  const x3 = data[i3];
  let peak = Math.max(Math.abs(x1), Math.abs(x2));
  peak = Math.max(peak, Math.abs(cubicAt(x0, x1, x2, x3, 0.25)));
  peak = Math.max(peak, Math.abs(cubicAt(x0, x1, x2, x3, 0.5)));
  peak = Math.max(peak, Math.abs(cubicAt(x0, x1, x2, x3, 0.75)));
  return peak;
}

export async function measureTruePeakBuffer(
  buffer: AudioBuffer,
  signal?: AbortSignal,
): Promise<number> {
  const { left, right } = getChannels(buffer);
  const n = left.length;
  let peak = 0;
  let lastYield = performance.now();

  for (const data of [left, right]) {
    for (let i = 0; i < n; i++) {
      if ((i & 1023) === 0) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        if (performance.now() - lastYield > 40) {
          await yieldToMain();
          lastYield = performance.now();
        }
      }
      const value = interpolatedPeakAt(data, i);
      if (value > peak) peak = value;
    }
  }
  if (peak <= 1e-9) return SILENCE_PEAK;
  return 20 * Math.log10(peak);
}

function loudnessFromEnergy(energy: number): number {
  if (energy <= 1e-12) return SILENCE_LUFS;
  return Math.max(SILENCE_LUFS, -0.691 + 10 * Math.log10(energy));
}

function gatedIntegrated(energies: number[]): number {
  if (!energies.length) return SILENCE_LUFS;
  const absGate = energies.filter((e) => loudnessFromEnergy(e) >= -70);
  if (!absGate.length) return SILENCE_LUFS;
  const absMean = absGate.reduce((a, b) => a + b, 0) / absGate.length;
  const relativeGate = loudnessFromEnergy(absMean) - 10;
  const gated = energies.filter(
    (e) => loudnessFromEnergy(e) >= -70 && loudnessFromEnergy(e) >= relativeGate,
  );
  if (!gated.length) return SILENCE_LUFS;
  const mean = gated.reduce((a, b) => a + b, 0) / gated.length;
  return loudnessFromEnergy(mean);
}

function percentile(sorted: number[], ratio: number): number {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export async function analyzeBuffer(
  buffer: AudioBuffer,
  options: AnalysisOptions = {},
): Promise<AnalysisStats> {
  const { signal, onProgress } = options;
  const { left, right, channels } = getChannels(buffer);
  const sampleRate = buffer.sampleRate;
  const n = left.length;
  const duration = n / sampleRate;

  if (!n) {
    return {
      duration: 0,
      sampleRate,
      channels,
      lufsIntegrated: SILENCE_LUFS,
      lufsShortTermMax: SILENCE_LUFS,
      truePeakDb: SILENCE_PEAK,
      lra: 0,
      crestDb: 0,
      correlation: 0,
      spectral: emptySpectral(),
      dcOffset: 0,
    };
  }

  const { shelf, highpass } = kWeightingCoeffs(sampleRate);
  const shelfL = new BiquadState(shelf);
  const shelfR = new BiquadState(shelf);
  const hpL = new BiquadState(highpass);
  const hpR = new BiquadState(highpass);

  const hopLength = Math.max(1, Math.round(sampleRate * 0.1));
  const hopEnergies: number[] = [];
  let hopSum = 0;
  let hopCount = 0;

  let sumL2 = 0;
  let sumR2 = 0;
  let sumLR = 0;
  let sumL = 0;
  let sumR = 0;
  let rawPeak = 0;

  let lastYield = performance.now();
  const chunk = 262144;

  for (let start = 0; start < n; start += chunk) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const end = Math.min(n, start + chunk);
    for (let i = start; i < end; i++) {
      const l = left[i];
      const r = channels === 1 ? l : right[i];

      const kl = hpL.process(shelfL.process(l));
      const kr = hpR.process(shelfR.process(r));

      hopSum += kl * kl + kr * kr;
      hopCount++;

      sumL2 += l * l;
      sumR2 += r * r;
      sumLR += l * r;
      sumL += l;
      sumR += r;
      const absL = Math.abs(l);
      if (absL > rawPeak) rawPeak = absL;
      const absR = Math.abs(r);
      if (absR > rawPeak) rawPeak = absR;

      if (hopCount >= hopLength) {
        hopEnergies.push(hopSum / (hopCount * 2));
        hopSum = 0;
        hopCount = 0;
      }
    }
    if (performance.now() - lastYield > 40) {
      onProgress?.((start + chunk) / (n * 2.4));
      await yieldToMain();
      lastYield = performance.now();
    }
  }

  if (hopCount > 0) {
    hopEnergies.push(hopSum / (hopCount * 2));
  }

  // 400 ms loudness blocks with 75% overlap (4 x 100 ms hops).
  const blockEnergies: number[] = [];
  if (hopEnergies.length >= 4) {
    let rolling = hopEnergies[0] + hopEnergies[1] + hopEnergies[2] + hopEnergies[3];
    blockEnergies.push(rolling / 4);
    for (let i = 4; i < hopEnergies.length; i++) {
      rolling += hopEnergies[i] - hopEnergies[i - 4];
      blockEnergies.push(rolling / 4);
    }
  } else if (hopEnergies.length > 0) {
    blockEnergies.push(hopEnergies.reduce((a, b) => a + b, 0) / hopEnergies.length);
  }

  const integrated = gatedIntegrated(blockEnergies);

  // 3 s short-term windows, one hop step.
  let shortTermMax = SILENCE_LUFS;
  const shortTermLoudness: number[] = [];
  const windowHops = Math.max(1, Math.min(30, hopEnergies.length));
  if (hopEnergies.length > 0) {
    let rolling = 0;
    for (let i = 0; i < hopEnergies.length; i++) {
      rolling += hopEnergies[i];
      if (i >= windowHops) rolling -= hopEnergies[i - windowHops];
      if (i >= windowHops - 1) {
        const value = loudnessFromEnergy(rolling / windowHops);
        shortTermLoudness.push(value);
        if (value > shortTermMax) shortTermMax = value;
      }
    }
  }

  // Loudness range (EBU R128): 3 s windows every 1 s, absolute -70, relative -20.
  let lra = 0;
  if (hopEnergies.length >= 10) {
    const st: number[] = [];
    for (let start = 0; start + windowHops <= hopEnergies.length; start += 10) {
      let sum = 0;
      for (let j = 0; j < windowHops; j++) sum += hopEnergies[start + j];
      const value = loudnessFromEnergy(sum / windowHops);
      if (value > -70) st.push(value);
    }
    if (st.length > 1) {
      st.sort((a, b) => a - b);
      const relativeGate = percentile(st, 0.5) - 20;
      const gated = st.filter((v) => v >= relativeGate);
      if (gated.length > 1) {
        lra = percentile(gated, 0.95) - percentile(gated, 0.1);
      }
    }
  }

  const truePeakDb = await measureTruePeakBuffer(buffer, signal);

  onProgress?.(0.75);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  await yieldToMain();

  const rms = Math.sqrt((sumL2 + sumR2) / (2 * n));
  const crestDb = rawPeak > 1e-9 && rms > 1e-9 ? 20 * Math.log10(rawPeak / rms) : 0;
  const correlation =
    channels === 1
      ? 1
      : Math.max(-1, Math.min(1, sumLR / Math.sqrt(Math.max(sumL2 * sumR2, 1e-20))));
  const dcOffset = Math.max(Math.abs(sumL / n), Math.abs(sumR / n));

  let spectral = emptySpectral();
  if (options.spectral !== false) {
    spectral = await computeSpectralProfile(buffer, signal, (p) => onProgress?.(0.75 + p * 0.25));
  }

  onProgress?.(1);

  return {
    duration,
    sampleRate,
    channels,
    lufsIntegrated: integrated,
    lufsShortTermMax: shortTermMax,
    truePeakDb,
    lra,
    crestDb,
    correlation,
    spectral,
    dcOffset,
  };
}

function emptySpectral(): SpectralBands {
  return { sub: -96, low: -96, lowMid: -96, mid: -96, highMid: -96, air: -96 };
}

const FFT_SIZE = 8192;

function fftInPlace(real: Float32Array, imag: Float32Array) {
  const n = real.length;
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curReal = 1;
      let curImag = 0;
      for (let k = 0; k < len / 2; k++) {
        const evenReal = real[i + k];
        const evenImag = imag[i + k];
        const oddReal = real[i + k + len / 2] * curReal - imag[i + k + len / 2] * curImag;
        const oddImag = real[i + k + len / 2] * curImag + imag[i + k + len / 2] * curReal;
        real[i + k] = evenReal + oddReal;
        imag[i + k] = evenImag + oddImag;
        real[i + k + len / 2] = evenReal - oddReal;
        imag[i + k + len / 2] = evenImag - oddImag;
        const nextReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = nextReal;
      }
    }
  }
}

const BANDS: Array<[keyof SpectralBands, number, number]> = [
  ["sub", 20, 60],
  ["low", 60, 250],
  ["lowMid", 250, 1000],
  ["mid", 1000, 4000],
  ["highMid", 4000, 8000],
  ["air", 8000, 20000],
];

export async function computeSpectralProfile(
  buffer: AudioBuffer,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
): Promise<SpectralBands> {
  const { left, right, channels } = getChannels(buffer);
  const n = left.length;
  if (n < FFT_SIZE) return emptySpectral();

  const sampleRate = buffer.sampleRate;
  const binHz = sampleRate / FFT_SIZE;
  const window = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1));
  }

  const power = new Float64Array(FFT_SIZE / 2);
  const maxSegments = 160;
  const stride = Math.max(FFT_SIZE * 2, Math.floor((n - FFT_SIZE) / maxSegments));
  let segments = 0;

  for (let offset = 0; offset + FFT_SIZE <= n; offset += stride) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const real = new Float32Array(FFT_SIZE);
    const imag = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      const sample =
        channels === 1 ? left[offset + i] : (left[offset + i] + right[offset + i]) * 0.5;
      real[i] = sample * window[i];
    }
    fftInPlace(real, imag);
    for (let i = 0; i < FFT_SIZE / 2; i++) {
      power[i] += real[i] * real[i] + imag[i] * imag[i];
    }
    segments++;
    if (segments % 16 === 0) {
      onProgress?.(Math.min(1, offset / Math.max(1, n)));
      await yieldToMain();
    }
  }

  if (!segments) return emptySpectral();

  const result = emptySpectral();
  const norm = 1 / (segments * FFT_SIZE * FFT_SIZE);
  for (const [key, lo, hi] of BANDS) {
    const startBin = Math.max(1, Math.floor(lo / binHz));
    const endBin = Math.min(FFT_SIZE / 2 - 1, Math.ceil(hi / binHz));
    let sum = 0;
    let count = 0;
    for (let bin = startBin; bin <= endBin; bin++) {
      sum += power[bin] * norm;
      count++;
    }
    const value = count ? sum / count : 0;
    result[key] = value > 1e-12 ? Math.max(-96, 10 * Math.log10(value)) : -96;
  }
  onProgress?.(1);
  return result;
}

export async function measureIntegratedLoudness(buffer: AudioBuffer): Promise<number> {
  const stats = await analyzeBuffer(buffer, { spectral: false });
  return stats.lufsIntegrated;
}

export interface LoudnessSummary {
  integrated: number;
  shortTermMax: number;
  lra: number;
}

/** Fast K-weighted loudness pass used while normalizing exports. */
export async function measureLoudnessSummary(
  buffer: AudioBuffer,
  signal?: AbortSignal,
  onProgress?: (p: number) => void,
): Promise<LoudnessSummary> {
  const { left, right, channels } = getChannels(buffer);
  const n = left.length;
  const sr = buffer.sampleRate;
  if (!n) return { integrated: SILENCE_LUFS, shortTermMax: SILENCE_LUFS, lra: 0 };

  const { shelf, highpass } = kWeightingCoeffs(sr);
  const shelfL = new BiquadState(shelf);
  const shelfR = new BiquadState(shelf);
  const hpL = new BiquadState(highpass);
  const hpR = new BiquadState(highpass);
  const hopLength = Math.max(1, Math.round(sr * 0.1));
  const hopEnergies: number[] = [];
  let hopSum = 0;
  let hopCount = 0;
  let lastYield = performance.now();
  const chunk = 262144;

  for (let start = 0; start < n; start += chunk) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const end = Math.min(n, start + chunk);
    for (let i = start; i < end; i++) {
      const l = left[i];
      const kl = hpL.process(shelfL.process(l));
      const kr =
        channels === 1 ? kl : hpR.process(shelfR.process(right[i]));
      hopSum += kl * kl + kr * kr;
      hopCount++;
      if (hopCount >= hopLength) {
        hopEnergies.push(hopSum / (hopCount * 2));
        hopSum = 0;
        hopCount = 0;
      }
    }
    if (performance.now() - lastYield > 40) {
      onProgress?.((start + chunk) / n);
      await yieldToMain();
      lastYield = performance.now();
    }
  }
  if (hopCount > 0) hopEnergies.push(hopSum / (hopCount * 2));

  const blockEnergies: number[] = [];
  if (hopEnergies.length >= 4) {
    let rolling = hopEnergies[0] + hopEnergies[1] + hopEnergies[2] + hopEnergies[3];
    blockEnergies.push(rolling / 4);
    for (let i = 4; i < hopEnergies.length; i++) {
      rolling += hopEnergies[i] - hopEnergies[i - 4];
      blockEnergies.push(rolling / 4);
    }
  } else if (hopEnergies.length) {
    blockEnergies.push(hopEnergies.reduce((a, b) => a + b, 0) / hopEnergies.length);
  }

  const integrated = gatedIntegrated(blockEnergies);
  const windowHops = Math.max(1, Math.min(30, hopEnergies.length));
  let shortTermMax = SILENCE_LUFS;
  if (hopEnergies.length) {
    let rolling = 0;
    for (let i = 0; i < hopEnergies.length; i++) {
      rolling += hopEnergies[i];
      if (i >= windowHops) rolling -= hopEnergies[i - windowHops];
      if (i >= windowHops - 1) {
        shortTermMax = Math.max(shortTermMax, loudnessFromEnergy(rolling / windowHops));
      }
    }
  }

  let lra = 0;
  if (hopEnergies.length >= 10) {
    const st: number[] = [];
    for (let start = 0; start + windowHops <= hopEnergies.length; start += 10) {
      let sum = 0;
      for (let j = 0; j < windowHops; j++) sum += hopEnergies[start + j];
      const value = loudnessFromEnergy(sum / windowHops);
      if (value > -70) st.push(value);
    }
    if (st.length > 1) {
      st.sort((a, b) => a - b);
      const relativeGate = percentile(st, 0.5) - 20;
      const gated = st.filter((v) => v >= relativeGate);
      if (gated.length > 1) lra = percentile(gated, 0.95) - percentile(gated, 0.1);
    }
  }

  onProgress?.(1);
  return { integrated, shortTermMax, lra };
}

