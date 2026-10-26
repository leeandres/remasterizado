/// <reference lib="webworker" />

import { Mp3Encoder } from "@breezystack/lamejs";

interface EncodeRequest {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  bitRate: number;
}

function toInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = input[i];
    const clamped = sample > 1 ? 1 : sample < -1 ? -1 : sample;
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return output;
}

self.addEventListener("message", (event: MessageEvent<EncodeRequest>) => {
  const { left, right, sampleRate, bitRate } = event.data;
  try {
    const encoder = new Mp3Encoder(2, sampleRate, bitRate);
    const left16 = toInt16(left);
    const right16 = toInt16(right);
    const blockSize = 1152;
    const chunks: Uint8Array[] = [];
    const total = left16.length;
    let lastReport = 0;

    for (let offset = 0; offset < total; offset += blockSize) {
      const end = Math.min(total, offset + blockSize);
      const encoded = encoder.encodeBuffer(left16.subarray(offset, end), right16.subarray(offset, end));
      if (encoded.length) chunks.push(new Uint8Array(encoded));
      if (offset - lastReport > blockSize * 256) {
        lastReport = offset;
        (self as unknown as DedicatedWorkerGlobalScope).postMessage({
          type: "progress",
          progress: total ? offset / total : 1,
        });
      }
    }

    const flushed = encoder.flush();
    if (flushed.length) chunks.push(new Uint8Array(flushed));

    let size = 0;
    for (const chunk of chunks) size += chunk.length;
    const output = new Uint8Array(size);
    let cursor = 0;
    for (const chunk of chunks) {
      output.set(chunk, cursor);
      cursor += chunk.length;
    }

    (self as unknown as DedicatedWorkerGlobalScope).postMessage(
      { type: "done", buffer: output.buffer, bytes: size },
      [output.buffer],
    );
  } catch (error) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Error codificando MP3",
    });
  }
});
