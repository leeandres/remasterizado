import type { LiveMeters, MasteringSettings } from "../types";
import { MasteringChain } from "./chain";
import { clamp } from "../utils";

interface MeterMessage {
  type: "meter";
  energy: number;
  peak: number;
  corr: number;
}

function loudnessFromEnergy(energy: number): number {
  if (!Number.isFinite(energy) || energy <= 1e-12) return -70;
  return Math.max(-70, -0.691 + 10 * Math.log10(energy));
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

function integratedFromEnergies(energies: number[]): number {
  if (energies.length < 4) return -70;
  const windows: number[] = [];
  let rolling = energies[0] + energies[1] + energies[2] + energies[3];
  windows.push(rolling / 4);
  for (let i = 4; i < energies.length; i++) {
    rolling += energies[i] - energies[i - 4];
    windows.push(rolling / 4);
  }
  const abs = windows.filter((e) => loudnessFromEnergy(e) > -70);
  if (!abs.length) return -70;
  const absMean = mean(abs);
  const relative = loudnessFromEnergy(absMean) - 10;
  const gated = abs.filter((e) => loudnessFromEnergy(e) > relative);
  return loudnessFromEnergy(mean(gated));
}

export class PreviewEngine {
  private ctx: AudioContext | null = null;
  private chain: MasteringChain | null = null;
  private volumeGain: GainNode | null = null;
  private meter: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserL: AnalyserNode | null = null;
  private analyserR: AnalyserNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private silent: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private settings: MasteringSettings;
  private initPromise: Promise<void> | null = null;
  private startCtxTime = 0;
  private startOffset = 0;
  private offset = 0;
  private playing = false;
  private playRequest = 0;
  private bypass = false;
  private loop = false;
  private region: { start: number; end: number } | null = null;
  private volume = 1;
  private workletReady = false;

  private energies: number[] = [];
  private peak = 0;
  private correlation = 0;
  private meterSinceReset = 0;

  onEnded: (() => void) | null = null;

  constructor(settings: MasteringSettings) {
    this.settings = settings;
  }

  get isPlaying() {
    return this.playing;
  }

  get duration() {
    return this.buffer?.duration ?? 0;
  }

  get sampleRate() {
    return this.ctx?.sampleRate ?? this.buffer?.sampleRate ?? 48000;
  }

  get hasBuffer() {
    return this.buffer !== null;
  }

  async init(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        try {
          await this.ctx.resume();
        } catch {
          // resume requires a gesture; play() will retry.
        }
      }
      return;
    }
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const ctx = new AudioContext({ latencyHint: "interactive" });
      this.ctx = ctx;
      this.chain = new MasteringChain(ctx, this.settings, { includeLimiter: true });
      this.chain.setBypass(this.bypass, true);

      this.volumeGain = ctx.createGain();
      this.volumeGain.gain.value = this.volume;

      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0.78;
      this.analyser.minDecibels = -100;
      this.analyser.maxDecibels = -5;

      this.splitter = ctx.createChannelSplitter(2);
      this.analyserL = ctx.createAnalyser();
      this.analyserR = ctx.createAnalyser();
      for (const node of [this.analyserL, this.analyserR]) {
        node.fftSize = 2048;
        node.smoothingTimeConstant = 0;
      }

      this.silent = ctx.createGain();
      this.silent.gain.value = 0;

      try {
        await ctx.audioWorklet.addModule("/meter-worklet.js");
        const meter = new AudioWorkletNode(ctx, "masterai-meter", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
          channelCount: 2,
          channelCountMode: "explicit",
        });
        this.meter = meter;
        this.workletReady = true;
        meter.port.onmessage = (event: MessageEvent<MeterMessage>) => {
          if (event.data?.type === "meter") this.handleMeter(event.data);
        };
        this.chain.output.connect(meter);
        meter.connect(this.volumeGain);
      } catch {
        this.workletReady = false;
        this.chain.output.connect(this.volumeGain);
      }

      this.volumeGain.connect(ctx.destination);

      this.chain.output.connect(this.analyser);
      this.analyser.connect(this.silent);
      this.chain.output.connect(this.splitter);
      this.splitter.connect(this.analyserL, 0);
      this.splitter.connect(this.analyserR, 1);
      this.analyserL.connect(this.silent);
      this.analyserR.connect(this.silent);
      this.silent.connect(ctx.destination);
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private handleMeter(message: MeterMessage) {
    this.energies.push(message.energy);
    if (this.energies.length > 36000) this.energies.shift();
    if (message.peak > this.peak) this.peak = message.peak;
    this.correlation = this.correlation * 0.55 + message.corr * 0.45;
    this.meterSinceReset++;
  }

  getLiveMeters(): LiveMeters {
    const recent = this.energies.slice(-30);
    const momentary = loudnessFromEnergy(mean(this.energies.slice(-4)));
    const shortTerm = loudnessFromEnergy(mean(recent));
    const integrated = integratedFromEnergies(this.energies);
    const truePeakDb = this.peak > 1e-9 ? 20 * Math.log10(this.peak) : -96;
    return {
      momentary,
      shortTerm,
      integrated,
      truePeakDb,
      correlation: this.correlation,
      clipping: truePeakDb > -1,
    };
  }

  getPeakDb(): number {
    return this.peak > 1e-9 ? 20 * Math.log10(this.peak) : -96;
  }

  resetMeters() {
    this.energies = [];
    this.peak = 0;
    this.correlation = 0;
    this.meterSinceReset = 0;
    if (this.meter) this.meter.port.postMessage("reset");
  }

  async load(buffer: AudioBuffer): Promise<void> {
    this.playRequest += 1;
    this.stopSource();
    this.buffer = buffer;
    this.offset = 0;
    this.playing = false;
    this.resetMeters();
    await this.init();
  }

  unload() {
    this.pause();
    this.stopSource();
    this.buffer = null;
    this.offset = 0;
    this.playing = false;
    this.region = null;
    this.resetMeters();
  }

  async play(from?: number) {
    if (!this.buffer) return;
    const request = ++this.playRequest;
    await this.init();
    if (request !== this.playRequest || !this.ctx) return;
    try {
      await this.ctx.resume();
    } catch {
      // Ignore, the next gesture will retry.
    }
    if (request !== this.playRequest) return;

    if (this.playing) {
      if (typeof from === "number") this.seek(from);
      return;
    }

    const baseOffset =
      typeof from === "number"
        ? from
        : this.offset >= this.duration - 0.001
          ? 0
          : this.offset;
    const start = clamp(baseOffset, 0, Math.max(0, this.duration - 0.001));
    this.startSource(start);
  }

  private loopBounds(): { start: number; end: number } | null {
    if (!this.loop || !this.buffer) return null;
    if (this.region && this.region.end - this.region.start > 0.05) {
      return {
        start: clamp(this.region.start, 0, this.duration),
        end: clamp(this.region.end, 0, this.duration),
      };
    }
    return { start: 0, end: this.duration };
  }

  private startSource(offset: number) {
    if (!this.ctx || !this.chain || !this.buffer) return;
    this.stopSource();
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.chain.input);
    const bounds = this.loopBounds();
    if (bounds && bounds.end > bounds.start) {
      source.loop = true;
      source.loopStart = bounds.start;
      source.loopEnd = bounds.end;
    }
    source.start(0, offset);
    this.source = source;
    this.startCtxTime = this.ctx.currentTime;
    this.startOffset = offset;
    this.offset = offset;
    this.playing = true;

    source.onended = () => {
      if (this.source !== source) return;
      this.source = null;
      this.playing = false;
      this.offset = this.duration;
      this.onEnded?.();
    };
  }

  private stopSource() {
    const source = this.source;
    this.source = null;
    if (!source) return;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // already stopped
    }
    try {
      source.disconnect();
    } catch {
      // already disconnected
    }
  }

  pause() {
    this.playRequest += 1;
    if (!this.playing) return;
    this.offset = this.getCurrentTime();
    this.stopSource();
    this.playing = false;
  }

  stop() {
    this.playRequest += 1;
    const wasPlaying = this.playing;
    this.stopSource();
    this.playing = false;
    this.offset = 0;
    if (wasPlaying) this.onEnded?.();
  }

  toggle() {
    if (this.playing) {
      this.pause();
    } else {
      void this.play();
    }
  }

  seek(time: number) {
    const target = clamp(time, 0, this.duration);
    this.offset = target;
    if (this.playing) {
      this.startSource(target);
    }
  }

  getCurrentTime(): number {
    if (!this.ctx || !this.playing) return this.offset;
    let t = this.startOffset + (this.ctx.currentTime - this.startCtxTime);
    const bounds = this.loopBounds();
    if (bounds && bounds.end > bounds.start && t > bounds.end) {
      t = bounds.start + ((t - bounds.start) % (bounds.end - bounds.start));
    }
    return clamp(t, 0, this.duration);
  }

  setRegion(region: { start: number; end: number } | null) {
    this.region = region;
    if (this.source) {
      const bounds = this.loopBounds();
      if (bounds) {
        this.source.loop = true;
        this.source.loopStart = bounds.start;
        this.source.loopEnd = bounds.end;
      } else {
        this.source.loop = false;
      }
    }
  }

  setLoop(loop: boolean) {
    this.loop = loop;
    if (this.source) {
      const bounds = this.loopBounds();
      if (bounds) {
        this.source.loop = true;
        this.source.loopStart = bounds.start;
        this.source.loopEnd = bounds.end;
      } else {
        this.source.loop = false;
      }
    }
  }

  setBypass(bypass: boolean) {
    this.bypass = bypass;
    this.chain?.setBypass(bypass);
  }

  setVolume(value: number) {
    this.volume = clamp(value, 0, 1.5);
    if (this.volumeGain && this.ctx) {
      this.volumeGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  updateSettings(settings: MasteringSettings) {
    this.settings = settings;
    this.chain?.updateSettings(settings);
  }

  getGainReduction(): number {
    return this.chain?.getGainReduction() ?? 0;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  getAnalyserL(): AnalyserNode | null {
    return this.analyserL;
  }

  getAnalyserR(): AnalyserNode | null {
    return this.analyserR;
  }

  canMeter(): boolean {
    return this.workletReady;
  }

  async dispose() {
    this.stopSource();
    this.playing = false;
    this.buffer = null;
    this.chain?.dispose();
    this.chain = null;
    this.meter?.disconnect();
    this.meter = null;
    this.analyser?.disconnect();
    this.analyser = null;
    this.analyserL?.disconnect();
    this.analyserL = null;
    this.analyserR?.disconnect();
    this.analyserR = null;
    this.splitter?.disconnect();
    this.splitter = null;
    this.silent?.disconnect();
    this.silent = null;
    this.volumeGain?.disconnect();
    this.volumeGain = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) {
      try {
        await ctx.close();
      } catch {
        // ignore
      }
    }
  }
}
