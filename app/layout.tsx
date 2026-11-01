import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verity — A clearer view of the news",
  description: "Explore news with explainable machine learning, transparent uncertainty, and links to published fact-checks. A project by Priti.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
