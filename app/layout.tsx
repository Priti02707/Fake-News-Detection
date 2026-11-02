import type { Metadata } from "next";
import "../frontend/globals.css";
import "../frontend/research.css";

export const metadata: Metadata = {
  title: "Fake News Detection — News Analysis & Evidence",
  description: "Classify English news with calibrated models, review media text and investigate claims with sources. Fake News Detection, a project by Priti Kumari.",
  applicationName: "Fake News Detection",
  authors: [{ name: "Priti Kumari", url: "https://github.com/Priti02707" }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
