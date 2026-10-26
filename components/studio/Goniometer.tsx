"use client";

import { useEffect, useRef } from "react";
import { previewEngine } from "@/lib/store";
import { fitCanvas } from "@/lib/canvas";
import { useRaf } from "../hooks/useRaf";

interface GoniometerProps {
  active: boolean;
}

export function Goniometer({ active }: GoniometerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufL = useRef<Float32Array | null>(null);
  const bufR = useRef<Float32Array | null>(null);

  const draw = () => {
    const frame = fitCanvas(canvasRef.current);
    if (!frame) return;
    const { ctx, width, height } = frame;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.41;

    ctx.fillStyle = "rgba(7,8,11,0.34)";
    ctx.fillRect(0, 0, width, height);

    // outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // inner circles
    for (const scale of [0.33, 0.66]) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * scale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.stroke();
    }

    // axes
    ctx.strokeStyle = "rgba(255,255,255,0.055)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.stroke();

    // diagonals
    ctx.setLineDash([2, 5]);
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.707, cy - radius * 0.707);
    ctx.lineTo(cx + radius * 0.707, cy + radius * 0.707);
    ctx.moveTo(cx + radius * 0.707, cy - radius * 0.707);
    ctx.lineTo(cx - radius * 0.707, cy + radius * 0.707);
    ctx.stroke();
    ctx.setLineDash([]);

    // labels
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillStyle = "rgba(150,160,180,0.55)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("M", cx, cy - radius - 9);
    ctx.fillText("S", cx - radius - 9, cy);
    ctx.fillText("S", cx + radius + 9, cy);
    ctx.fillText("−", cx, cy + radius + 9);

    const analyserL = previewEngine.getAnalyserL();
    const analyserR = previewEngine.getAnalyserR();
    const meters = previewEngine.getLiveMeters();

    if (analyserL && analyserR) {
      const size = analyserL.fftSize;
      if (!bufL.current || bufL.current.length !== size) bufL.current = new Float32Array(size);
      if (!bufR.current || bufR.current.length !== size) bufR.current = new Float32Array(size);
      analyserL.getFloatTimeDomainData(bufL.current as Float32Array<ArrayBuffer>);
      analyserR.getFloatTimeDomainData(bufR.current as Float32Array<ArrayBuffer>);

      const scale = radius * 1.45;
      const correlation = meters.correlation;
      const color =
        correlation > 0.55
          ? "rgba(216,255,87,0.52)"
          : correlation > 0.1
            ? "rgba(94,234,212,0.5)"
            : correlation > -0.2
              ? "rgba(255,180,94,0.55)"
              : "rgba(251,113,133,0.65)";

      ctx.fillStyle = color;
      for (let i = 0; i < size; i += 2) {
        const l = bufL.current[i];
        const r = bufR.current[i];
        const side = (l - r) * 0.7071;
        const mid = (l + r) * 0.7071;
        const x = cx + side * scale;
        const y = cy - mid * scale;
        const px = Math.max(0, Math.min(width, x));
        const py = Math.max(0, Math.min(height, y));
        ctx.fillRect(px, py, 1.4, 1.4);
      }

      // correlation bar
      const barW = radius * 1.5;
      const barX = cx - barW / 2;
      const barY = height - 16;
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(barX, barY, barW, 3);
      ctx.fillStyle = "rgba(255,180,94,0.65)";
      ctx.fillRect(barX, barY, barW / 2, 3);
      const markerX = barX + ((correlation + 1) / 2) * barW;
      ctx.fillStyle = correlation > 0.1 ? "#d8ff57" : "#fb7185";
      ctx.fillRect(markerX - 0.75, barY - 2, 1.5, 7);

      ctx.font = "9px ui-monospace, monospace";
      ctx.fillStyle = "rgba(180,190,205,0.72)";
      ctx.textAlign = "left";
      ctx.fillText("−1", barX, barY - 8);
      ctx.textAlign = "right";
      ctx.fillText("+1", barX + barW, barY - 8);
      ctx.textAlign = "center";
      ctx.fillStyle = correlation > 0.1 ? "rgba(216,255,87,0.9)" : "rgba(251,113,133,0.95)";
      ctx.fillText(
        `${correlation >= 0 ? "+" : ""}${correlation.toFixed(2)}`,
        cx,
        barY - 8,
      );
    } else {
      ctx.fillStyle = "rgba(160,170,190,0.4)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Reproduce la pista para activar el goniómetro", cx, cy + radius * 0.62);
    }
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
        className="gonio-canvas block h-[268px] w-full sm:h-[306px]"
        aria-label="Goniómetro y correlación de fase estéreo"
      />
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-black/30 px-2 py-0.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${active ? "bg-cyan-glow animate-pulse-soft" : "bg-ink-500"}`}
        />
        <span className="num text-[8px] uppercase tracking-[0.16em] text-ink-400">Lissajous</span>
      </div>
    </div>
  );
}
