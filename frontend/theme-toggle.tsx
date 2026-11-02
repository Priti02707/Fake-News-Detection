"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let preference: string | null = null;
    try { preference = localStorage.getItem("verity.theme"); } catch { /* Theme remains usable without storage. */ }
    const selected = preference ? preference === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(selected); document.documentElement.dataset.theme = selected ? "dark" : "light";
  }, []);
  function toggle() {
    const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("verity.theme", next ? "dark" : "light"); } catch { /* Session-only theme. */ }
  }
  return <button className="secondary-button theme-toggle" aria-label="Toggle color theme" aria-pressed={dark} onClick={toggle}>{dark ? <Sun size={16} /> : <Moon size={16} />}<span>{dark ? "Light mode" : "Dark mode"}</span></button>;
}
