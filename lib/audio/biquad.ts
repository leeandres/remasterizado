export interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

const TWO_PI = Math.PI * 2;

function normalize(
  b0: number,
  b1: number,
  b2: number,
  a0: number,
  a1: number,
  a2: number,
): BiquadCoeffs {
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

export function peakingCoeffs(
  sampleRate: number,
  freq: number,
  q: number,
  gainDb: number,
): BiquadCoeffs {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (TWO_PI * Math.min(freq, sampleRate * 0.49)) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.max(q, 0.01));
  return normalize(
    1 + alpha * A,
    -2 * cos,
    1 - alpha * A,
    1 + alpha / A,
    -2 * cos,
    1 - alpha / A,
  );
}

export function lowShelfCoeffs(
  sampleRate: number,
  freq: number,
  q: number,
  gainDb: number,
): BiquadCoeffs {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (TWO_PI * Math.min(freq, sampleRate * 0.49)) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.max(q, 0.01));
  const beta = 2 * Math.sqrt(A) * alpha;
  return normalize(
    A * (A + 1 - (A - 1) * cos + beta),
    2 * A * (A - 1 - (A + 1) * cos),
    A * (A + 1 - (A - 1) * cos - beta),
    A + 1 + (A - 1) * cos + beta,
    -2 * (A - 1 + (A + 1) * cos),
    A + 1 + (A - 1) * cos - beta,
  );
}

export function highShelfCoeffs(
  sampleRate: number,
  freq: number,
  q: number,
  gainDb: number,
): BiquadCoeffs {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (TWO_PI * Math.min(freq, sampleRate * 0.49)) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.max(q, 0.01));
  const beta = 2 * Math.sqrt(A) * alpha;
  return normalize(
    A * (A + 1 + (A - 1) * cos + beta),
    -2 * A * (A - 1 + (A + 1) * cos),
    A * (A + 1 + (A - 1) * cos - beta),
    A + 1 - (A - 1) * cos + beta,
    2 * (A - 1 - (A + 1) * cos),
    A + 1 - (A - 1) * cos - beta,
  );
}

export function highpassCoeffs(
  sampleRate: number,
  freq: number,
  q = Math.SQRT1_2,
): BiquadCoeffs {
  const w0 = (TWO_PI * Math.min(freq, sampleRate * 0.49)) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.max(q, 0.01));
  return normalize(
    (1 + cos) / 2,
    -(1 + cos),
    (1 + cos) / 2,
    1 + alpha,
    -2 * cos,
    1 - alpha,
  );
}

export function lowpassCoeffs(
  sampleRate: number,
  freq: number,
  q = Math.SQRT1_2,
): BiquadCoeffs {
  const w0 = (TWO_PI * Math.min(freq, sampleRate * 0.49)) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.max(q, 0.01));
  return normalize(
    (1 - cos) / 2,
    1 - cos,
    (1 - cos) / 2,
    1 + alpha,
    -2 * cos,
    1 - alpha,
  );
}

export interface EqBandLike {
  type: "lowshelf" | "peaking" | "highshelf";
  freq: number;
  q: number;
  gain: number;
}

export function bandCoeffs(band: EqBandLike, sampleRate: number): BiquadCoeffs {
  if (band.type === "lowshelf") {
    return lowShelfCoeffs(sampleRate, band.freq, band.q, band.gain);
  }
  if (band.type === "highshelf") {
    return highShelfCoeffs(sampleRate, band.freq, band.q, band.gain);
  }
  return peakingCoeffs(sampleRate, band.freq, band.q, band.gain);
}

export function biquadMagnitudeDb(coeffs: BiquadCoeffs, freq: number, sampleRate: number): number {
  const w = (TWO_PI * freq) / sampleRate;
  const cos1 = Math.cos(w);
  const sin1 = Math.sin(w);
  const cos2 = Math.cos(2 * w);
  const sin2 = Math.sin(2 * w);

  const numRe = coeffs.b0 + coeffs.b1 * cos1 + coeffs.b2 * cos2;
  const numIm = -(coeffs.b1 * sin1 + coeffs.b2 * sin2);
  const denRe = 1 + coeffs.a1 * cos1 + coeffs.a2 * cos2;
  const denIm = -(coeffs.a1 * sin1 + coeffs.a2 * sin2);

  const num = Math.hypot(numRe, numIm);
  const den = Math.max(Math.hypot(denRe, denIm), 1e-12);
  return 20 * Math.log10(Math.max(num / den, 1e-12));
}

export function eqResponseDb(
  bands: EqBandLike[],
  freq: number,
  sampleRate: number,
  enabled = true,
): number {
  if (!enabled) return 0;
  let total = 0;
  for (const band of bands) {
    if (Math.abs(band.gain) < 0.001) continue;
    total += biquadMagnitudeDb(bandCoeffs(band, sampleRate), freq, sampleRate);
  }
  return total;
}

/** Standard BS.1770-4 K-weighting at 48 kHz (exact published coefficients). */
const K_SHELF_48: BiquadCoeffs = {
  b0: 1.53512485958697,
  b1: -2.69169618940638,
  b2: 1.19839281085285,
  a1: -1.69065929318241,
  a2: 0.73248077421585,
};

const K_HIGHPASS_48: BiquadCoeffs = {
  b0: 1,
  b1: -2,
  b2: 1,
  a1: -1.99004745483398,
  a2: 0.99007225036621,
};

export function kWeightingCoeffs(sampleRate: number): {
  shelf: BiquadCoeffs;
  highpass: BiquadCoeffs;
} {
  if (Math.abs(sampleRate - 48000) < 0.5) {
    return { shelf: K_SHELF_48, highpass: K_HIGHPASS_48 };
  }
  return {
    shelf: highShelfCoeffs(sampleRate, 1681.974450955533, 0.7071752369554196, 3.999843853973347),
    highpass: highpassCoeffs(sampleRate, 38.13547087602444, 0.5003270373238773),
  };
}

export class BiquadState {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(public coeffs: BiquadCoeffs) {}

  reset() {
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  process(x: number): number {
    const c = this.coeffs;
    const y = c.b0 * x + c.b1 * this.x1 + c.b2 * this.x2 - c.a1 * this.y1 - c.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}
