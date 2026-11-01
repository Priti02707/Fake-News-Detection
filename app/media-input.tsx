"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ImagePlus, LoaderCircle, ShieldCheck, Video, X } from "lucide-react";

type Kind = "image" | "video";
type WorkerResult = { status: "progress" | "complete" | "error"; message?: string; text?: string; truncated?: boolean };
const imageTypes = ["image/png", "image/jpeg", "image/webp"];
const videoTypes = ["video/mp4", "video/webm", "video/quicktime"];

async function validateImage(file: File) {
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("This image could not be opened. Choose a valid PNG, JPEG, or WebP image."); });
  const pixels = bitmap.width * bitmap.height;
  bitmap.close();
  if (pixels > 20_000_000) throw new Error("Choose an image smaller than 20 megapixels.");
}

async function decodeVideo(file: File, signal: AbortSignal): Promise<Float32Array> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        video.onloadedmetadata = null;
        video.onerror = null;
        if (error) reject(error); else resolve();
      };
      const abort = () => finish(new Error("Extraction cancelled."));
      const timer = setTimeout(() => finish(new Error("Video metadata could not be read. Try exporting a short MP4 with AAC audio.")), 15000);
      signal.addEventListener("abort", abort, { once: true });
      video.onloadedmetadata = () => finish();
      video.onerror = () => finish(new Error("Your browser cannot open this video. Try an MP4 with AAC audio or a WebM with Opus audio."));
      video.src = url;
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 60) throw new Error("Choose a video clip no longer than 60 seconds.");
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
  signal.throwIfAborted();
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await file.arrayBuffer()).catch(() => { throw new Error("No decodable audio track was found. Try an MP4 with AAC audio or a WebM with Opus audio, or paste a transcript."); });
    signal.throwIfAborted();
    if (audio.duration > 60) throw new Error("Choose a video clip no longer than 60 seconds.");
    const offline = new OfflineAudioContext(1, Math.ceil(audio.duration * 16000), 16000);
    const source = offline.createBufferSource();
    source.buffer = audio;
    source.connect(offline.destination);
    source.start();
    const mono = (await offline.startRendering()).getChannelData(0);
    if (!mono.some(value => Math.abs(value) > 0.001)) throw new Error("This clip appears to be silent. Choose a video with audible English speech.");
    return mono;
  } finally {
    await context.close();
  }
}

export default function MediaInput({ kind, onReviewed }: { kind: Kind; onReviewed: (text: string, filename: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewRef = useRef<HTMLTextAreaElement>(null);

  function cleanup() {
    controllerRef.current?.abort();
    workerRef.current?.terminate();
    workerRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }
  useEffect(() => () => cleanup(), []);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { if (draft !== null) reviewRef.current?.focus(); }, [draft === null]);

  function chooseFile(next?: File) {
    cleanup(); setBusy(false); setError(""); setDraft(null); setTruncated(false); setProgress(""); setFile(null);
    if (!next) return;
    if (!(kind === "image" ? imageTypes : videoTypes).includes(next.type)) {
      setError(kind === "image" ? "Choose a PNG, JPEG, or WebP image." : "Choose an MP4, WebM, or MOV video."); return;
    }
    const limit = kind === "image" ? 10 : 25;
    if (!next.size || next.size > limit * 1024 * 1024) { setError(`Choose a non-empty file smaller than ${limit} MB.`); return; }
    setFile(next);
  }

  async function extract() {
    if (!file || busy) return;
    cleanup();
    const controller = new AbortController(); controllerRef.current = controller;
    setBusy(true); setError(""); setDraft(null); setProgress("Checking your file…");
    const fail = (message: string) => { cleanup(); setBusy(false); setProgress(""); setError(message); };
    // Termination also stops a stalled CDN/model download and frees worker memory.
    timerRef.current = setTimeout(() => fail("Extraction took too long. Check your connection, try a smaller file, or paste the text manually."), 10 * 60 * 1000);
    try {
      let audio: Float32Array | undefined;
      if (kind === "image") await validateImage(file);
      else { setProgress("Reading the video’s audio track…"); audio = await decodeVideo(file, controller.signal); }
      controller.signal.throwIfAborted();
      const worker = new Worker(new URL("./media.worker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;
      worker.onmessage = ({ data }: MessageEvent<WorkerResult>) => {
        if (controller.signal.aborted) return;
        if (data.status === "progress") setProgress(data.message || "Extracting…");
        else if (data.status === "complete") { setDraft(data.text || ""); setTruncated(Boolean(data.truncated)); setBusy(false); setProgress(""); cleanup(); }
        else fail(`Could not extract text. ${data.message || "Try again."} If a model download failed, check your connection or paste the text manually.`);
      };
      worker.onerror = (event) => { event.preventDefault(); fail("The browser text reader could not start. Check your connection and try again, or paste the text manually."); };
      if (audio) worker.postMessage({ kind: "video", audio }, [audio.buffer]);
      else worker.postMessage({ kind: "image", file });
    } catch (error) {
      if (!controller.signal.aborted) fail(error instanceof Error ? error.message : "This file could not be read.");
    }
  }

  return <div className="media-input">
    <div className="media-intro"><span className="media-icon">{kind === "image" ? <ImagePlus size={24} /> : <Video size={24} />}</span><div><h3>{kind === "image" ? "Read the words in an image" : "Listen to the words in a video"}</h3><p>{kind === "image" ? "Choose a clear screenshot or photo of English news text." : "Choose a short clip with clear English speech. Transcription can take several minutes on slower devices."}</p></div></div>
    <label className="media-file-label" htmlFor={`media-${kind}`}>Choose {kind}</label>
    <input id={`media-${kind}`} type="file" accept={(kind === "image" ? imageTypes : videoTypes).join(",")} onChange={event => chooseFile(event.target.files?.[0])} />
    <p className="field-help">{kind === "image" ? "PNG, JPEG, WebP · up to 10 MB and 20 megapixels" : "MP4, WebM, MOV · up to 25 MB and 60 seconds · audio codec support varies by browser"}</p>
    {file && preview && <div className="media-preview">{kind === "image" ? <img src={preview} alt={`Selected image: ${file.name}`} /> : <video src={preview} controls preload="metadata" playsInline aria-label={`Selected video: ${file.name}`} />}<span>{file.name}</span></div>}
    <p className="media-privacy"><ShieldCheck size={16} /><span>Extraction happens in this browser. First use downloads recognition models from external hosts. Your file stays on this device; only text you choose to analyze goes to our server.</span></p>
    <p className="field-help">{kind === "image" ? "We extract written words; we do not detect image manipulation." : "We transcribe speech; we do not detect deepfakes or verify video scenes."} Review errors, missing context, and names before analysis.</p>
    {file && draft === null && <div className="media-actions"><button className="primary-button" disabled={busy} onClick={() => void extract()}>{busy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}{kind === "image" ? "Extract image text" : "Transcribe video"}</button>{busy && <button className="secondary-button" onClick={() => { cleanup(); setBusy(false); setProgress(""); }}><X size={15} />Cancel extraction</button>}</div>}
    {busy && <p role="status" className="media-progress">{progress}</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {draft !== null && <div className="media-review"><label htmlFor={`review-${kind}`}>Review {kind === "image" ? "extracted text" : "video transcript"}</label><p className="field-help">Correct the words below, then move them into the article editor. Analysis starts only when you select Analyze article.</p>{truncated && <p role="status" className="field-help">The extracted text was shortened to the first 20,000 characters.</p>}<textarea ref={reviewRef} id={`review-${kind}`} maxLength={20000} value={draft} onChange={event => setDraft(event.target.value)} /><p className="field-help">{draft.length.toLocaleString()} / 20,000 characters</p><div className="media-actions"><button className="primary-button" disabled={!draft.trim()} onClick={() => { if (file) onReviewed(draft.trim(), file.name); }}>Use reviewed text <ArrowRight size={16} /></button><button className="secondary-button" onClick={() => { setDraft(null); setError(""); }}>Extract again</button></div></div>}
  </div>;
}
