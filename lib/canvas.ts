export interface CanvasFrame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
}

export function fitCanvas(canvas: HTMLCanvasElement | null): CanvasFrame | null {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height, dpr };
}

export const FREQ_TICKS = [20, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 20000];

export function freqToX(freq: number, width: number, min = 20, max = 20000): number {
  const ratio = Math.log(freq / min) / Math.log(max / min);
  return Math.max(0, Math.min(width, ratio * width));
}

export function xToFreq(x: number, width: number, min = 20, max = 20000): number {
  const ratio = Math.max(0, Math.min(1, x / width));
  return min * Math.pow(max / min, ratio);
}

export function formatFreq(freq: number): string {
  if (freq >= 1000) {
    const value = freq / 1000;
    return `${value >= 10 ? Math.round(value) : value.toFixed(1).replace(".0", "")}k`;
  }
  return `${Math.round(freq)}`;
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
