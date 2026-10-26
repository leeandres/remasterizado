"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { EqBand } from "@/lib/types";
import { previewEngine } from "@/lib/store";
import { fitCanvas, FREQ_TICKS, formatFreq, freqToX, xToFreq } from "@/lib/canvas";
import { eqResponseDb } from "@/lib/audio/biquad";
import { clamp } from "@/lib/utils";
import { useRaf } from "../hooks/useRaf";

interface EQEditorProps {
  bands: EqBand[];
  enabled: boolean;
  active: boolean;
  onChange: (index: number, patch: Partial<EqBand>) => void;
}

const BAND_COLORS = ["#d8ff57", "#ffb45e", "#5eead4", "#a78bfa", "#fb7185"];
const MIN_GAIN = -18;
const MAX_GAIN = 18;
const PAD_TOP = 18;
const PAD_BOTTOM = 26;

export function EQEditor({ bands, enabled, active, onChange }: EQEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bandsRef = useRef(bands);
  const enabledRef = useRef(enabled);
  const activeIndexRef = useRef<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const dragRef = useRef<{ index: number; startX: number; startY: number } | null>(null);
  const cacheRef = useRef<{ key: string; width: number; points: Float32Array } | null>(null);
  const dataRef = useRef<Float32Array | null>(null);
  const [selected, setSelected] = useState(0);

  bandsRef.current = bands;
  enabledRef.current = enabled;

  const gainToY = (gain: number, plotTop: number, plotHeight: number) => {
    return plotTop + ((MAX_GAIN - gain) / (MAX_GAIN - MIN_GAIN)) * plotHeight;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const frame = fitCanvas(canvas);
    if (!frame) return;
    const { ctx, width, height } = frame;
    const plotTop = PAD_TOP;
    const plotBottom = height - PAD_BOTTOM;
    const plotHeight = Math.max(10, plotBottom - plotTop);
    ctx.clearRect(0, 0, width, height);

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "rgba(255,255,255,0.02)");
    bg.addColorStop(1, "rgba(0,0,0,0.06)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // dB grid
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let gain = 18; gain >= -18; gain -= 6) {
      const y = gainToY(gain, plotTop, plotHeight);
      ctx.strokeStyle = gain === 0 ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.045)";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(150,160,180,0.42)";
      ctx.fillText(`${gain > 0 ? "+" : ""}${gain}`, 3, y - 6);
    }

    // frequency grid
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const freq of FREQ_TICKS) {
      const x = freqToX(freq, width);
      const major = freq === 100 || freq === 1000 || freq === 10000;
      ctx.strokeStyle = major ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.032)";
      ctx.beginPath();
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotBottom);
      ctx.stroke();
      if (freq === 20 || freq === 100 || freq === 1000 || freq === 10000 || freq === 20000) {
        ctx.fillStyle = "rgba(150,160,180,0.5)";
        ctx.fillText(formatFreq(freq), Math.max(10, Math.min(width - 10, x)), plotBottom + 9);
      }
    }

    // live spectrum backdrop
    const analyser = previewEngine.getAnalyser();
    if (analyser) {
      const bins = analyser.frequencyBinCount;
      if (!dataRef.current || dataRef.current.length !== bins) {
        dataRef.current = new Float32Array(bins);
      }
      const data = dataRef.current;
      analyser.getFloatFrequencyData(data as Float32Array<ArrayBuffer>);
      const binHz = analyser.context.sampleRate / 2 / bins;
      const gradient = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
      gradient.addColorStop(0, "rgba(94,234,212,0.16)");
      gradient.addColorStop(1, "rgba(94,234,212,0.01)");
      ctx.beginPath();
      ctx.moveTo(0, plotTop + plotHeight);
      for (let x = 0; x <= width; x += 4) {
        const freq = xToFreq(x, width);
        const bin = Math.min(bins - 1, Math.max(0, Math.round(freq / binHz)));
        const db = Number.isFinite(data[bin]) ? data[bin] : -100;
        const y = plotTop + ((-8 - clamp(db, -96, -8)) / 88) * plotHeight;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, plotTop + plotHeight);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // EQ curve (cached per band signature)
    const signature = `${width}|${bandsRef.current
      .map((b) => `${b.type}${b.freq.toFixed(0)}${b.gain.toFixed(2)}${b.q.toFixed(2)}`)
      .join(",")}|${enabledRef.current}`;
    let points: Float32Array;
    if (cacheRef.current?.key === signature && cacheRef.current.points.length === width + 1) {
      points = cacheRef.current.points;
    } else {
      points = new Float32Array(width + 1);
      for (let x = 0; x <= width; x++) {
        const freq = xToFreq(x, width);
        points[x] = enabledRef.current
          ? eqResponseDb(bandsRef.current, freq, 48000, true)
          : 0;
      }
      cacheRef.current = { key: signature, width, points };
    }

    // shaded response
    const zeroY = gainToY(0, plotTop, plotHeight);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    for (let x = 0; x <= width; x++) {
      const y = gainToY(clamp(points[x], MIN_GAIN, MAX_GAIN), plotTop, plotHeight);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, zeroY);
    ctx.closePath();
    const curveFill = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
    curveFill.addColorStop(0, "rgba(216,255,87,0.18)");
    curveFill.addColorStop(0.5, "rgba(216,255,87,0.035)");
    curveFill.addColorStop(1, "rgba(216,255,87,0.14)");
    ctx.fillStyle = curveFill;
    ctx.fill();

    ctx.beginPath();
    for (let x = 0; x <= width; x++) {
      const y = gainToY(clamp(points[x], MIN_GAIN, MAX_GAIN), plotTop, plotHeight);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = enabled ? "rgba(216,255,87,0.95)" : "rgba(150,160,180,0.5)";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();

    // nodes
    const ordered = bandsRef.current
      .map((band, index) => ({ band, index }))
      .sort((a, b) => a.band.freq - b.band.freq);

    for (const { band, index } of ordered) {
      const x = freqToX(band.freq, width);
      const y = gainToY(clamp(band.gain, MIN_GAIN, MAX_GAIN), plotTop, plotHeight);
      const color = BAND_COLORS[index % BAND_COLORS.length];
      const isActive = activeIndexRef.current === index || hoverIndexRef.current === index;
      const radius = isActive ? 8 : 5.5;

      ctx.beginPath();
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = `${color}16`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? "#f7f9ef" : color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();

      if (isActive) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}66`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // value chip
      if (isActive) {
        const label = `${formatFreq(band.freq)} Hz  ${band.gain >= 0 ? "+" : ""}${band.gain.toFixed(1)} dB`;
        ctx.font = "9px ui-monospace, monospace";
        const textWidth = ctx.measureText(label).width;
        const chipX = clamp(x - textWidth / 2 - 5, 4, width - textWidth - 14);
        const chipY = clamp(y - 30, 2, height - 22);
        ctx.fillStyle = "rgba(7,8,11,0.92)";
        ctx.strokeStyle = `${color}55`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(chipX, chipY, textWidth + 10, 17, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e7eaf0";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, chipX + 5, chipY + 9);
      }
    }

    if (!enabled) {
      ctx.fillStyle = "rgba(7,8,11,0.55)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(200,210,225,0.75)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("EQ desactivado", width / 2, height / 2);
    }
  };

  useRaf(draw, active);

  useEffect(() => {
    const frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bands, enabled]);

  const pickNode = (x: number, y: number, width: number, height: number) => {
    const plotTop = PAD_TOP;
    const plotBottom = height - PAD_BOTTOM;
    const plotHeight = Math.max(10, plotBottom - plotTop);
    let best: number | null = null;
    let bestDistance = 34 * 34;
    bands.forEach((band, index) => {
      const nx = freqToX(band.freq, width);
      const ny = gainToY(band.gain, plotTop, plotHeight);
      const distance = (nx - x) ** 2 + (ny - y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  };

  const getLocal = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!enabled) return;
    const { x, y, width, height } = getLocal(event);
    const index = pickNode(x, y, width, height);
    if (index === null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeIndexRef.current = index;
    setSelected(index);
    dragRef.current = { index, startX: x, startY: y };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const { x, y, width, height } = getLocal(event);
    if (!dragRef.current) {
      const hover = pickNode(x, y, width, height);
      if (hover !== hoverIndexRef.current) {
        hoverIndexRef.current = hover;
        draw();
      }
      return;
    }
    if (!enabled) return;
    const index = dragRef.current.index;
    const plotTop = PAD_TOP;
    const plotBottom = height - PAD_BOTTOM;
    const plotHeight = Math.max(10, plotBottom - plotTop);
    const gain =
      MAX_GAIN - clamp((y - plotTop) / plotHeight, 0, 1) * (MAX_GAIN - MIN_GAIN);
    const freq = xToFreq(clamp(x, 0, width), width);
    const roundedFreq = Math.round(freq < 100 ? freq : freq < 1000 ? freq / 5 : freq / 50) *
      (freq < 100 ? 1 : freq < 1000 ? 5 : 50);
    onChange(index, {
      freq: clamp(roundedFreq, 20, 20000),
      gain: Math.round(gain * 10) / 10,
    });
    draw();
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const onDoubleClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!enabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const index = pickNode(x, y, rect.width, rect.height);
    if (index === null) return;
    onChange(index, { gain: 0 });
  };

  const selectedBand = bands[selected] ?? bands[0];

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="eq-canvas block h-[278px] w-full cursor-crosshair sm:h-[318px]"
        role="img"
        aria-label="Editor de ecualización paramétrica de 5 bandas. Arrastra los nodos para ajustar frecuencia y ganancia."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          if (!dragRef.current) {
            hoverIndexRef.current = null;
            draw();
          }
        }}
        onDoubleClick={onDoubleClick}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/[0.05] px-3 py-2.5">
        <div className="flex items-center gap-2 text-[10px] text-ink-300">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2 py-1">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: BAND_COLORS[selected % BAND_COLORS.length] }}
            />
            {selectedBand?.label ?? "Banda"}
          </span>
          <span className="num hidden text-ink-300 sm:inline">
            {formatFreq(selectedBand?.freq ?? 0)} Hz · {selectedBand?.gain.toFixed(1)} dB
          </span>
        </div>

        <div className="flex min-w-[190px] flex-1 items-center gap-3 sm:max-w-[260px]">
          <span className="text-[10px] text-ink-300">Q</span>
          <input
            type="range"
            className="range w-full"
            min={0.3}
            max={6}
            step={0.1}
            value={selectedBand?.q ?? 1}
            disabled={!enabled}
            aria-label="Ancho de banda Q"
            onChange={(event) =>
              onChange(selected, { q: Number(event.target.value) })
            }
            style={{ "--range-pct": `${(((selectedBand?.q ?? 1) - 0.3) / 5.7) * 100}%` } as CSSProperties}
          />
          <span className="num w-8 text-right text-[10px] text-ink-200">
            {(selectedBand?.q ?? 1).toFixed(1)}
          </span>
        </div>

        <div className="hidden items-center gap-1.5 md:flex">
          {bands.map((band, index) => (
            <button
              key={band.id}
              type="button"
              onClick={() => setSelected(index)}
              className="focus-ring flex h-6 items-center gap-1.5 rounded-md border border-transparent px-1.5 text-[9px] text-ink-300 transition hover:border-white/10 hover:text-ink-100"
              aria-label={`Seleccionar banda ${band.label}`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: BAND_COLORS[index % BAND_COLORS.length] }}
              />
              {band.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
