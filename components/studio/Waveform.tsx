"use client";

import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/plugins/regions";
import { X } from "lucide-react";
import { useStudio, previewEngine } from "@/lib/store";
import { formatTime } from "@/lib/utils";

export function Waveform() {
  const track = useStudio((state) => state.track);
  const region = useStudio((state) => state.region);
  const loop = useStudio((state) => state.loop);
  const seek = useStudio((state) => state.seek);
  const setRegion = useStudio((state) => state.setRegion);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const lastRegionAt = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !track) return;
    container.innerHTML = "";

    progressRef.current = null;
    headRef.current = null;

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    const ws = WaveSurfer.create({
      container,
      peaks: track.peaks,
      duration: track.duration,
      height: 124,
      waveColor: "rgba(133,143,163,0.58)",
      progressColor: "rgba(216,255,87,0.55)",
      cursorWidth: 0,
      barWidth: 1,
      barGap: 1,
      barRadius: 1,
      normalize: true,
      fillParent: true,
      interact: true,
      hideScrollbar: true,
      plugins: [regions],
      dragToSeek: false,
    });
    wsRef.current = ws;

    ws.on("ready", () => {
      regions.enableDragSelection(
        {
          color: "rgba(216,255,87,0.10)",
          minLength: 0.15,
        },
        0.04,
      );
      regions.getRegions().forEach((r) => r.remove());
    });

    ws.on("interaction", (time) => {
      if (Date.now() - lastRegionAt.current < 220) return;
      seek(time);
    });

    const publishRegion = (r: Region) => {
      lastRegionAt.current = Date.now();
      const start = Math.max(0, r.start);
      const end = Math.min(track.duration, r.end);
      if (end - start > 0.1) setRegion({ start, end });
    };

    regions.on("region-created", (r) => {
      regions.getRegions().forEach((other) => {
        if (other.id !== r.id) other.remove();
      });
      r.setOptions({ color: "rgba(216,255,87,0.10)" });
      publishRegion(r);
    });
    regions.on("region-updated", (r) => publishRegion(r));
    regions.on("region-removed", () => {
      if (!regions.getRegions().length) setRegion(null);
    });

    return () => {
      regionsRef.current = null;
      wsRef.current = null;
      try {
        ws.destroy();
      } catch {
        // ignore
      }
    };
  }, [track, seek, setRegion]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const current = previewEngine.getCurrentTime();
      const duration = track?.duration ?? 1;
      const percent = Math.max(0, Math.min(1, current / duration));
      const progress = progressRef.current || document.querySelector("[data-wave-progress]");
      const head = headRef.current || document.querySelector("[data-wave-head]");
      if (progress) (progress as HTMLElement).style.width = `${percent * 100}%`;
      if (head) (head as HTMLElement).style.left = `${percent * 100}%`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [track?.duration]);

  const clearSelection = () => {
    const regions = regionsRef.current;
    if (regions) regions.clearRegions();
    setRegion(null);
  };

  return (
    <div className="relative">
      <div ref={containerRef} className="waveform-host min-h-[124px] w-full" />
      <div className="pointer-events-none absolute inset-0">
        <div
          ref={progressRef}
          data-wave-progress="1"
          className="absolute inset-y-0 left-0 border-r border-lime-acid/45 bg-gradient-to-r from-lime-acid/[0.025] to-lime-acid/[0.09]"
          style={{ width: "0%" }}
        />
        <div
          ref={headRef}
          data-wave-head="1"
          className="absolute inset-y-0 w-px bg-lime-acid/70 shadow-[0_0_8px_rgba(216,255,87,0.55)]"
          style={{ left: "0%" }}
        />
      </div>
      {region && (
        <button
          type="button"
          onClick={clearSelection}
          className="focus-ring absolute right-2 top-2 z-20 inline-flex items-center gap-1.5 rounded-md border border-lime-acid/25 bg-[#0a0c07]/85 px-2 py-1 text-[9px] font-medium text-lime-acid backdrop-blur-md transition hover:bg-[#0d1108]"
          title="Borrar selección"
        >
          <span className="num">
            {formatTime(region.start)}–{formatTime(region.end)}
          </span>
          {loop && <span className="text-[8px] uppercase tracking-wider opacity-70">loop</span>}
          <X size={10} />
        </button>
      )}
      <div className="pointer-events-none absolute bottom-2 left-3 text-[9px] text-white/25">
        Arrastra sobre la onda para seleccionar una región
      </div>
    </div>
  );
}

