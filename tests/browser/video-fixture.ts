import type { Page } from "@playwright/test";

// Original synthetic four-second, silent VP8/WebM with explicit duration.
// First half: approved budget. Second half: did not approve. No real news claim.
export async function createTimelineVideo(page: Page): Promise<Buffer> {
  const encoded = await page.evaluate(async () => {
    const concat = (chunks: Uint8Array[]) => {
      const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
      let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
      return result;
    };
    const uint = (value: number) => {
      const bytes: number[] = [];
      do { bytes.unshift(value % 256); value = Math.floor(value / 256); } while (value);
      return Uint8Array.from(bytes);
    };
    const size = (value: number) => {
      let length = 1;
      while (value >= 2 ** (7 * length) - 1) length++;
      const bytes = new Uint8Array(length);
      for (let i = length - 1; i >= 0; i--) { bytes[i] = value % 256; value = Math.floor(value / 256); }
      bytes[0] |= 1 << (8 - length); return bytes;
    };
    const element = (id: number, value: Uint8Array) => concat([uint(id), size(value.length), value]);
    const number = (id: number, value: number) => element(id, uint(value));
    const string = (id: number, value: string) => element(id, new TextEncoder().encode(value));
    const chunks: { bytes: Uint8Array; timestamp: number }[] = [];
    let encodingError: Error | null = null;
    const encoder = new VideoEncoder({ output: chunk => { const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes); chunks.push({ bytes, timestamp: chunk.timestamp / 1000 }); }, error: error => { encodingError = error; } });
    encoder.configure({ codec: "vp8", width: 800, height: 400, bitrate: 800000, framerate: 1 });
    const canvas = document.createElement("canvas"); canvas.width = 800; canvas.height = 400;
    const context = canvas.getContext("2d")!;
    for (let index = 0; index < 4; index++) {
      context.fillStyle = index < 2 ? "white" : "#d8e4f0"; context.fillRect(0, 0, 800, 400);
      context.fillStyle = "black"; context.font = "bold 42px Arial";
      context.fillText("CITY COUNCIL", 40, 90);
      context.fillText(index < 2 ? "APPROVED" : "DID NOT APPROVE", 40, 180);
      context.fillText("TRANSPORT BUDGET", 40, 270);
      const frame = new VideoFrame(canvas, { timestamp: index * 1_000_000, duration: 1_000_000 });
      encoder.encode(frame, { keyFrame: true }); frame.close();
    }
    await encoder.flush(); encoder.close();
    if (encodingError) throw encodingError;
    const header = element(0x1a45dfa3, concat([number(0x4286, 1), number(0x42f7, 1), number(0x42f2, 4), number(0x42f3, 8), string(0x4282, "webm"), number(0x4287, 2), number(0x4285, 2)]));
    const duration = new Uint8Array(8); new DataView(duration.buffer).setFloat64(0, 4000);
    const info = element(0x1549a966, concat([number(0x2ad7b1, 1_000_000), element(0x4489, duration), string(0x4d80, "Verity test fixture"), string(0x5741, "Verity test fixture")]));
    const tracks = element(0x1654ae6b, element(0xae, concat([number(0xd7, 1), number(0x73c5, 1), number(0x83, 1), string(0x86, "V_VP8"), number(0x23e383, 1_000_000_000), element(0xe0, concat([number(0xb0, 800), number(0xba, 400)]))])));
    const blocks = chunks.map(chunk => element(0xa3, concat([Uint8Array.from([0x81, chunk.timestamp >> 8, chunk.timestamp & 255, 0x80]), chunk.bytes])));
    const cluster = element(0x1f43b675, concat([number(0xe7, 0), ...blocks]));
    const bytes = concat([header, element(0x18538067, concat([info, tracks, cluster]))]);
    let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  });
  return Buffer.from(encoded, "base64");
}
