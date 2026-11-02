"use client";

import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle, ShieldCheck } from "lucide-react";
import packageInfo from "@contentauth/c2pa-web/package.json";

export default function ContentCredentials({ file, onObserved }: { file: File; onObserved?: (value: import("./media-types").ProvenanceObservation) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [manifest, setManifest] = useState<object | null>(null);
  const disposeRef = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  useEffect(() => { generation.current++; setMessage(""); setManifest(null); setBusy(false); return () => { generation.current++; disposeRef.current?.(); }; }, [file]);
  async function inspect() {
    const job = generation.current;
    setBusy(true); setMessage(""); setManifest(null);
    let dispose: (() => void) | undefined;
    const timeout = setTimeout(() => { if (job === generation.current) { generation.current++; disposeRef.current?.(); setBusy(false); setMessage("The credential reader timed out. Try again with a smaller file or a working connection."); } }, 60000);
    try {
      const { createC2pa, Reader, Context } = await import("@contentauth/c2pa-web");
      if (job !== generation.current) return;
      const c2pa = await createC2pa({ wasmSrc: `https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@${packageInfo.version}/dist/resources/c2pa_bg.wasm` });
      dispose = c2pa.dispose;
      if (job !== generation.current) return;
      disposeRef.current = dispose;
      const reader = await Reader.fromBlob(c2pa, file.type, file, new Context({ verify: { verifyTrust: false, remoteManifestFetch: false } }));
      try {
        if (job !== generation.current) return;
        if (!reader) { onObserved?.({ status: "not_found", signer_trust: "not_checked" }); setMessage("No embedded Content Credentials were found. This does not mean the file is fake or manipulated."); return; }
        const store = await reader.manifestStore();
        if (job !== generation.current) return;
        setManifest(store); onObserved?.({ status: "found", validation_state: store.validation_state || "not_reported", signer_trust: "not_checked" });
        setMessage(`Embedded Content Credentials found. SDK validation state: ${store.validation_state || "not reported"}. Signer trust has not been established; credentials do not verify the claims in this media.`);
      } finally { await reader?.free(); }
    } catch {
      if (job === generation.current) { onObserved?.({ status: "unavailable", signer_trust: "not_checked" }); setMessage("Content Credentials could not be read. The format may be unsupported, credentials may be damaged, or the reader may be unavailable. No authenticity conclusion was made."); }
    } finally { clearTimeout(timeout); dispose?.(); if (disposeRef.current === dispose) disposeRef.current = null; if (job === generation.current) setBusy(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ filename: file.name, checked_at: new Date().toISOString(), signer_trust: "not_checked", remote_manifest_fetch: false, manifest }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "fake-news-detection-content-credentials.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="credentials-panel" aria-label="Content Credentials"><h4><ShieldCheck size={17} />Content Credentials</h4><p className="field-help">Inspect embedded C2PA provenance locally. This downloads the reader from jsDelivr. Remote manifests are not fetched, and signer trust is not checked.</p><button className="secondary-button" disabled={busy} onClick={() => void inspect()}>{busy ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />}Inspect Content Credentials</button>{message && <p role="status" className="field-help">{message}</p>}{manifest && <><button className="text-link" onClick={download}><Download size={14} />Download credential report</button><details><summary>Inspect manifest data</summary><pre>{JSON.stringify(manifest, null, 2)}</pre></details></>}</section>;
}
