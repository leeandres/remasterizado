"use client";

import { useEffect, useRef } from "react";

export function useRaf(callback: (time: number) => void, active = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = (time: number) => {
      callbackRef.current(time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);
}

export function useOnMount(callback: () => void | (() => void)) {
  useEffect(callback, []);
}
