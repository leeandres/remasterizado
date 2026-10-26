export type GenreId = "pop" | "hiphop" | "rock" | "edm" | "acoustic";

export type PlatformId = "spotify" | "apple" | "youtube" | "soundcloud";

export type EqBandType = "lowshelf" | "peaking" | "highshelf";

export interface EqBand {
  id: string;
  label: string;
  type: EqBandType;
  freq: number;
  gain: number;
  q: number;
}

export interface MasteringSettings {
  inputGain: number;
  filter: {
    enabled: boolean;
    highpass: number;
    lowpass: number;
  };
  eq: {
    enabled: boolean;
    bands: EqBand[];
  };
  compressor: {
    enabled: boolean;
    multiband: boolean;
    threshold: number;
    ratio: number;
    attackMs: number;
    releaseMs: number;
    makeup: number;
    knee: number;
  };
  saturation: {
    enabled: boolean;
    drive: number;
    mix: number;
    tone: number;
  };
  limiter: {
    enabled: boolean;
    ceiling: number;
    releaseMs: number;
  };
  outputGain: number;
  normalize: boolean;
  targetLUFS: number;
}

export interface SpectralBands {
  sub: number;
  low: number;
  lowMid: number;
  mid: number;
  highMid: number;
  air: number;
}

export interface AnalysisStats {
  duration: number;
  sampleRate: number;
  channels: number;
  lufsIntegrated: number;
  lufsShortTermMax: number;
  truePeakDb: number;
  lra: number;
  crestDb: number;
  correlation: number;
  spectral: SpectralBands;
  dcOffset: number;
}

export interface LiveMeters {
  momentary: number;
  shortTerm: number;
  integrated: number;
  truePeakDb: number;
  correlation: number;
  clipping: boolean;
}

export interface LoadedTrack {
  id: string;
  name: string;
  size: number;
  mime: string;
  extension: string;
  duration: number;
  sampleRate: number;
  channels: number;
  bitDepth: number | null;
  buffer: AudioBuffer;
  peaks: Array<Float32Array>;
  stats: AnalysisStats;
}

export interface PlatformTarget {
  id: PlatformId;
  name: string;
  shortName: string;
  targetLUFS: number;
  ceiling: number;
  color: string;
  description: string;
}

export interface GenreProfile {
  id: GenreId;
  name: string;
  subtitle: string;
  tagline: string;
  accent: string;
  icon: string;
}

export interface MasteringResult {
  buffer: AudioBuffer;
  stats: AnalysisStats;
  before: AnalysisStats;
  gainDb: number;
  format: "wav" | "mp3";
  blob: Blob;
  fileName: string;
  bytes: number;
  renderSeconds: number;
}

export interface RenderProgress {
  phase:
    | "preparing"
    | "rendering"
    | "measuring"
    | "normalizing"
    | "limiting"
    | "encoding"
    | "saving"
    | "done";
  progress: number;
  detail: string;
}

export interface HistoryEntry {
  id: string;
  name: string;
  fileName: string;
  createdAt: number;
  genre: GenreId;
  platform: PlatformId;
  format: "wav" | "mp3";
  bytes: number;
  duration: number;
  settings: MasteringSettings;
  sourceStats: AnalysisStats;
  outputStats: AnalysisStats;
  blob: Blob;
  range: { start: number; end: number } | null;
}

export interface ExportOptions {
  format: "wav" | "mp3";
  normalize: boolean;
  useSelection: boolean;
  targetLUFS: number;
}

export type MobileView = "studio" | "rack" | "library";
