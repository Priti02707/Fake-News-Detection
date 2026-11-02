"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ImagePlus, LoaderCircle, ShieldCheck, Video, Mic, X } from "lucide-react";

import { fileSignatureMatches } from "./file-format";
import { reserveBrowserModel } from "./worker-budget";
import { sampleVideoFrames } from "./video-frames";
import type { FrameObservation } from "./media-types";
import ImageContext from "./image-context";
import ContentCredentials from "./content-credentials";
import type { MediaSegment, MediaTrace, MediaPreviewFiles } from "./media-types";
import Investigation from "./investigation";
import VideoTimeline from "./video-timeline";
import { decodeSpeechAudio } from "./speech-audio";
import type { MediaEvidenceContext } from "./multimodal";

type Kind = "image" | "video" | "audio";
type WorkerResult = { status: "progress" | "complete" | "error"; message?: string; text?: string; truncated?: boolean; segments?: MediaSegment[]; width?: number; height?: number };
const imageTypes = ["image/png", "image/jpeg", "image/webp"];
const audioTypes = ["audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/flac", "audio/x-flac", "audio/webm"];
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
  return decodeSpeechAudio(file, signal, true);
}

export default function MediaInput({ kind, onReviewed, onAnalyze, analysisBusy = false }: { kind: Kind; onReviewed: (text: string, filename: string, trace: MediaTrace, files: MediaPreviewFiles) => void; onAnalyze?: (text: string, trace: MediaTrace, files: MediaPreviewFiles) => void; analysisBusy?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [trace, setTrace] = useState<MediaTrace | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [frameBusy, setFrameBusy] = useState(false);
  const [frameInterval, setFrameInterval] = useState(5);
  const [maxFrames, setMaxFrames] = useState(6);
  const [frames, setFrames] = useState<(FrameObservation & { preview: string; file: File })[]>([]);
  const [mediaClaim, setMediaClaim] = useState<{ claim: string; context: MediaEvidenceContext } | null>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);
  function investigate(claim: string, context: MediaEvidenceContext) {
    setMediaClaim({ claim: claim.slice(0, 300), context: { ...context, filename: file?.name || context.filename } });
    setTimeout(() => evidenceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }
  const selectionRef = useRef(0);
  const frameUrls = useRef<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  function seek(timestamp: number) { const player = kind === "audio" ? audioRef.current : videoRef.current; if (player) player.currentTime = timestamp; }
  const releaseRef = useRef<(() => void) | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewRef = useRef<HTMLTextAreaElement>(null);

  function cleanup() {
    releaseRef.current?.(); releaseRef.current = null;
    controllerRef.current?.abort();
    workerRef.current?.terminate();
    workerRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }
  useEffect(() => () => { selectionRef.current++; cleanup(); frameUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { if (draft !== null) reviewRef.current?.focus(); }, [draft === null]);

  async function chooseFile(next?: File) {
    const selection = ++selectionRef.current;
    frameUrls.current.forEach(url => URL.revokeObjectURL(url)); frameUrls.current = []; setFrames([]); setFrameBusy(false);
    cleanup(); setBusy(false); setError(""); setDraft(null); setTrace(null); setMediaClaim(null); setSelectedSegment(null); setTruncated(false); setProgress(""); setFile(null);
    if (!next) return;
    if (!(kind === "image" ? imageTypes : kind === "audio" ? audioTypes : videoTypes).includes(next.type)) {
      setError(kind === "image" ? "Choose a PNG, JPEG, or WebP image." : kind === "audio" ? "Choose a WAV, MP3, M4A, OGG, FLAC or WebM audio file." : "Choose an MP4, WebM, or MOV video."); return;
    }
    const limit = kind === "image" ? 10 : kind === "audio" ? 20 : 25;
    if (!next.size || next.size > limit * 1024 * 1024) { setError(`Choose a non-empty file smaller than ${limit} MB.`); return; }
    try {
      const matches = await fileSignatureMatches(next);
      if (selection !== selectionRef.current) return;
      if (!matches) { setError("The file contents do not match its declared format. Export a valid supported image, audio, or video file and try again."); return; }
      if (kind === "image") await validateImage(next);
      if (selection !== selectionRef.current) return;
      setFile(next);
    } catch (error) { if (selection === selectionRef.current) setError(error instanceof Error ? error.message : "This file could not be read. Choose it again and retry."); }
  }

  async function extract() {
    if (!file || busy) return;
    cleanup();
    const release = reserveBrowserModel();
    if (!release) { setError("Another model is processing on this page. Wait or cancel that job first."); return; }
    releaseRef.current = release;
    const controller = new AbortController(); controllerRef.current = controller;
    setBusy(true); setError(""); setDraft(null); setProgress("Checking your file…");
    const fail = (message: string) => { cleanup(); setBusy(false); setProgress(""); setError(message); };
    // Termination also stops a stalled CDN/model download and frees worker memory.
    timerRef.current = setTimeout(() => fail("Extraction took too long. Check your connection, try a smaller file, or paste the text manually."), 10 * 60 * 1000);
    try {
      let audio: Float32Array | undefined;
      if (kind === "image") await validateImage(file);
      else { setProgress("Reading the audio track…"); audio = kind === "audio" ? await decodeSpeechAudio(file, controller.signal) : await decodeVideo(file, controller.signal); }
      controller.signal.throwIfAborted();
      const worker = new Worker(new URL("./media.worker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;
      worker.onmessage = ({ data }: MessageEvent<WorkerResult>) => {
        if (controller.signal.aborted) return;
        if (data.status === "progress") setProgress(data.message || "Extracting…");
        else if (data.status === "complete") { setDraft(data.text || ""); setTrace(current => ({ ...current, filename: file.name, kind, language, original_text: data.text || "", segments: data.segments || [], width: data.width, height: data.height })); setSelectedSegment(null); setTruncated(Boolean(data.truncated)); setBusy(false); setProgress(""); cleanup(); }
        else fail(`Could not extract text. ${data.message || "Try again."} If a model download failed, check your connection or paste the text manually.`);
      };
      worker.onerror = (event) => { event.preventDefault(); fail("The browser text reader could not start. Check your connection and try again, or paste the text manually."); };
      if (audio) worker.postMessage({ kind, audio, language }, [audio.buffer]);
      else worker.postMessage({ kind: "image", file, language });
    } catch (error) {
      if (!controller.signal.aborted) fail(error instanceof Error ? error.message : "This file could not be read.");
    }
  }

  async function inspectFrames() {
    if (!file || busy || frameBusy) return;
    cleanup();
    const release = reserveBrowserModel();
    if (!release) { setError("Another model is processing on this page. Wait or cancel that job first."); return; }
    releaseRef.current = release;
    setFrameBusy(true); setError(""); setProgress("Reading the visual track…");
    const controller = new AbortController(); controllerRef.current = controller;
    const fail = (message: string) => { cleanup(); setFrameBusy(false); setProgress(""); setError(message); };
    timerRef.current = setTimeout(() => fail("Frame inspection timed out. Try a smaller clip or fewer samples."), 5 * 60 * 1000);
    try {
      const samples = await sampleVideoFrames(file, controller.signal, { interval: frameInterval, maxFrames }, setProgress);
      controller.signal.throwIfAborted();
      const worker = new Worker(new URL("./media.worker.ts", import.meta.url), { type: "module" }); workerRef.current = worker;
      worker.onmessage = ({ data }) => {
        if (controller.signal.aborted) return;
        if (data.status === "progress") setProgress(data.message);
        else if (data.status === "frames_complete") {
          frameUrls.current.forEach(url => URL.revokeObjectURL(url)); frameUrls.current = [];
          const rows = (data.frames as FrameObservation[]).map(frame => {
            const sample = samples.find(value => value.id === frame.id)!;
            const preview = URL.createObjectURL(sample.blob); frameUrls.current.push(preview);
            return { ...frame, preview, file: new File([sample.blob], `${frame.id}.jpg`, { type: "image/jpeg" }) };
          });
          setFrames(rows);
          setTrace(current => ({ filename: file.name, kind, language, original_text: "", segments: [], ...current, frames: data.frames, frame_sampling: { interval: frameInterval, max_frames: maxFrames, method: "Bounded full-clip temporal sampling with pixel scene-change selection" }, warnings: ["Sampled frames can miss scenes, subtitles, and claims between samples. OCR and scene-change scores do not verify authenticity."] }));
          setFrameBusy(false); setProgress(""); cleanup();
        } else fail("Frame OCR could not finish. Try again or inspect the selected frames manually.");
      };
      worker.onerror = event => { event.preventDefault(); fail("Frame OCR could not start. Check your connection and retry."); };
      worker.postMessage({ kind: "frames", language, frames: samples.map(sample => ({ ...sample, blob: undefined, file: new File([sample.blob], `${sample.id}.jpg`, { type: "image/jpeg" }) })) });
    } catch (error) { if (!controller.signal.aborted) fail(error instanceof Error ? error.message : "Video frames could not be read."); }
  }
  return <div className="media-input">
    <div className="media-intro"><span className="media-icon">{kind === "image" ? <ImagePlus size={24} /> : kind === "audio" ? <Mic size={24} /> : <Video size={24} />}</span><div><h3>{kind === "image" ? "Image fake news detection" : kind === "audio" ? "Audio fake news detection" : "Video fake news detection"}</h3><p>{kind === "image" ? "Choose a clear screenshot or photo of English news text." : "Transcribe a short clip, review its claims, then classify the spoken words. Acoustic and full-media classifiers are not evaluated; no authenticity verdict is inferred."}</p></div></div>
    <label className="media-file-label" htmlFor={`language-${kind}`}>Extraction language</label><select id={`language-${kind}`} value={language} disabled={busy || frameBusy} onChange={event => { setLanguage(event.target.value as "en" | "hi"); setMediaClaim(null); setDraft(null); setTrace(null); setFrames([]); frameUrls.current.forEach(url => URL.revokeObjectURL(url)); frameUrls.current = []; setSelectedSegment(null); }}><option value="en">English</option><option value="hi">Hindi + English (experimental)</option></select>{language === "hi" && <p className="field-help">Hindi extraction is experimental. The article classifier is evaluated on English only and abstains on Hindi-script input. Review Hindi evidence manually.</p>}
    <label className="media-file-label" htmlFor={`media-${kind}`}>Choose {kind}</label>
    <div className="media-dropzone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (event.dataTransfer.files.length !== 1) { setError("Choose one file at a time."); return; } void chooseFile(event.dataTransfer.files[0]); }}><p className="field-help">Drag and drop one {kind} file here, or choose a file.</p><input id={`media-${kind}`} type="file" accept={(kind === "image" ? imageTypes : kind === "audio" ? audioTypes : videoTypes).join(",")} onChange={event => chooseFile(event.target.files?.[0])} /></div>
    <p className="field-help">{kind === "image" ? "PNG, JPEG, WebP · up to 10 MB and 20 megapixels" : kind === "audio" ? "WAV, MP3, M4A, OGG, FLAC, WebM · up to 20 MB and 60 seconds · decoding depends on your browser" : "MP4, WebM, MOV · up to 25 MB and 60 seconds · audio codec support varies by browser"}</p>
    {file && preview && <div className="media-preview">{kind === "image" ? trace?.width && trace.height ? <svg viewBox={`0 0 ${trace.width} ${trace.height}`} role="img" aria-label={`Selected image with OCR regions: ${file.name}`}><image href={preview} width={trace.width} height={trace.height} />{trace.segments.map((segment, index) => segment.bbox && <rect key={index} x={segment.bbox.x0} y={segment.bbox.y0} width={segment.bbox.x1 - segment.bbox.x0} height={segment.bbox.y1 - segment.bbox.y0} className={selectedSegment === index ? "ocr-region selected-region" : "ocr-region"} />)}</svg> : <img src={preview} alt={`Selected image: ${file.name}`} /> : kind === "audio" ? <audio ref={audioRef} src={preview} controls preload="metadata" aria-label={`Selected audio: ${file.name}`} /> : <video ref={videoRef} src={preview} controls preload="metadata" playsInline aria-label={`Selected video: ${file.name}`} />}<span>{file.name}</span></div>}
    {trace && trace.segments.length > 0 && <div className="media-segments" aria-label={kind === "image" ? "OCR regions" : "Transcript timestamps"}><p className="field-help">{kind === "image" ? "Select an extracted line to highlight its original image region." : `Select a timestamp to seek to that part of the original ${kind}.`} These locations refer to the original extraction, even after you edit the text.</p>{trace.segments.map((segment, index) => <button key={index} aria-pressed={selectedSegment === index} onClick={() => { setSelectedSegment(index); if (segment.start !== undefined) seek(segment.start); }}><span>{kind === "image" ? `Line ${index + 1}` : `${Math.floor((segment.start || 0) / 60)}:${Math.floor((segment.start || 0) % 60).toString().padStart(2, "0")}`}</span>{segment.text}</button>)}</div>}
    {kind === "video" && file && <section className="video-frame-panel"><h4>Inspect the visual track</h4><p className="field-help">Capture representative keyframes and read on-screen text locally, including clips without narration. Samples can miss intervening scenes and subtitles.</p><div className="frame-controls"><label>Desired sample interval<select aria-label="Frame sample interval" disabled={busy || frameBusy} value={frameInterval} onChange={event => setFrameInterval(Number(event.target.value))}><option value={2}>2 seconds</option><option value={5}>5 seconds</option><option value={10}>10 seconds</option></select></label><label>Maximum keyframes<select aria-label="Maximum keyframes" disabled={busy || frameBusy} value={maxFrames} onChange={event => setMaxFrames(Number(event.target.value))}><option value={3}>3 frames</option><option value={6}>6 frames</option></select></label></div><button className="secondary-button" disabled={busy || frameBusy} onClick={() => void inspectFrames()}>{frameBusy ? <LoaderCircle className="spin" size={16} /> : <Video size={16} />}Inspect video frames</button>{frameBusy && <button className="text-link" onClick={() => { cleanup(); setFrameBusy(false); setProgress(""); }}>Cancel frame inspection</button>}{frames.length > 0 && <><div className="video-frame-grid">{frames.map(frame => <article className="video-keyframe" key={frame.id}><button className="frame-seek" aria-label={`Seek to frame at ${frame.timestamp.toFixed(1)} seconds`} onClick={() => { if (videoRef.current) videoRef.current.currentTime = frame.timestamp; }}><img src={frame.preview} alt={`Video keyframe at ${frame.timestamp.toFixed(1)} seconds`} /><strong>{frame.timestamp.toFixed(1)} seconds</strong></button><p className="field-help">{frame.ocr_status === "text_found" ? frame.text : frame.ocr_status === "no_text" ? "No readable on-screen text found." : "OCR unavailable for this frame."}</p><ImageContext file={frame.file} timestamp={frame.timestamp} onInvestigate={investigate} onObserved={observation => { setFrames(current => current.map(value => value.id === frame.id ? { ...value, visual_consistency: observation || undefined } : value)); setTrace(current => current ? { ...current, frames: current.frames?.map(value => value.id === frame.id ? { ...value, visual_consistency: observation || undefined } : value) } : current); }} /></article>)}</div><button className="secondary-button" disabled={!frames.some(frame => frame.text)} onClick={() => { const words = frames.filter(frame => frame.text).map(frame => frame.text).join("\n\n"); setDraft(current => `${current || ""}\n\n${words}`.trim().slice(0, 20000)); }}>Add on-screen text to review</button><p className="field-help">This adds frame text to the editable review. Review context before classifying these words. Frame locations are included in the report.</p></>}</section>}
    {file && kind !== "audio" && <><ContentCredentials file={file} onObserved={observation => setTrace(current => ({ filename: file.name, kind, language, original_text: "", segments: [], ...current, provenance: observation }))} />{kind === "image" && <ImageContext file={file} onInvestigate={investigate} onObserved={observation => setTrace(current => ({ filename: file.name, kind, language, original_text: "", segments: [], ...current, visual_consistency: observation || undefined }))} />}</>}
    {kind === "video" && trace && <VideoTimeline trace={trace} onSeek={timestamp => { if (videoRef.current) videoRef.current.currentTime = timestamp; }} onInvestigate={investigate} />}
    {mediaClaim && <div ref={evidenceRef} className="media-evidence-case"><h3>Evidence-grounded media verification</h3><p className="field-help">Review the selected factual claim before searching. Caption searches do not identify the original image. Export this notebook before changing files or moving to article analysis.</p><label htmlFor={`media-claim-${kind}`}>Media claim to investigate</label><textarea id={`media-claim-${kind}`} maxLength={300} value={mediaClaim.claim} onChange={event => setMediaClaim(current => current ? { ...current, claim: event.target.value } : current)} /><Investigation claim={mediaClaim.claim} context={mediaClaim.context} autoDiscover /></div>}
    <p className="media-privacy"><ShieldCheck size={16} /><span>Extraction happens in this browser. First use downloads recognition models from external hosts. Your file stays on this device; only text you choose to analyze goes to our server.</span></p>
    <p className="field-help">{kind === "image" ? "We extract written words; we do not detect image manipulation." : "Speech-text classification does not establish audio/video authenticity or a full-media fake-news prediction."} Review errors, missing context, and names before analysis.</p>
    {file && (draft === null || kind !== "image") && <div className="media-actions"><button className="primary-button" disabled={busy || frameBusy} onClick={() => void extract()}>{busy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}{kind === "image" ? "Extract image text" : kind === "audio" ? "Transcribe audio" : "Transcribe video"}</button>{busy && <button className="secondary-button" onClick={() => { cleanup(); setBusy(false); setProgress(""); }}><X size={15} />Cancel extraction</button>}</div>}
    {(busy || frameBusy) && <p role="status" className="media-progress">{progress}</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {draft !== null && <div className="media-review"><label htmlFor={`review-${kind}`}>Review {kind === "image" ? "extracted text" : `${kind} transcript`}</label><p className="field-help">Correct recognition errors, then classify these reviewed words directly. The text model does not classify the full visual or acoustic content.</p>{truncated && <p role="status" className="field-help">The extracted text was shortened to the first 20,000 characters.</p>}<textarea ref={reviewRef} id={`review-${kind}`} maxLength={20000} value={draft} onChange={event => setDraft(event.target.value)} /><p className="field-help">{draft.length.toLocaleString()} / 20,000 characters</p><div className="media-actions">{onAnalyze && <button className="primary-button" disabled={analysisBusy || busy || frameBusy || draft.trim().length < 10} onClick={() => { if (file && trace) onAnalyze(draft.trim(), trace, { source: file, frames: frames.map(frame => ({ id: frame.id, file: frame.file })) }); }}>{analysisBusy ? "Classifying…" : "Classify reviewed words"}</button>}<button className="secondary-button" disabled={!draft.trim() || analysisBusy} onClick={() => { if (file && trace) onReviewed(draft.trim(), file.name, trace, { source: file, frames: frames.map(frame => ({ id: frame.id, file: frame.file })) }); }}>Use reviewed text <ArrowRight size={16} /></button><button className="secondary-button" onClick={() => { setDraft(null); setError(""); }}>Extract again</button></div></div>}
  </div>;
}
