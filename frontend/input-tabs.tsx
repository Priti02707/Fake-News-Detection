"use client";

import { FileText, ImagePlus, Link2, Mic, Video } from "lucide-react";
import type { KeyboardEvent } from "react";

const inputs = [
  { mode: "text", label: "Text", accessibleName: "Paste text", icon: FileText },
  { mode: "image", label: "Image", accessibleName: "Image", icon: ImagePlus },
  { mode: "video", label: "Video", accessibleName: "Video", icon: Video },
  { mode: "url", label: "Article URL", accessibleName: "Article URL", icon: Link2 },
  { mode: "audio", label: "Audio", accessibleName: "Audio", icon: Mic },
] as const;
export type InputMode = typeof inputs[number]["mode"];

export default function InputTabs({ mode, onChange }: { mode: InputMode; onChange: (mode: InputMode) => void }) {
  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % inputs.length;
    else if (event.key === "ArrowLeft") next = (index + inputs.length - 1) % inputs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = inputs.length - 1;
    else return;
    event.preventDefault();
    onChange(inputs[next].mode);
    document.getElementById(`input-tab-${inputs[next].mode}`)?.focus();
  }
  return <div className="input-tools" role="tablist" aria-label="Input type">
    {inputs.map((item, index) => <button key={item.mode} id={`input-tab-${item.mode}`} role="tab" aria-label={item.mode === "text" ? item.accessibleName : undefined} aria-selected={mode === item.mode} aria-controls="news-input-panel" tabIndex={mode === item.mode ? 0 : -1} className={`${index < 3 ? "main-input-tab" : "extra-input-tab"} ${mode === item.mode ? "selected" : ""}`} onClick={() => onChange(item.mode)} onKeyDown={event => move(event, index)}><item.icon size={17} />{item.label}</button>)}
  </div>;
}
