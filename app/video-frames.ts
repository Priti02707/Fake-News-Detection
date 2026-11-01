export type LocalFrame = { id: string; timestamp: number; width: number; height: number; blob: Blob; scene_change: number };

export async function sampleVideoFrames(file: File, signal: AbortSignal, options: { interval: number; maxFrames: number }, progress: (text: string) => void): Promise<LocalFrame[]> {
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.preload = "auto";
  const url = URL.createObjectURL(file);
  function wait(event: "loadedmetadata" | "seeked", action: () => void) {
    return new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => { clearTimeout(timer); video.removeEventListener(event, ready); video.removeEventListener("error", failed); signal.removeEventListener("abort", aborted); if (error) reject(error); else resolve(); };
      const ready = () => finish();
      const failed = () => finish(new Error("This browser cannot decode the video's visual track. Try a standard MP4 or WebM clip."));
      const aborted = () => finish(new Error("Frame inspection cancelled."));
      const timer = setTimeout(() => finish(new Error("Video decoding timed out.")), 15000);
      video.addEventListener(event, ready, { once: true }); video.addEventListener("error", failed, { once: true }); signal.addEventListener("abort", aborted, { once: true });
      if (signal.aborted) { aborted(); return; }
      action();
    });
  }
  try {
    await wait("loadedmetadata", () => { video.src = url; });
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 60) throw new Error("Frame inspection supports clips up to 60 seconds with readable duration metadata.");
    if (!video.videoWidth || !video.videoHeight || video.videoWidth * video.videoHeight > 8_294_400) throw new Error("Choose a video no larger than 4K (8.3 megapixels per frame).");
    const width = Math.min(960, video.videoWidth);
    const height = Math.round(video.videoHeight * width / video.videoWidth);
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const tiny = document.createElement("canvas"); tiny.width = 32; tiny.height = 18;
    const small = tiny.getContext("2d", { willReadFrequently: true });
    if (!context || !small) throw new Error("Canvas video decoding is unavailable in this browser.");
    const frames: LocalFrame[] = [];
    let previous: Uint8ClampedArray | null = null;
    const times = Array.from({ length: Math.max(1, Math.ceil(video.duration / options.interval)) }, (_, index) => Math.min(video.duration - .05, index * options.interval + .05));
    for (const [index, timestamp] of times.entries()) {
      signal.throwIfAborted();
      progress(`Inspecting visual sample ${index + 1} of ${times.length}…`);
      await wait("seeked", () => { video.currentTime = timestamp; });
      context.drawImage(video, 0, 0, width, height); small.drawImage(video, 0, 0, 32, 18);
      const pixels = small.getImageData(0, 0, 32, 18).data;
      const delta = previous ? pixels.reduce((sum, value, i) => sum + (i % 4 === 3 ? 0 : Math.abs(value - previous![i])), 0) / (32 * 18 * 3 * 255) : 1;
      previous = pixels;
      if (frames.length === 0 || delta >= .1 || index === times.length - 1) {
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("A video frame could not be captured.")), "image/jpeg", .85));
        frames.push({ id: `frame-${index}`, timestamp, width, height, blob, scene_change: delta });
      }
      if (frames.length >= options.maxFrames) break;
    }
    return frames;
  } finally { video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url); }
}
