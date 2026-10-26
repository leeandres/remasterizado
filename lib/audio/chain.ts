import type { MasteringSettings } from "../types";
import { clamp, dbToGain } from "../utils";

export interface ChainOptions {
  includeLimiter?: boolean;
}

function makeSaturationCurve(drive: number): Float32Array<ArrayBuffer> {
  const length = 4096;
  const curve = new Float32Array(new ArrayBuffer(length * Float32Array.BYTES_PER_ELEMENT));
  const amount = 1 + (clamp(drive, 0, 100) / 100) * 9;
  const norm = Math.tanh(amount);
  for (let i = 0; i < length; i++) {
    const x = (i * 2) / (length - 1) - 1;
    curve[i] = Math.tanh(amount * x) / norm;
  }
  return curve;
}

export class MasteringChain {
  readonly input: GainNode;
  readonly output: GainNode;

  private ctx: BaseAudioContext;
  private immediate: boolean;
  private settings: MasteringSettings;
  private includeLimiter: boolean;

  private inputGain: GainNode;
  private hp: BiquadFilterNode;
  private lp: BiquadFilterNode;
  private eqNodes: BiquadFilterNode[];
  private dynIn: GainNode;
  private dynMix: GainNode;
  private dynMakeup: GainNode;
  private singleComp: DynamicsCompressorNode;
  private singleGain: GainNode;
  private lowFilter: BiquadFilterNode;
  private lowComp: DynamicsCompressorNode;
  private lowGain: GainNode;
  private midHigh: BiquadFilterNode;
  private midLow: BiquadFilterNode;
  private midComp: DynamicsCompressorNode;
  private midGain: GainNode;
  private highFilter: BiquadFilterNode;
  private highComp: DynamicsCompressorNode;
  private highGain: GainNode;
  private satDry: GainNode;
  private satDrive: GainNode;
  private shaper: WaveShaperNode;
  private satTone: BiquadFilterNode;
  private satWet: GainNode;
  private satSum: GainNode;
  private outputTrim: GainNode;
  private limiter: DynamicsCompressorNode | null = null;
  private wet: GainNode;
  private dry: GainNode;
  private nodes: AudioNode[] = [];

  constructor(ctx: BaseAudioContext, settings: MasteringSettings, options: ChainOptions = {}) {
    this.ctx = ctx;
    this.settings = settings;
    this.includeLimiter = options.includeLimiter ?? true;
    this.immediate =
      typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext;

    this.input = this.track(ctx.createGain());
    this.output = this.track(ctx.createGain());
    this.inputGain = this.track(ctx.createGain());
    this.hp = this.track(ctx.createBiquadFilter());
    this.hp.type = "highpass";
    this.lp = this.track(ctx.createBiquadFilter());
    this.lp.type = "lowpass";

    this.eqNodes = settings.eq.bands.map((band) => {
      const node = this.track(ctx.createBiquadFilter());
      node.type = band.type;
      return node;
    });

    this.dynIn = this.track(ctx.createGain());
    this.dynMix = this.track(ctx.createGain());
    this.dynMakeup = this.track(ctx.createGain());

    this.singleComp = this.track(ctx.createDynamicsCompressor());
    this.singleGain = this.track(ctx.createGain());

    this.lowFilter = this.track(ctx.createBiquadFilter());
    this.lowFilter.type = "lowpass";
    this.lowComp = this.track(ctx.createDynamicsCompressor());
    this.lowGain = this.track(ctx.createGain());

    this.midHigh = this.track(ctx.createBiquadFilter());
    this.midHigh.type = "highpass";
    this.midLow = this.track(ctx.createBiquadFilter());
    this.midLow.type = "lowpass";
    this.midComp = this.track(ctx.createDynamicsCompressor());
    this.midGain = this.track(ctx.createGain());

    this.highFilter = this.track(ctx.createBiquadFilter());
    this.highFilter.type = "highpass";
    this.highComp = this.track(ctx.createDynamicsCompressor());
    this.highGain = this.track(ctx.createGain());

    this.satDry = this.track(ctx.createGain());
    this.satDrive = this.track(ctx.createGain());
    this.shaper = this.track(ctx.createWaveShaper());
    this.shaper.oversample = "4x";
    this.satTone = this.track(ctx.createBiquadFilter());
    this.satTone.type = "lowpass";
    this.satWet = this.track(ctx.createGain());
    this.satSum = this.track(ctx.createGain());
    this.outputTrim = this.track(ctx.createGain());

    if (this.includeLimiter) {
      this.limiter = this.track(ctx.createDynamicsCompressor());
    }

    this.wet = this.track(ctx.createGain());
    this.dry = this.track(ctx.createGain());

    this.build();
    this.updateSettings(settings, true);
    this.setBypass(false, true);
  }

  private track<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  private build() {
    const ctx = this.ctx;
    this.input.connect(this.dry);
    this.dry.connect(this.output);

    this.input.connect(this.inputGain);
    this.inputGain.connect(this.hp);
    this.hp.connect(this.lp);
    this.lp.connect(this.eqNodes[0]);
    for (let i = 0; i < this.eqNodes.length - 1; i++) {
      this.eqNodes[i].connect(this.eqNodes[i + 1]);
    }
    this.eqNodes[this.eqNodes.length - 1].connect(this.dynIn);

    this.dynIn.connect(this.singleComp);
    this.singleComp.connect(this.singleGain);
    this.singleGain.connect(this.dynMix);

    this.dynIn.connect(this.lowFilter);
    this.lowFilter.connect(this.lowComp);
    this.lowComp.connect(this.lowGain);
    this.lowGain.connect(this.dynMix);

    this.dynIn.connect(this.midHigh);
    this.midHigh.connect(this.midLow);
    this.midLow.connect(this.midComp);
    this.midComp.connect(this.midGain);
    this.midGain.connect(this.dynMix);

    this.dynIn.connect(this.highFilter);
    this.highFilter.connect(this.highComp);
    this.highComp.connect(this.highGain);
    this.highGain.connect(this.dynMix);

    this.dynMix.connect(this.dynMakeup);

    this.dynMakeup.connect(this.satDry);
    this.satDry.connect(this.satSum);
    this.dynMakeup.connect(this.satDrive);
    this.satDrive.connect(this.shaper);
    this.shaper.connect(this.satTone);
    this.satTone.connect(this.satWet);
    this.satWet.connect(this.satSum);

    this.satSum.connect(this.outputTrim);
    let last: AudioNode = this.outputTrim;
    if (this.limiter) {
      last.connect(this.limiter);
      last = this.limiter;
    }
    last.connect(this.wet);
    this.wet.connect(this.output);

    // Crossovers.
    this.lowFilter.frequency.value = 220;
    this.lowFilter.Q.value = Math.SQRT1_2;
    this.midHigh.frequency.value = 220;
    this.midHigh.Q.value = Math.SQRT1_2;
    this.midLow.frequency.value = 3500;
    this.midLow.Q.value = Math.SQRT1_2;
    this.highFilter.frequency.value = 3500;
    this.highFilter.Q.value = Math.SQRT1_2;

    if (this.immediate) {
      this.dry.gain.value = 0;
      this.wet.gain.value = 1;
    } else {
      this.dry.gain.value = 0;
      this.wet.gain.value = 1;
    }
    void ctx;
  }

  private setParam(
    param: AudioParam,
    value: number,
    ramp = 0.015,
    immediate = this.immediate,
  ) {
    const safe = Number.isFinite(value) ? value : 0;
    const now = this.ctx.currentTime;
    try {
      param.cancelScheduledValues(now);
      if (immediate) {
        param.setValueAtTime(safe, now);
      } else {
        param.setTargetAtTime(safe, now, Math.max(0.001, ramp));
      }
    } catch {
      param.value = safe;
    }
  }

  updateSettings(next: MasteringSettings, force = false) {
    const prev = this.settings;
    this.settings = next;
    const nyquist = this.ctx.sampleRate * 0.45;

    this.setParam(this.inputGain.gain, dbToGain(next.inputGain));

    const hpFreq = next.filter.enabled ? clamp(next.filter.highpass, 10, 1000) : 8;
    const lpFreq = next.filter.enabled ? clamp(next.filter.lowpass, 2000, nyquist) : nyquist;
    this.setParam(this.hp.frequency, hpFreq);
    this.setParam(this.lp.frequency, lpFreq);
    this.hp.Q.value = Math.SQRT1_2;
    this.lp.Q.value = Math.SQRT1_2;

    next.eq.bands.forEach((band, index) => {
      const node = this.eqNodes[index];
      if (!node) return;
      node.type = band.type;
      this.setParam(node.frequency, clamp(band.freq, 20, nyquist));
      this.setParam(node.Q, clamp(band.q, 0.2, 12));
      this.setParam(node.gain, next.eq.enabled ? clamp(band.gain, -18, 18) : 0);
    });

    const c = next.compressor;
    const comps = [this.singleComp, this.lowComp, this.midComp, this.highComp];
    const threshold = c.enabled ? clamp(c.threshold, -60, 0) : 0;
    const ratio = c.enabled ? clamp(c.ratio, 1, 20) : 1;
    const attack = c.enabled ? clamp(c.attackMs / 1000, 0.001, 1) : 0.001;
    const release = c.enabled ? clamp(c.releaseMs / 1000, 0.01, 1.5) : 0.1;
    const knee = c.enabled ? clamp(c.knee, 0, 40) : 0;
    for (const comp of comps) {
      this.setParam(comp.threshold, threshold);
      this.setParam(comp.ratio, ratio);
      this.setParam(comp.attack, attack);
      this.setParam(comp.release, release);
      this.setParam(comp.knee, knee);
    }

    const multiband = c.enabled && c.multiband;
    this.setParam(this.singleGain.gain, multiband ? 0 : 1, 0.02, force || this.immediate);
    this.setParam(this.lowGain.gain, multiband ? 1 : 0, 0.02, force || this.immediate);
    this.setParam(this.midGain.gain, multiband ? 1 : 0, 0.02, force || this.immediate);
    this.setParam(this.highGain.gain, multiband ? 1 : 0, 0.02, force || this.immediate);
    this.setParam(
      this.dynMakeup.gain,
      c.enabled ? dbToGain(clamp(c.makeup, -12, 18)) : 1,
    );

    const sat = next.saturation;
    const mix = sat.enabled ? clamp(sat.mix, 0, 100) / 100 : 0;
    const driveAmount = clamp(sat.drive, 0, 100);
    if (!force && sat.enabled && (prev.saturation.drive !== sat.drive || prev.saturation.enabled !== sat.enabled)) {
      this.shaper.curve = makeSaturationCurve(driveAmount);
    } else if (force) {
      this.shaper.curve = makeSaturationCurve(driveAmount);
    }
    this.setParam(this.satDrive.gain, 1 + (driveAmount / 100) * 6);
    this.setParam(this.satDry.gain, 1 - mix);
    this.setParam(this.satWet.gain, mix * (1 / (1 + (driveAmount / 100) * 2.2)));
    this.setParam(this.satTone.frequency, clamp(sat.tone, 3000, nyquist));

    this.setParam(this.outputTrim.gain, dbToGain(next.outputGain));

    if (this.limiter) {
      const lim = next.limiter;
      const enabled = lim.enabled;
      this.setParam(this.limiter.threshold, enabled ? clamp(lim.ceiling, -12, -0.05) : 0);
      this.setParam(this.limiter.ratio, enabled ? 20 : 1);
      this.setParam(this.limiter.attack, 0.001);
      this.setParam(this.limiter.release, clamp(lim.releaseMs / 1000, 0.01, 1));
      this.setParam(this.limiter.knee, 0);
    }
  }

  setBypass(bypass: boolean, immediate = this.immediate) {
    this.setParam(this.dry.gain, bypass ? 1 : 0, 0.03, immediate);
    this.setParam(this.wet.gain, bypass ? 0 : 1, 0.03, immediate);
  }

  getGainReduction(): number {
    if (!this.settings.compressor.enabled) return 0;
    const comps = this.settings.compressor.multiband
      ? [this.lowComp, this.midComp, this.highComp]
      : [this.singleComp];
    let max = 0;
    for (const comp of comps) {
      const reduction = comp.reduction ?? 0;
      if (reduction < max) max = reduction;
    }
    return Math.abs(max);
  }

  getSettings(): MasteringSettings {
    return this.settings;
  }

  dispose() {
    try {
      this.input.disconnect();
      this.output.disconnect();
      for (const node of this.nodes) {
        try {
          node.disconnect();
        } catch {
          // already disconnected
        }
      }
    } catch {
      // ignore teardown races
    }
    this.nodes = [];
  }
}
