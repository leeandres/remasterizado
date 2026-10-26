import type { AnalysisStats, GenreId, MasteringSettings, PlatformTarget } from "../types";
import { buildGenreSettings, cloneSettings } from "../presets";
import { clamp } from "../utils";

export interface AutoMasterResult {
  settings: MasteringSettings;
  notes: string[];
  summary: string;
}

function dbToPower(db: number): number {
  return Math.pow(10, db / 10);
}

function powerToDb(power: number): number {
  return power > 1e-12 ? 10 * Math.log10(power) : -96;
}

/**
 * Rule-based "AI" mastering: starts from a genre profile and corrects tonal
 * balance, dynamics and loudness using the measured source analysis.
 */
export function autoMaster(
  stats: AnalysisStats,
  genre: GenreId,
  platform: PlatformTarget,
): AutoMasterResult {
  const settings = cloneSettings(buildGenreSettings(genre, platform.targetLUFS));
  const notes: string[] = [];

  const lowPower = (dbToPower(stats.spectral.sub) + dbToPower(stats.spectral.low)) / 2;
  const lowDb = powerToDb(lowPower);
  const midPower = (dbToPower(stats.spectral.lowMid) + dbToPower(stats.spectral.mid)) / 2;
  const midDb = powerToDb(midPower);
  const highPower = (dbToPower(stats.spectral.highMid) + dbToPower(stats.spectral.air)) / 2;
  const highDb = powerToDb(highPower);

  const lowBand = settings.eq.bands[0];
  const lowMidBand = settings.eq.bands[1];
  const presenceBand = settings.eq.bands[3];
  const airBand = settings.eq.bands[4];

  if (lowDb - midDb > 9) {
    lowBand.gain = clamp(lowBand.gain - 1.6, -6, 6);
    lowMidBand.gain = clamp(lowMidBand.gain - 0.6, -6, 6);
    notes.push("Subgraves dominantes: se atenúa el extremo bajo para recuperar definición.");
  } else if (lowDb - midDb < -4) {
    lowBand.gain = clamp(lowBand.gain + 1.2, -6, 6);
    notes.push("Cuerpo grave escaso: se refuerza la base para dar peso al tema.");
  }

  if (highDb - midDb < -9) {
    airBand.gain = clamp(airBand.gain + 1.8, -4, 8);
    presenceBand.gain = clamp(presenceBand.gain + 0.7, -4, 8);
    notes.push("Extremo alto apagado: se añade aire y presencia para abrir la mezcla.");
  } else if (highDb - midDb > 6) {
    airBand.gain = clamp(airBand.gain - 1.0, -6, 8);
    notes.push("Brillo agresivo: se suaviza el aire para evitar fatiga auditiva.");
  }

  if (stats.crestDb > 15) {
    settings.compressor.ratio = clamp(settings.compressor.ratio + 0.5, 1.2, 6);
    settings.compressor.threshold = clamp(settings.compressor.threshold - 1.5, -45, -6);
    settings.compressor.makeup = clamp(settings.compressor.makeup + 0.5, 0, 9);
    notes.push("Factor de cresta alto: se controla la dinámica con más suavidad.");
  } else if (stats.crestDb > 0 && stats.crestDb < 6.5) {
    settings.compressor.ratio = clamp(settings.compressor.ratio - 0.4, 1.2, 6);
    settings.compressor.threshold = clamp(settings.compressor.threshold + 1.5, -45, -6);
    settings.compressor.makeup = clamp(settings.compressor.makeup - 0.5, 0, 9);
    notes.push("Mezcla ya muy comprimida: se reduce la compresión para no aplastarla.");
  }

  if (stats.correlation > -1 && stats.correlation < 0.08) {
    settings.saturation.mix = clamp(settings.saturation.mix + 4, 0, 45);
    notes.push("Correlación estéreo baja: se mantiene la compatibilidad mono sin ensanchar.");
  }

  if (stats.truePeakDb > -0.3) {
    notes.push("El original ya está al límite digital: el limitador protegerá la salida.");
  }

  if (stats.dcOffset > 0.002) {
    settings.filter.highpass = Math.max(settings.filter.highpass, 32);
    notes.push("Offset DC detectado: el filtro subsónico se eleva a 32 Hz.");
  }

  if (stats.lufsIntegrated > platform.targetLUFS + 4) {
    notes.push(
      `La fuente es más fuerte que ${platform.name}: se atenuará para respetar la normalización del destino.`,
    );
  } else if (stats.lufsIntegrated < platform.targetLUFS - 8 && stats.lufsIntegrated > -70) {
    notes.push(`Se elevará la sonoridad hacia ${platform.targetLUFS} LUFS con control de picos.`);
  }

  settings.outputGain = clamp(
    platform.targetLUFS - (Number.isFinite(stats.lufsIntegrated) ? stats.lufsIntegrated : platform.targetLUFS),
    -12,
    12,
  );
  settings.targetLUFS = platform.targetLUFS;
  settings.normalize = true;
  settings.limiter.enabled = true;
  settings.limiter.ceiling = platform.ceiling;

  if (!notes.length) {
    notes.push("Balance equilibrado: se aplica el perfil del género con ajustes mínimos.");
  }

  return {
    settings,
    notes: notes.slice(0, 4),
    summary: `Perfil ${platform.name} · ${platform.targetLUFS} LUFS · techo ${platform.ceiling} dBTP`,
  };
}
