// Local, bounded audio decoding shared by standalone audio and video speech.
export async function decodeSpeechAudio(file: File, signal: AbortSignal, metadataValidated = false): Promise<Float32Array> {
  if (!metadataValidated) {
    const element = document.createElement("audio"), url = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => { clearTimeout(timer); signal.removeEventListener("abort", abort); element.onloadedmetadata = null; element.onerror = null; error ? reject(error) : resolve(); };
        const abort = () => finish(new Error("Audio processing cancelled."));
        const timer = setTimeout(() => finish(new Error("Audio metadata could not be read. Try a WAV or MP3 file.")), 15000);
        signal.addEventListener("abort", abort, { once: true });
        element.onloadedmetadata = () => finish();
        element.onerror = () => finish(new Error("This browser cannot decode the audio. Try WAV, MP3 or M4A."));
        if (signal.aborted) { abort(); return; }
        element.src = url;
      });
      if (!Number.isFinite(element.duration) || element.duration <= 0 || element.duration > 60) throw new Error("Choose an audio clip no longer than 60 seconds.");
    } finally { element.removeAttribute("src"); element.load(); URL.revokeObjectURL(url); }
  }
  signal.throwIfAborted();
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await file.arrayBuffer()).catch(() => { throw new Error("No decodable audio track was found. Try WAV, MP3, M4A, or a video with supported audio."); });
    signal.throwIfAborted();
    if (!Number.isFinite(audio.duration) || audio.duration <= 0 || audio.duration > 60) throw new Error("Choose a clip no longer than 60 seconds.");
    const offline = new OfflineAudioContext(1, Math.ceil(audio.duration * 16000), 16000);
    const source = offline.createBufferSource(); source.buffer = audio; source.connect(offline.destination); source.start();
    const mono = (await offline.startRendering()).getChannelData(0);
    signal.throwIfAborted();
    if (!mono.some(value => Math.abs(value) > .001)) throw new Error("This clip appears to be silent. Choose a file with audible speech.");
    return mono;
  } finally { await context.close(); }
}
