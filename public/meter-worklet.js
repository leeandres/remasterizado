/* MasterAI Pro — EBU R128 live meter worklet.
   Computes K-weighted energy, true-peak estimate and stereo correlation
   in 100 ms blocks, then passes audio through untouched. */

class Biquad {
  constructor(b0, b1, b2, a1, a2) {
    this.b0 = b0;
    this.b1 = b1;
    this.b2 = b2;
    this.a1 = a1;
    this.a2 = a2;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }
  process(x) {
    const y =
      this.b0 * x +
      this.b1 * this.x1 +
      this.b2 * this.x2 -
      this.a1 * this.y1 -
      this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
  reset() {
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }
}

function normalize(b0, b1, b2, a0, a1, a2) {
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

function highShelf(sr, freq, q, gainDb) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * freq) / sr;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
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

function highpass(sr, freq, q) {
  const w0 = (2 * Math.PI * freq) / sr;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  return normalize((1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
}

function cubic(x0, x1, x2, x3, t) {
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

class MasterAIMeter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.blockFrames = Math.max(1, Math.round(sampleRate * 0.1));
    const shelf = highShelf(sampleRate, 1681.974450955533, 0.7071752369554196, 3.999843853973347);
    const hp = highpass(sampleRate, 38.13547087602444, 0.5003270373238773);
    this.shelfL = new Biquad(...shelf);
    this.shelfR = new Biquad(...shelf);
    this.hpL = new Biquad(...hp);
    this.hpR = new Biquad(...hp);
    this.resetSession();
    this.port.onmessage = (event) => {
      if (event.data === "reset") this.resetSession();
    };
  }

  resetSession() {
    if (this.shelfL) {
      this.shelfL.reset();
      this.shelfR.reset();
      this.hpL.reset();
      this.hpR.reset();
    }
    this.hopCount = 0;
    this.hopEnergy = 0;
    this.blockPeak = 0;
    this.sumLR = 0;
    this.sumL2 = 0;
    this.sumR2 = 0;
    this.prevL = 0;
    this.prevR = 0;
  }

  peakAround(prev, current, next, next2) {
    let peak = Math.max(Math.abs(current), Math.abs(next));
    peak = Math.max(peak, Math.abs(cubic(prev, current, next, next2, 0.25)));
    peak = Math.max(peak, Math.abs(cubic(prev, current, next, next2, 0.5)));
    peak = Math.max(peak, Math.abs(cubic(prev, current, next, next2, 0.75)));
    return peak;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output.length) return true;

    const inputChannels = input ? input.length : 0;
    const frames = output[0].length;

    if (!inputChannels) {
      for (let c = 0; c < output.length; c++) output[c].fill(0);
      return true;
    }

    const left = input[0];
    const right = inputChannels > 1 ? input[1] : input[0];

    for (let c = 0; c < output.length; c++) {
      const source = input[Math.min(c, inputChannels - 1)];
      output[c].set(source);
    }

    for (let i = 0; i < frames; i++) {
      const l = left[i];
      const r = right[i];
      const nextL = i + 1 < frames ? left[i + 1] : l;
      const next2L = i + 2 < frames ? left[i + 2] : nextL;
      const nextR = i + 1 < frames ? right[i + 1] : r;
      const next2R = i + 2 < frames ? right[i + 2] : nextR;

      const peak = Math.max(
        this.peakAround(this.prevL, l, nextL, next2L),
        this.peakAround(this.prevR, r, nextR, next2R),
      );
      if (peak > this.blockPeak) this.blockPeak = peak;

      const kl = this.hpL.process(this.shelfL.process(l));
      const kr = this.hpR.process(this.shelfR.process(r));
      this.hopEnergy += kl * kl + kr * kr;
      this.hopCount++;

      this.sumLR += l * r;
      this.sumL2 += l * l;
      this.sumR2 += r * r;

      this.prevL = l;
      this.prevR = r;

      if (this.hopCount >= this.blockFrames) {
        const energy = this.hopEnergy / (this.hopCount * 2);
        const denom = Math.sqrt(Math.max(this.sumL2 * this.sumR2, 1e-20));
        const corr = inputChannels > 1 ? Math.max(-1, Math.min(1, this.sumLR / denom)) : 1;
        this.port.postMessage({
          type: "meter",
          energy,
          peak: this.blockPeak,
          corr,
        });
        this.hopCount = 0;
        this.hopEnergy = 0;
        this.blockPeak = 0;
        this.sumLR = 0;
        this.sumL2 = 0;
        this.sumR2 = 0;
      }
    }
    return true;
  }
}

registerProcessor("masterai-meter", MasterAIMeter);
