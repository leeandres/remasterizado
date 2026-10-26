"use client";

import { useEffect, useRef } from "react";
import { previewEngine } from "@/lib/store";
import { fitCanvas, FREQ_TICKS, formatFreq, freqToX, xToFreq } from "@/lib/canvas";
import { useRaf } from "../hooks/useRaf";

interface SpectrumProps {
  active: boolean;
}

const MIN_DB = -92;
const MAX_DB = -8;
const PEAK_BUCKETS = 180;

export function Spectrum({ active }: SpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<Float32Array | null>(null);
  const peaksRef = useRef<Float32Array>(new Float32Array(PEAK_BUCKETS).fill(MIN_DB));
  const peaksWidthRef = useRef(0);

  const draw = () => {
    const canvas = canvasRef.current;
    const frame = fitCanvas(canvas);
    if (!frame) return;
    const { ctx, width, height } = frame;

    const top = 12;
    const bottom = height - 26;
    const plotHeight = Math.max(10, bottom - top);
    ctx.clearRect(0, 0, width, height);

    // backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "rgba(255,255,255,0.015)");
    bg.addColorStop(1, "rgba(0,0,0,0.08)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // horizontal dB grid
    ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let db = -10; db >= -90; db -= 10) {
      const y = top + ((MAX_DB - db) / (MAX_DB - MIN_DB)) * plotHeight;
      ctx.strokeStyle = db === -10 ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.045)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      if (db === -10 || db === -30 || db === -50 || db === -70) {
        ctx.fillStyle = "rgba(150,160,180,0.42)";
        ctx.fillText(`${db}`, width - 2, y - 6);
      }
    }

    // frequency grid
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const freq of FREQ_TICKS) {
      const x = freqToX(freq, width);
      const major = freq === 100 || freq === 1000 || freq === 10000;
      ctx.strokeStyle = major ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.032)";
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      if (freq === 20 || freq === 100 || freq === 1000 || freq === 10000 || freq === 20000) {
        ctx.fillStyle = "rgba(150,160,180,0.5)";
        ctx.fillText(formatFreq(freq), Math.max(10, Math.min(width - 10, x)), bottom + 8);
      }
    }

    // zone separators
    for (const freq of [250, 4000]) {
      const x = freqToX(freq, width);
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = "rgba(216,255,87,0.18)";
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = "rgba(150,160,180,0.28)";
    ctx.font = "8px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText("GRAVES", freqToX(22, width) + 2, bottom + 18);
    ctx.fillText("MEDIOS", freqToX(270, width) + 2, bottom + 18);
    ctx.textAlign = "right";
    ctx.fillText("AGUDOS", freqToX(19500, width) - 2, bottom + 18);

    const analyser = previewEngine.getAnalyser();
    if (!analyser) {
      ctx.fillStyle = "rgba(160,170,190,0.4)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Reproduce la pista para activar el analizador", width / 2, top + plotHeight / 2);
      return;
    }

    if (peaksRef.current.length !== PEAK_BUCKETS) {
      peaksRef.current = new Float32Array(PEAK_BUCKETS).fill(MIN_DB);
    }
    if (peaksWidthRef.current !== width) {
      peaksRef.current.fill(MIN_DB);
      peaksWidthRef.current = width;
    }

    const bins = analyser.frequencyBinCount;
    if (!dataRef.current || dataRef.current.length !== bins) {
      dataRef.current = new Float32Array(bins);
    }
    const data = dataRef.current;
    analyser.getFloatFrequencyData(data as Float32Array<ArrayBuffer>);
    const sampleRate = analyser.context.sampleRate;
    const binHz = sampleRate / 2 / bins;

    const sampleDb = (freq: number): number => {
      const exact = freq / binHz;
      const low = Math.max(0, Math.min(bins - 1, Math.floor(exact)));
      const high = Math.min(bins - 1, low + 1);
      const t = exact - low;
      const a = data[low];
      const b = data[high];
      const value = a + (b - a) * t;
      if (!Number.isFinite(value)) return MIN_DB;
      return Math.max(MIN_DB, Math.min(MAX_DB, value));
    };

    // fill under spectrum
    const gradient = ctx.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, "rgba(216,255,87,0.32)");
    gradient.addColorStop(0.38, "rgba(94,234,212,0.18)");
    gradient.addColorStop(1, "rgba(94,234,212,0.01)");

    ctx.beginPath();
    ctx.moveTo(0, bottom);
    const step = 2;
    for (let x = 0; x <= width; x += step) {
      const freq = xToFreq(x, width);
      const db = sampleDb(freq);
      const y = top + ((MAX_DB - db) / (MAX_DB - MIN_DB)) * plotHeight;
      if (x === 0) ctx.lineTo(0, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(width, bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // spectrum line
    ctx.beginPath();
    for (let x = 0; x <= width; x += step) {
      const freq = xToFreq(x, width);
      const db = sampleDb(freq);
      const y = top + ((MAX_DB - db) / (MAX_DB - MIN_DB)) * plotHeight;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(216,255,87,0.9)";
    ctx.lineWidth = 1.4;
    ctx.lineJoin = "round";
    ctx.stroke();

    // peak hold
    const peaks = peaksRef.current;
    let peakPath = false;
    ctx.beginPath();
    for (let i = 0; i < PEAK_BUCKETS; i++) {
      const ratio = i / (PEAK_BUCKETS - 1);
      const freq = 20 * Math.pow(1000, ratio);
      const db = sampleDb(freq);
      peaks[i] = Math.max(db, peaks[i] - 0.35);
      const x = (i / (PEAK_BUCKETS - 1)) * width;
      const y = top + ((MAX_DB - peaks[i]) / (MAX_DB - MIN_DB)) * plotHeight;
      if (!peakPath) {
        ctx.moveTo(x, y);
        peakPath = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = "rgba(255,180,94,0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // glowing top line accent
    const sweep = ctx.createLinearGradient(0, top, width, top);
    sweep.addColorStop(0, "rgba(94,234,212,0)");
    sweep.addColorStop(0.5, "rgba(94,234,212,0.45)");
    sweep.addColorStop(1, "rgba(167,139,250,0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(0, top, width, 1);
  };

  useRaf(draw, active);

  useEffect(() => {
    const frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="spectrum-canvas block h-[238px] w-full sm:h-[276px]"
        aria-label="Analizador de espectro en tiempo real"
      />
      <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-black/30 px-2 py-0.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${active ? "bg-lime-acid animate-pulse-soft" : "bg-ink-500"}`}
        />
        <span className="num text-[8px] uppercase tracking-[0.16em] text-ink-400">FFT 4096</span>
      </div>
    </div>
  );
}
