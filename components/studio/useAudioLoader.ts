"use client";

import { useCallback, useState } from "react";
import { useStudio } from "@/lib/store";
import { prepareTrack } from "@/lib/audio/decode";
import { formatTime } from "@/lib/utils";

const MAX_SIZE = 500 * 1024 * 1024;
const ALLOWED = ["mp3", "wav", "wave", "flac"];

export function useAudioLoader() {
  const [processing, setProcessing] = useState(false);
  const loadTrack = useStudio((state) => state.loadTrack);
  const setBusy = useStudio((state) => state.setBusy);
  const notify = useStudio((state) => state.notify);

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || !files.length) return;
      if (processing) return;
      const file = files[0];
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

      if (!ALLOWED.includes(extension)) {
        notify(
          "error",
          "Formato no compatible",
          "MasterAI Pro acepta MP3, WAV y FLAC. Convierte tu archivo o expórtalo desde tu DAW.",
        );
        return;
      }
      if (file.size > MAX_SIZE) {
        notify(
          "error",
          "Archivo demasiado grande",
          `El límite es 500 MB y tu archivo pesa ${(file.size / 1024 / 1024).toFixed(0)} MB.`,
        );
        return;
      }

      setProcessing(true);
      setBusy({
        label: "Preparando tu pista",
        detail: "Leyendo el archivo…",
        progress: 0.02,
        phase: "decoding",
      });

      try {
        const track = await prepareTrack(file, (update) => {
          setBusy({
            label: "Preparando tu pista",
            detail: update.detail,
            progress: update.progress,
            phase: update.phase,
          });
        });
        loadTrack(track);
        setBusy(null);
        notify(
          "success",
          "Pista lista para masterizar",
          `${track.name} · ${formatTime(track.duration)} · ${track.stats.lufsIntegrated.toFixed(1)} LUFS de entrada`,
        );
        if (track.duration > 12 * 60) {
          window.setTimeout(() => {
            notify(
              "info",
              "Pista larga detectada",
              "Puedes masterizar la pista completa, pero para exportar te recomendamos usar una selección para ahorrar memoria.",
            );
          }, 1200);
        }
      } catch (error) {
        setBusy(null);
        notify(
          "error",
          "No se pudo cargar el audio",
          error instanceof Error
            ? error.message
            : "El archivo no se pudo decodificar. Prueba con WAV de 24 bits.",
        );
      } finally {
        setProcessing(false);
      }
    },
    [loadTrack, notify, processing, setBusy],
  );

  return { processing, handleFiles };
}
