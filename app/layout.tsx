import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verity AI 2.0 — Multimodal evidence verification",
  description: "Investigate image–news mismatches, video timelines and factual claims with explainable models, cited evidence and transparent uncertainty. A project by Priti.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
