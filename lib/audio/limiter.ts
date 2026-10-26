import { dbToGain } from "../utils";
import { interpolatedPeakAt, measureTruePeakBuffer } from "./analysis";

export interface LimiterResult {
  truePeakDb: number;
  gainReductionDb: number;
  appliedCeiling: number;
}

/**
 * Lookahead brickwall limiter with a shared stereo gain envelope.
 * Works in place on the AudioBuffer so we avoid allocating full copies.
 *
 * The envelope looks ahead `lookaheadMs` and computes a true-peak-aware
 * (4x cubic interpolated) peak, so inter-sample peaks stay under the ceiling.
 */
export async function limitTruePeak(
  buffer: AudioBuffer,
  ceilingDb: number,
  releaseMs: number,
  opts: { lookaheadMs?: number; signal?: AbortSignal } = {},
): Promise<LimiterResult> {
  const sr = buffer.sampleRate;
  const channels = Math.min(2, buffer.numberOfChannels);
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));
  const right = channels > 1 ? data[1] : data[0];
  const left = data[0];

  const n = left.length;
  if (!n) {
    return { truePeakDb: -96, gainReductionDb: 0, appliedCeiling: ceilingDb };
  }

  const lookahead = Math.max(1, Math.round((sr * (opts.lookaheadMs ?? 5)) / 1000));
  const ringSize = lookahead + 1;
  const ringL = new Float32Array(ringSize);
  const ringR = new Float32Array(ringSize);

  const ceilingLinear = dbToGain(ceilingDb);
  const releaseCoeff = Math.exp(-1 / Math.max(1, (releaseMs / 1000) * sr));
  const attackCoeff = Math.exp(-1 / Math.max(1, 0.0012 * sr));

  const dequeCap = lookahead + 2;
  const dequeIdx = new Int32Array(dequeCap);
  const dequeVal = new Float32Array(dequeCap);
  let head = 0;
  let tail = 0;

  let gain = 1;
  let minGain = 1;

  const readPeak = (i: number): number => {
    const idx = Math.min(n - 1, i);
    const l = interpolatedPeakAt(left, idx);
    const r = channels > 1 ? interpolatedPeakAt(right, idx) : 0;
    return Math.max(l, r);
  };

  const pushPeak = (index: number, value: number) => {
    while (tail !== head) {
      const last = (tail - 1 + dequeCap) % dequeCap;
      if (dequeVal[last] <= value) {
        tail = last;
      } else {
        break;
      }
    }
    dequeIdx[tail] = index;
    dequeVal[tail] = value;
    tail = (tail + 1) % dequeCap;
  };

  const outputSample = (index: number, outGain: number) => {
    const slot = index % ringSize;
    left[index] = ringL[slot] * outGain;
    if (channels > 1) right[index] = ringR[slot] * outGain;
  };

  let lastYield = performance.now();

  for (let i = 0; i < n; i++) {
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const slot = i % ringSize;
    ringL[slot] = left[i];
    ringR[slot] = right[i];

    pushPeak(i, readPeak(i));
    while (dequeIdx[head] < i - lookahead) {
      head = (head + 1) % dequeCap;
    }
    const windowPeak = dequeVal[head] || 0;
    const desired = windowPeak > ceilingLinear ? ceilingLinear / windowPeak : 1;

    if (desired < gain) {
      gain = desired + (gain - desired) * attackCoeff;
    } else {
      gain = desired + (gain - desired) * releaseCoeff;
    }
    if (gain < minGain) minGain = gain;

    const outIndex = i - lookahead;
    if (outIndex >= 0) outputSample(outIndex, gain);

    if ((i & 16383) === 0 && performance.now() - lastYield > 60) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      lastYield = performance.now();
    }
  }

  // Flush the lookahead delay line.
  for (let i = Math.max(0, n - lookahead); i < n; i++) {
    if (i < 0) continue;
    outputSample(i, gain);
  }
  // Any samples shorter than the lookahead must still be emitted.
  if (n <= lookahead) {
    for (let i = 0; i < n; i++) outputSample(i, 1);
  }

  let truePeakDb = await measureTruePeakBuffer(buffer, opts.signal);
  if (truePeakDb > ceilingDb - 0.01) {
    const trimDb = ceilingDb - 0.01 - truePeakDb;
    const trim = dbToGain(trimDb);
    for (const channel of data) {
      for (let i = 0; i < n; i++) channel[i] *= trim;
    }
    minGain *= trim;
    truePeakDb = await measureTruePeakBuffer(buffer, opts.signal);
  }

  const gainReductionDb = minGain > 0 ? Math.max(0, -20 * Math.log10(minGain)) : 0;
  return {
    truePeakDb,
    gainReductionDb,
    appliedCeiling: ceilingDb,
  };
}

export function applyGainInPlace(buffer: AudioBuffer, gainDb: number): void {
  const gain = dbToGain(gainDb);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
}

export function applyGainToData(data: Float32Array[], gainDb: number): void {
  const gain = dbToGain(gainDb);
  for (const channel of data) {
    for (let i = 0; i < channel.length; i++) channel[i] *= gain;
  }
}
