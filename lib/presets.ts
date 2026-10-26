import type {
  EqBand,
  GenreId,
  GenreProfile,
  MasteringSettings,
  PlatformId,
  PlatformTarget,
} from "./types";

function eqBands(gains: [number, number, number, number, number]): EqBand[] {
  return [
    { id: "low", label: "Bajos", type: "lowshelf", freq: 80, gain: gains[0], q: 0.7 },
    { id: "lowmid", label: "Golpe", type: "peaking", freq: 250, gain: gains[1], q: 1.0 },
    { id: "mid", label: "Cuerpo", type: "peaking", freq: 1000, gain: gains[2], q: 0.9 },
    { id: "presence", label: "Presencia", type: "peaking", freq: 3500, gain: gains[3], q: 1.1 },
    { id: "air", label: "Aire", type: "highshelf", freq: 12000, gain: gains[4], q: 0.7 },
  ];
}

export const PLATFORMS: Record<PlatformId, PlatformTarget> = {
  spotify: {
    id: "spotify",
    name: "Spotify",
    shortName: "Spotify",
    targetLUFS: -14,
    ceiling: -1,
    color: "#1ed760",
    description: "Estándar de streaming · -14 LUFS",
  },
  apple: {
    id: "apple",
    name: "Apple Music",
    shortName: "Apple",
    targetLUFS: -14,
    ceiling: -1,
    color: "#fa5c8a",
    description: "Sound Check · -14 LUFS",
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    shortName: "YouTube",
    targetLUFS: -13,
    ceiling: -1,
    color: "#ff4d4d",
    description: "Normalización de vídeo · -13 LUFS",
  },
  soundcloud: {
    id: "soundcloud",
    name: "SoundCloud",
    shortName: "SoundCloud",
    targetLUFS: -9,
    ceiling: -1,
    color: "#ff8a3d",
    description: "Reproducción más alta · -9 LUFS",
  },
};

export const PLATFORM_LIST: PlatformTarget[] = [
  PLATFORMS.spotify,
  PLATFORMS.apple,
  PLATFORMS.youtube,
  PLATFORMS.soundcloud,
];

export const GENRES: GenreProfile[] = [
  {
    id: "pop",
    name: "Pop moderno",
    subtitle: "Brillo y pegada",
    tagline: "Pulido radiofónico con presencia vocal y graves controlados.",
    accent: "#d8ff57",
    icon: "sparkles",
  },
  {
    id: "hiphop",
    name: "Hip-Hop / Trap",
    subtitle: "Sub y punch",
    tagline: "Bajos contundentes, medios limpios y dinámica ajustada.",
    accent: "#ffb45e",
    icon: "flame",
  },
  {
    id: "rock",
    name: "Rock / Metal",
    subtitle: "Ataque y cuerpo",
    tagline: "Guitarras presentes, transientes firmes y densidad controlada.",
    accent: "#fb7185",
    icon: "guitar",
  },
  {
    id: "edm",
    name: "Electrónica / EDM",
    subtitle: "Energía y aire",
    tagline: "Graves monolíticos, apertura estéreo y brillo de club.",
    accent: "#5eead4",
    icon: "disc",
  },
  {
    id: "acoustic",
    name: "Acústico / Balada",
    subtitle: "Natural y dinámico",
    tagline: "Transparencia, microdinámica y calidez orgánica.",
    accent: "#a78bfa",
    icon: "feather",
  },
];

export function getGenre(id: GenreId): GenreProfile {
  return GENRES.find((g) => g.id === id) ?? GENRES[0];
}

export function cloneSettings(settings: MasteringSettings): MasteringSettings {
  return {
    ...settings,
    filter: { ...settings.filter },
    eq: { ...settings.eq, bands: settings.eq.bands.map((b) => ({ ...b })) },
    compressor: { ...settings.compressor },
    saturation: { ...settings.saturation },
    limiter: { ...settings.limiter },
  };
}

export function buildGenreSettings(
  id: GenreId,
  targetLUFS = -14,
): MasteringSettings {
  const base: MasteringSettings = {
    inputGain: 0,
    filter: { enabled: true, highpass: 30, lowpass: 18000 },
    eq: {
      enabled: true,
      bands: eqBands([0, 0, 0, 0, 0]),
    },
    compressor: {
      enabled: true,
      multiband: true,
      threshold: -22,
      ratio: 2.5,
      attackMs: 20,
      releaseMs: 180,
      makeup: 2,
      knee: 6,
    },
    saturation: {
      enabled: true,
      drive: 18,
      mix: 18,
      tone: 16000,
    },
    limiter: {
      enabled: true,
      ceiling: -1,
      releaseMs: 80,
    },
    outputGain: 0,
    normalize: true,
    targetLUFS,
  };

  switch (id) {
    case "pop":
      base.eq.bands = eqBands([1.0, -1.2, 0.5, 1.4, 2.0]);
      base.filter.highpass = 30;
      base.compressor = {
        ...base.compressor,
        threshold: -22,
        ratio: 2.4,
        attackMs: 20,
        releaseMs: 180,
        makeup: 2.2,
      };
      base.saturation = { enabled: true, drive: 16, mix: 14, tone: 17000 };
      break;
    case "hiphop":
      base.eq.bands = eqBands([2.4, -1.6, 0.2, 0.8, 1.2]);
      base.filter.highpass = 26;
      base.compressor = {
        enabled: true,
        multiband: true,
        threshold: -26,
        ratio: 3.0,
        attackMs: 15,
        releaseMs: 220,
        makeup: 3,
        knee: 4,
      };
      base.saturation = { enabled: true, drive: 22, mix: 20, tone: 15000 };
      break;
    case "rock":
      base.eq.bands = eqBands([0.2, -1.0, 0.8, 2.0, 1.4]);
      base.filter.highpass = 32;
      base.compressor = {
        ...base.compressor,
        threshold: -23,
        ratio: 3.2,
        attackMs: 25,
        releaseMs: 240,
        makeup: 2.8,
      };
      base.saturation = { enabled: true, drive: 28, mix: 22, tone: 15500 };
      break;
    case "edm":
      base.eq.bands = eqBands([2.0, -1.6, 0.0, 1.2, 2.6]);
      base.filter.highpass = 28;
      base.compressor = {
        ...base.compressor,
        threshold: -20,
        ratio: 2.8,
        attackMs: 8,
        releaseMs: 140,
        makeup: 3,
      };
      base.saturation = { enabled: true, drive: 20, mix: 16, tone: 18000 };
      break;
    case "acoustic":
      base.eq.bands = eqBands([-0.4, 0.4, 0.5, 0.6, 1.2]);
      base.filter.highpass = 38;
      base.limiter.releaseMs = 140;
      base.compressor = {
        enabled: true,
        multiband: false,
        threshold: -28,
        ratio: 1.8,
        attackMs: 45,
        releaseMs: 320,
        makeup: 1.2,
        knee: 10,
      };
      base.saturation = { enabled: true, drive: 8, mix: 8, tone: 16500 };
      break;
  }

  base.targetLUFS = targetLUFS;
  return base;
}

export const DEFAULT_SETTINGS: MasteringSettings = buildGenreSettings("pop", -14);
