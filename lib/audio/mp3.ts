export async function encodeMp3(
  buffer: AudioBuffer,
  bitRate = 320,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const left = new Float32Array(buffer.getChannelData(0));
  const right = new Float32Array(
    buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0),
  );

  const worker = new Worker(new URL("../workers/mp3.worker.ts", import.meta.url), {
    type: "module",
  });

  return new Promise<Blob>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener("abort", onAbort);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const onAbort = () => fail(new DOMException("Exportación cancelada", "AbortError"));

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort);

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | { type: "progress"; progress: number }
        | { type: "done"; buffer: ArrayBuffer; bytes: number }
        | { type: "error"; message: string };
      if (data.type === "progress") {
        onProgress?.(data.progress);
      } else if (data.type === "done") {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(new Blob([data.buffer], { type: "audio/mpeg" }));
      } else if (data.type === "error") {
        fail(new Error(data.message));
      }
    };

    worker.onerror = (event) => {
      fail(new Error(event.message || "El codificador MP3 falló"));
    };

    worker.postMessage(
      { left, right, sampleRate: buffer.sampleRate, bitRate },
      [left.buffer, right.buffer],
    );
  });
}
