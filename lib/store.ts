"use client";

import { create } from "zustand";
import type {
  AnalysisStats,
  GenreId,
  LoadedTrack,
  MasteringSettings,
  MobileView,
  PlatformId,
} from "./types";
import { DEFAULT_SETTINGS, PLATFORMS, buildGenreSettings, cloneSettings } from "./presets";
import { PreviewEngine } from "./audio/preview";
import { masterBuffer } from "./audio/render";
import { autoMaster } from "./audio/automaster";

export const previewEngine = new PreviewEngine(cloneSettings(DEFAULT_SETTINGS));

export type AnalyzerTab = "spectrum" | "eq" | "phase";

export interface PreviewEstimate {
  before: AnalysisStats;
  after: AnalysisStats;
  gainDb: number;
  limiterReductionDb: number;
  renderSeconds: number;
  renderedAt: number;
}

export interface BusyState {
  label: string;
  detail: string;
  progress: number;
  phase: string;
}

export interface ToastState {
  id: number;
  tone: "info" | "success" | "error";
  title: string;
  message?: string;
}

interface StudioState {
  track: LoadedTrack | null;
  settings: MasteringSettings;
  genre: GenreId;
  platform: PlatformId;
  region: { start: number; end: number } | null;
  loop: boolean;
  isPlaying: boolean;
  bypass: boolean;
  volume: number;
  busy: BusyState | null;
  toast: ToastState | null;
  mobileView: MobileView;
  analyzerTab: AnalyzerTab;
  previewEstimate: PreviewEstimate | null;
  exportOpen: boolean;
  historyOpen: boolean;
  helpOpen: boolean;
  settingsDirty: boolean;
  autoNotes: string[] | null;

  loadTrack: (track: LoadedTrack) => void;
  clearTrack: () => void;
  setSettings: (settings: MasteringSettings, options?: { dirty?: boolean }) => void;
  patchSettings: (updater: (settings: MasteringSettings) => void) => void;
  setGenre: (genre: GenreId) => void;
  setPlatform: (platform: PlatformId) => void;
  applySettings: (settings: MasteringSettings, genre: GenreId, notes?: string[]) => void;
  applyHistorySettings: (
    settings: MasteringSettings,
    genre: GenreId,
    platform: PlatformId,
  ) => void;
  runAutoMaster: () => void;
  runAnalysis: () => Promise<void>;
  setRegion: (region: { start: number; end: number } | null) => void;
  toggleLoop: () => void;
  setLoop: (loop: boolean) => void;
  togglePlay: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setBypass: (bypass: boolean) => void;
  setVolume: (volume: number) => void;
  setBusy: (busy: BusyState | null) => void;
  notify: (tone: ToastState["tone"], title: string, message?: string) => void;
  dismissToast: () => void;
  setMobileView: (view: MobileView) => void;
  setAnalyzerTab: (tab: AnalyzerTab) => void;
  setPreviewEstimate: (estimate: PreviewEstimate | null) => void;
  openExport: (open: boolean) => void;
  openHistory: (open: boolean) => void;
  openHelp: (open: boolean) => void;
  clearAutoNotes: () => void;
  resetSettings: () => void;
}

let toastId = 0;

let playToggleToken = 0;

export const useStudio = create<StudioState>((set, get) => ({
  track: null,
  settings: cloneSettings(DEFAULT_SETTINGS),
  genre: "pop",
  platform: "spotify",
  region: null,
  loop: false,
  isPlaying: false,
  bypass: false,
  volume: 0.9,
  busy: null,
  toast: null,
  mobileView: "studio",
  analyzerTab: "spectrum",
  previewEstimate: null,
  exportOpen: false,
  historyOpen: false,
  helpOpen: false,
  settingsDirty: false,
  autoNotes: null,

  loadTrack: (track) => {
    void previewEngine.load(track.buffer);
    previewEngine.setLoop(false);
    previewEngine.setRegion(null);
    set({
      track,
      region: null,
      loop: false,
      isPlaying: false,
      previewEstimate: null,
      settingsDirty: false,
      mobileView: "studio",
    });
  },

  clearTrack: () => {
    previewEngine.unload();
    set({
      track: null,
      region: null,
      loop: false,
      isPlaying: false,
      previewEstimate: null,
      exportOpen: false,
    });
  },

  setSettings: (settings, options) => {
    previewEngine.updateSettings(settings);
    set({
      settings,
      settingsDirty: options?.dirty ?? true,
      previewEstimate: null,
    });
  },

  patchSettings: (updater) => {
    const next = cloneSettings(get().settings);
    updater(next);
    previewEngine.updateSettings(next);
    set({ settings: next, settingsDirty: true, previewEstimate: null });
  },

  setGenre: (genre) => {
    const platform = PLATFORMS[get().platform];
    const next = buildGenreSettings(genre, platform.targetLUFS);
    previewEngine.updateSettings(next);
    set({
      genre,
      settings: next,
      settingsDirty: true,
      previewEstimate: null,
      autoNotes: null,
    });
  },

  setPlatform: (platform) => {
    const target = PLATFORMS[platform];
    const next = cloneSettings(get().settings);
    next.targetLUFS = target.targetLUFS;
    next.limiter.ceiling = target.ceiling;
    previewEngine.updateSettings(next);
    set({
      platform,
      settings: next,
      settingsDirty: true,
      previewEstimate: null,
    });
  },

  applySettings: (settings, genre, notes) => {
    previewEngine.updateSettings(settings);
    set({
      settings,
      genre,
      settingsDirty: true,
      previewEstimate: null,
      autoNotes: notes ?? null,
    });
  },

  applyHistorySettings: (settings, genre, platform) => {
    const next = cloneSettings(settings);
    previewEngine.updateSettings(next);
    const target = PLATFORMS[platform];
    set({
      settings: next,
      genre,
      platform,
      settingsDirty: false,
      previewEstimate: null,
      autoNotes: null,
      region: null,
      loop: false,
    });
    previewEngine.setRegion(null);
    previewEngine.setLoop(false);
    void target;
  },

  runAutoMaster: () => {
    const { track, genre, platform } = get();
    if (!track) {
      get().notify("info", "Carga una pista primero", "El auto-masterizado necesita audio para analizar.");
      return;
    }
    const result = autoMaster(track.stats, genre, PLATFORMS[platform]);
    get().applySettings(result.settings, genre, result.notes);
    get().notify(
      "success",
      "Auto-Master IA aplicado",
      `${result.summary} · Revisa el informe y ajusta al gusto.`,
    );
  },

  runAnalysis: async () => {
    const { track, settings } = get();
    if (!track) return;
    set({
      busy: {
        label: "Analizando la cadena",
        detail: "Render offline y medición de loudness…",
        progress: 0.02,
        phase: "rendering",
      },
    });
    try {
      const result = await masterBuffer(track.buffer, settings, {
        normalize: settings.normalize,
        targetLUFS: settings.targetLUFS,
        range: null,
        onProgress: (update) =>
          set({
            busy: {
              label: "Analizando la cadena",
              detail: update.detail,
              progress: update.progress,
              phase: update.phase,
            },
          }),
      });
      set({
        previewEstimate: {
          before: track.stats,
          after: result.stats,
          gainDb: result.gainDb,
          limiterReductionDb: result.limiterReductionDb,
          renderSeconds: result.renderSeconds,
          renderedAt: Date.now(),
        },
        busy: null,
      });
      get().notify(
        "success",
        "Análisis completado",
        `Resultado estimado: ${result.stats.lufsIntegrated.toFixed(1)} LUFS · ${result.stats.truePeakDb.toFixed(1)} dBTP`,
      );
    } catch (error) {
      set({ busy: null });
      if (error instanceof Error && error.name === "AbortError") return;
      get().notify(
        "error",
        "No se pudo analizar",
        error instanceof Error ? error.message : "Error desconocido durante el render.",
      );
    }
  },

  setRegion: (region) => {
    previewEngine.setRegion(region);
    set({ region });
  },

  toggleLoop: () => {
    const loop = !get().loop;
    previewEngine.setLoop(loop);
    set({ loop });
  },

  setLoop: (loop) => {
    previewEngine.setLoop(loop);
    set({ loop });
  },

  togglePlay: () => {
    const track = get().track;
    if (!track) return;
    if (get().isPlaying) {
      previewEngine.pause();
      set({ isPlaying: false });
      return;
    }
    const token = ++playToggleToken;
    set({ isPlaying: true });
    void previewEngine.play().then(() => {
      if (token === playToggleToken) {
        set({ isPlaying: previewEngine.isPlaying });
      }
    }).catch(() => {
      if (token === playToggleToken) set({ isPlaying: false });
    });
  },

  stop: () => {
    previewEngine.stop();
    set({ isPlaying: false });
  },

  seek: (time) => {
    previewEngine.seek(time);
  },

  setBypass: (bypass) => {
    previewEngine.setBypass(bypass);
    set({ bypass });
  },

  setVolume: (volume) => {
    previewEngine.setVolume(volume);
    set({ volume });
  },

  setBusy: (busy) => set({ busy }),

  notify: (tone, title, message) => {
    toastId += 1;
    set({ toast: { id: toastId, tone, title, message } });
  },

  dismissToast: () => set({ toast: null }),

  setMobileView: (mobileView) => set({ mobileView }),

  setAnalyzerTab: (analyzerTab) => set({ analyzerTab }),

  setPreviewEstimate: (previewEstimate) => set({ previewEstimate }),

  openExport: (exportOpen) => set({ exportOpen }),

  openHistory: (historyOpen) => set({ historyOpen }),
  openHelp: (helpOpen) => set({ helpOpen }),

  clearAutoNotes: () => set({ autoNotes: null }),

  resetSettings: () => {
    const platform = PLATFORMS[get().platform];
    const next = buildGenreSettings(get().genre, platform.targetLUFS);
    previewEngine.updateSettings(next);
    set({ settings: next, previewEstimate: null, autoNotes: null, settingsDirty: false });
  },
}));
