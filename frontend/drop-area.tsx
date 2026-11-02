"use client";

import { useRef, useState, type ReactNode } from "react";
import { UploadCloud } from "lucide-react";

export default function DropArea({ label, hint, disabled = false, className = "", onDrop, children }: {
  label: string; hint: string; disabled?: boolean; className?: string;
  onDrop: (data: DataTransfer) => void; children: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  return <div role="group" aria-label={label} aria-disabled={disabled}
    className={`input-dropzone ${className} ${dragging && !disabled ? "drag-active" : ""}`}
    onDragEnter={event => { event.preventDefault(); depth.current++; if (!disabled) setDragging(true); }}
    onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = disabled ? "none" : "copy"; }}
    onDragLeave={event => { event.preventDefault(); if (--depth.current <= 0) { depth.current = 0; setDragging(false); } }}
    onDrop={event => { event.preventDefault(); event.stopPropagation(); depth.current = 0; setDragging(false); if (!disabled) onDrop(event.dataTransfer); }}>
    <p className="drop-instruction"><UploadCloud size={22} aria-hidden="true" /><span>{dragging && !disabled ? "Release to add your content" : hint}</span></p>
    {children}
  </div>;
}
