import type { Metadata } from "next";
import "../frontend/globals.css";

export const metadata: Metadata = {
  title: "Verity AI — Explainable Fake News Detection",
  description: "Classify English news with calibrated models and clear explanations. Review image, video and audio text, inspect media context, and explore optional evidence. A project by Priti.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
